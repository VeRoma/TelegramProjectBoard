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
    };

    try {
        const result = await api.saveTask({taskData: updatedTask, modifierName: appData.userName});
        if (result.status === 'success') {
            uiUtils.showToast('Изменения сохранены');
            tg.HapticFeedback.notificationOccurred('success');
            uiUtils.exitEditMode(activeEditElement);
            uiUtils.updateFabButtonUI(false, handleSaveActiveTask, handleShowAddTaskModal);

            const oldTaskData = JSON.parse(activeEditElement.dataset.task);
            const newTaskData = {...oldTaskData, ...updatedTask, responsible: selectedEmployees.join(', ')};
            activeEditElement.dataset.task = JSON.stringify(newTaskData).replace(/'/g, '&apos;');
            activeEditElement.dataset.version = result.newVersion;
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
    uiUtils.showToast('Задача добавлена, сохранение...');
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
            uiUtils.showToast('Задача успешно сохранена!');
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
    if (newStatus === 'Выполнено') task.приоритет = 99;
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
    if (!projectData) return;

    const taskMap = new Map(projectData.tasks.map(t => [t.rowIndex.toString(), t]));

    // 1. Создаем новый, отсортированный пользователем, массив задач для измененной группы
    const reorderedGroup = updatedTaskIdsInGroup.map(id => taskMap.get(id));
    const modifiedStatus = reorderedGroup.length > 0 ? reorderedGroup[0].status : null;

    // 2. Группируем все задачи проекта по статусам
    const tasksByStatus = projectData.tasks.reduce((acc, task) => {
        const status = task.status;
        if (!acc[status]) acc[status] = [];
        acc[status].push(task);
        return acc;
    }, {});

    // 3. Заменяем старый массив задач в измененном статусе на новый, отсортированный
    if (modifiedStatus) {
        tasksByStatus[modifiedStatus] = reorderedGroup;
    }

    // 4. Собираем единый массив задач, отсортированный по порядку статусов, а внутри - по новому порядку пользователя
    const sortedStatusKeys = Object.keys(tasksByStatus).sort((a, b) => (STATUSES.find(s => s.name === a) || { order: 99 }).order - (STATUSES.find(s => s.name === b) || { order: 99 }).order);
    const fullSortedTasks = sortedStatusKeys.flatMap(status => tasksByStatus[status] || []);

    // 5. Пересчитываем глобальные приоритеты для ВСЕХ задач проекта от 1 до N
    const tasksToUpdate = fullSortedTasks.map((task, index) => {
        task.приоритет = index + 1; // Обновляем приоритет в локальных данных
        return {
            rowIndex: task.rowIndex,
            приоритет: task.приоритет
        };
    });

    // 6. Сохраняем полностью отсортированный массив в наше локальное состояние
    projectData.tasks = fullSortedTasks;
    
    // 7. Сразу перерисовываем интерфейс с новым порядком
    render.renderProjects(appData.projects, appData.userName, appData.userRole);
    uiUtils.showToast('Сохранение нового порядка...');
    
    // 8. Отправляем на сервер ПОЛНЫЙ список задач с новыми приоритетами
    api.updatePriorities({tasks: tasksToUpdate, modifierName: appData.userName})
        .then(result => {
            if (result.status === 'success') {
                uiUtils.showToast('Новый порядок сохранён');
            } else {
                throw new Error(result.error || 'Неизвестная ошибка сервера');
            }
        })
        .catch(error => {
            window.Telegram.WebApp.showAlert('Не удалось сохранить новый порядок задач: ' + error.message);
            window.location.reload(); // В случае ошибки - откатываемся
        });
}