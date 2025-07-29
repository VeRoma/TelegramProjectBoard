import * as api from './api.js';
import * as render from './ui/render.js';
import * as modals from './ui/modals.js';
import * as uiUtils from './ui/utils.js';
import { STATUSES } from './data/statuses.js';

export let appData = {};
let allProjects = [];
let allEmployees = [];

export function setInitialData(initialData) {
    if (!initialData) return;
    appData = initialData;
    allProjects = initialData.allProjects || [];
    allEmployees = initialData.allEmployees || [];
}

export function getEmployees() {
    return allEmployees;
}

export async function handleSaveActiveTask() {
    const tg = window.Telegram.WebApp;
    const activeEditElement = document.querySelector('.task-details.edit-mode');
    if (!activeEditElement) return;

    const responsibleText = activeEditElement.querySelector('.task-responsible-view').textContent;
    const selectedEmployees = responsibleText ? responsibleText.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    const updatedTask = {
        rowIndex: parseInt(activeEditElement.querySelector('.task-row-index').value, 10),
        name: activeEditElement.querySelector('.task-name-edit').value,
        message: activeEditElement.querySelector('.task-message-edit').value,
        status: activeEditElement.querySelector('.task-status-view').textContent,
        project: activeEditElement.querySelector('.task-project-view').textContent,
        responsible: selectedEmployees,
        version: parseInt(activeEditElement.dataset.version, 10),
        приоритет: parseInt(JSON.parse(activeEditElement.dataset.task).приоритет, 10)
    };

    try {
        const result = await api.saveTask({taskData: updatedTask, modifierName: appData.userName});
        if (result.status === 'success') {
            uiUtils.showToast('Изменения сохранены', 'success');
            tg.HapticFeedback.notificationOccurred('success');
            
            const taskInAppData = appData.projects
                .flatMap(p => p.tasks)
                .find(t => t.rowIndex === updatedTask.rowIndex);
            if (taskInAppData) Object.assign(taskInAppData, updatedTask, {version: result.newVersion});

            uiUtils.exitEditMode(activeEditElement);
            uiUtils.updateFabButtonUI(false, handleSaveActiveTask, handleShowAddTaskModal);
        } else {
            if (result.error && result.error.includes("изменены другим пользователем")) {
                tg.showAlert(result.error + '\nТекущие данные будут обновлены.', () => window.location.reload());
            } else {
                tg.showAlert('Ошибка сохранения: ' + (result.error || 'Неизвестная ошибка'));
            }
        }
    } catch (error) {
        tg.showAlert('Критическая ошибка сохранения: ' + error.message);
    }
}

export function handleShowAddTaskModal() {
    modals.openAddTaskModal(allProjects, allEmployees);
}

export async function handleCreateTask(taskData) {
    const tg = window.Telegram.WebApp;
    const tempRowIndex = `temp_${Date.now()}`;
    const optimisticTask = { ...taskData, rowIndex: tempRowIndex, version: 0 };
    let targetProject = appData.projects.find(p => p.name === optimisticTask.project);

    if (!targetProject) {
        targetProject = { name: optimisticTask.project, tasks: [] };
        appData.projects.push(targetProject);
        if (!allProjects.includes(optimisticTask.project)) {
             allProjects.push(optimisticTask.project);
        }
    }
    targetProject.tasks.push(optimisticTask);
    modals.closeAddTaskModal();
    render.renderProjects(appData.projects, appData.userName, appData.userRole);
    uiUtils.showToast('Задача добавлена, идет сохранение...');
    tg.HapticFeedback.notificationOccurred('success');
    try {
        const result = await api.addTask({newTaskData: taskData, creatorName: appData.userName});
        if (result.status === 'success' && result.task) {
            const finalTask = result.task;
            const projectToUpdate = appData.projects.find(p => p.name === finalTask.project);
            if (projectToUpdate) {
                const taskToUpdate = projectToUpdate.tasks.find(t => t.rowIndex === tempRowIndex);
                if (taskToUpdate) {
                    Object.assign(taskToUpdate, finalTask);
                }
            }
            render.renderProjects(appData.projects, appData.userName, appData.userRole);
            uiUtils.showToast('Задача успешно сохранена', 'success');
        } else {
            throw new Error(result.error || 'Неизвестная ошибка сервера');
        }
    } catch (error) {
        tg.showAlert(`Не удалось сохранить задачу: ${error.message}. Обновляем список...`);
        window.location.reload();
    }
}

export async function handleStatusUpdate(rowIndex, newStatus) {
    const tg = window.Telegram.WebApp;
    const project = appData.projects.find(p => p.tasks.some(t => t.rowIndex == rowIndex));
    if (!project) return;
    const task = project.tasks.find(t => t.rowIndex == rowIndex);
    if (!task) return;
    const oldStatus = task.status;
    task.status = newStatus;
    if (newStatus === 'Выполнено') task.приоритет = 999;
    render.renderProjects(appData.projects, appData.userName, appData.userRole);
    uiUtils.showToast('Статус обновлён');
    try {
        const result = await api.saveTask({taskData: task, modifierName: appData.userName});
        if (result.status !== 'success') throw new Error(result.error || 'Ошибка сохранения на сервере');
    } catch (error) {
        tg.showAlert('Не удалось сохранить новый статус. Возвращаем как было.');
        task.status = oldStatus;
        render.renderProjects(appData.projects, appData.userName, appData.userRole);
    }
}

// --- ФИНАЛЬНАЯ ВЕРСИЯ DRAG-N-DROP ---
export function handleDragDrop(projectName, updatedTaskIdsInGroup) {
    const projectData = appData.projects.find(p => p.name === projectName);
    if (!projectData) {
        console.error(`[handleDragDrop] КРИТИЧЕСКАЯ ОШИБКА: Проект "${projectName}" не найден!`);
        return;
    }

    const taskMap = new Map(projectData.tasks.map(t => [t.rowIndex.toString(), t]));

    // 1. Пересчитываем приоритеты от 1 до N для ВСЕХ задач в измененной группе
    const tasksToUpdate = updatedTaskIdsInGroup.map((id, index) => {
        const task = taskMap.get(id);
        if (task) {
            // Обновляем приоритет в локальном объекте немедленно
            task.приоритет = index + 1;
            return {
                rowIndex: task.rowIndex,
                приоритет: task.приоритет
            };
        }
    }).filter(Boolean); // Убираем возможные undefined

    // 2. Сразу же перерисовываем интерфейс. renderProjects использует уже обновленные
    // локальные данные и отсортирует все правильно.
    render.renderProjects(appData.projects, appData.userName, appData.userRole);
    uiUtils.showToast('Идет сохранение нового порядка задач...');
    
    // 3. В фоновом режиме отправляем на сервер только измененные задачи
    api.updatePriorities({tasks: tasksToUpdate, modifierName: appData.userName})
        .then(result => {
            if (result.status === 'success') {
                uiUtils.showToast('Сохранение завершено', 'success');
            } else {
                throw new Error(result.error || 'Неизвестная ошибка сервера');
            }
        })
        .catch(error => {
            window.Telegram.WebApp.showAlert('Не удалось сохранить новый порядок задач: ' + error.message);
            window.location.reload(); // В случае ошибки - откатываемся
        });
}