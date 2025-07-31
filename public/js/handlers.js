import * as api from './api.js';
import * as render from './ui/render.js';
import * as modals from './ui/modals.js';
import * as uiUtils from './ui/utils.js';
import * as store from './store.js';
import { STATUSES } from './data/statuses.js';

export async function handleSaveActiveTask() {
    const tg = window.Telegram.WebApp;
    const activeEditElement = document.querySelector('.task-details.edit-mode');
    if (!activeEditElement) return;

    const appData = store.getAppData();
    const responsibleText = activeEditElement.querySelector('.task-responsible-view').textContent;
    const selectedEmployees = responsibleText ? responsibleText.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    const { task: taskInAppData } = store.findTask(activeEditElement.querySelector('.task-row-index').value);
    if (!taskInAppData) {
        tg.showAlert('Не удалось найти исходную задачу для сохранения.');
        return;
    }

    const updatedTask = {
        ...taskInAppData,
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
            uiUtils.showToast('Изменения сохранены', 'success');
            tg.HapticFeedback.notificationOccurred('success');
            Object.assign(taskInAppData, updatedTask, {version: result.newVersion});
            uiUtils.exitEditMode(activeEditElement);
            uiUtils.updateFabButtonUI(false, handleSaveActiveTask, handleShowAddTaskModal);
            render.renderProjects(appData.projects, appData.userName, appData.userRole);
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
    modals.openAddTaskModal(store.getAllProjects(), store.getAllEmployees());
}

export async function handleCreateTask(taskData) {
    const tg = window.Telegram.WebApp;
    const appData = store.getAppData();
    const tempRowIndex = `temp_${Date.now()}`;
    const optimisticTask = { ...taskData, rowIndex: tempRowIndex, version: 0 };
    let targetProject = appData.projects.find(p => p.name === optimisticTask.project);

    if (!targetProject) {
        targetProject = { name: optimisticTask.project, tasks: [] };
        appData.projects.push(targetProject);
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
    const appData = store.getAppData();
    const { task, project } = store.findTask(rowIndex);
    if (!task || !project) return;
    
    const oldStatus = task.status;
    const oldPriority = task.priority;
    task.status = newStatus;
    
    // --- ИСПРАВЛЕННАЯ ЛОГИКА ---
    // Собираем все задачи для пересчета в зависимости от роли
    const allTasksForScope = (appData.userRole === 'user') 
        ? appData.projects.flatMap(p => p.tasks)
        : project.tasks;

    if (newStatus === 'Выполнено') {
        task.priority = 999;
    } else {
        const tasksInNewGroup = allTasksForScope.filter(t => t.status === newStatus && t.rowIndex !== task.rowIndex);
        const maxPriority = Math.max(0, ...tasksInNewGroup.map(t => t.priority));
        task.priority = maxPriority + 1;
    }
    const tasksInOldGroup = allTasksForScope.filter(t => t.status === oldStatus);
    tasksInOldGroup.sort((a, b) => a.priority - b.priority).forEach((t, index) => {
        t.priority = index + 1;
    });

    render.renderProjects(appData.projects, appData.userName, appData.userRole);
    uiUtils.showToast('Статус обновлён, идет сохранение...');
    
    const tasksToUpdate = [...tasksInOldGroup, task].map(t => ({
        rowIndex: t.rowIndex,
        priority: t.priority,
        status: t.status
    }));

    try {
        const result = await api.updatePriorities({tasks: tasksToUpdate, modifierName: appData.userName});
        if (result.status !== 'success') throw new Error(result.error || 'Ошибка сохранения');
        uiUtils.showToast('Сохранение завершено', 'success');
    } catch (error) {
        tg.showAlert('Не удалось сохранить изменения: ' + error.message);
        task.status = oldStatus;
        task.priority = oldPriority;
        window.location.reload();
    }
}

// --- ФИНАЛЬНАЯ ВЕРСИЯ DRAG-N-DROP ---
export function handleDragDrop(projectName, updatedTaskIdsInGroup) {
    const appData = store.getAppData();
    
    // --- ИСПРАВЛЕННАЯ ЛОГИКА ---
    // Вне зависимости от роли, мы всегда работаем с полным списком задач
    const allTasks = appData.projects.flatMap(p => p.tasks);
    const taskMap = new Map(allTasks.map(t => [t.rowIndex.toString(), t]));

    const tasksToUpdate = updatedTaskIdsInGroup.map((id, index) => {
        const task = taskMap.get(id);
        if (task) {
            task.priority = index + 1;
            return { rowIndex: task.rowIndex, priority: task.priority };
        }
    }).filter(Boolean);
    // print(tasksToUpdate);

    render.renderProjects(appData.projects, appData.userName, appData.userRole);
    uiUtils.showToast('Идет сохранение нового порядка задач...');
    
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
            window.location.reload();
        });
}

// Ваша отладочная функция
function print (message) {
    window.Telegram.WebApp.showAlert(JSON.stringify(message, null, 2), 'OK'); 
}