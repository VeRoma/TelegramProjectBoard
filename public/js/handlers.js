import * as api from './api.js';
import * as render from './ui/render.js';
import * as modals from './ui/modals.js';
import * as uiUtils from './ui/utils.js';
import * as store from './store.js';

export async function handleSaveActiveTask() {
    const activeEditElement = document.querySelector('.task-details.edit-mode');
    if (!activeEditElement) return;
    uiUtils.showMessage('Функция редактирования в разработке.', 'info');
}

export function handleShowAddTaskModal() {
    const appData = store.getAppData();
    modals.openAddTaskModal(store.getAllProjects(), store.getAllEmployees(), appData.userRole, appData.userName);
    uiUtils.updateFabButtonUI(true, handleSaveNewTaskClick);
}

export async function handleCreateTask(taskData) {
    // ... (код этой функции остается без изменений)
}

export async function handleStatusUpdate(taskId, newStatusName) {
    // Защита от неопределенного ID задачи. Ошибка возникает в вызывающем коде (вероятно, modals.js).
    // Проверяем на undefined, null, и строку "undefined", чтобы перехватить некорректные данные из modals.js
    if (!taskId || taskId === 'undefined') {
        console.error("[CLIENT ERROR] handleStatusUpdate вызвана с неверным ID задачи. Полученный ID:", taskId, ". Вероятная ошибка в логике модального окна (modals.js).");
        uiUtils.showMessage('Произошла внутренняя ошибка (ID задачи не найден).', 'error');
        return;
    }

    console.log(`[CLIENT LOG] handleStatusUpdate called. Task ID: ${taskId}, New Status: ${newStatusName}`);
    
    const appData = store.getAppData();
    const { task, project } = store.findTask(taskId);
    if (!task || !project) {
        console.error("[CLIENT ERROR] Task not found in store for ID:", taskId);
        return;
    }
    
    const oldStatus = task.status;
    const oldPriority = task.priority;
    
    const isLimitedView = !['owner', 'admin'].includes(appData.userRole);
    const allTasksForScope = isLimitedView 
        ? appData.projects.flatMap(p => p.tasks)
        : project.tasks;
    
    const tasksInOldGroup = allTasksForScope.filter(t => t.status === oldStatus && t.taskId !== task.taskId);
    // Сохраняем старые приоритеты для возможного отката
    const oldGroupPriorities = new Map(tasksInOldGroup.map(t => [t.taskId, t.priority]));

    task.status = newStatusName;
    
    if (newStatusName === 'Выполнено') {
        task.priority = 999;
    } else {
        const tasksInNewGroup = allTasksForScope.filter(t => t.status === newStatusName && t.taskId !== task.taskId);
        const maxPriority = Math.max(0, ...tasksInNewGroup.map(t => t.priority));
        task.priority = maxPriority + 1;
    }
    tasksInOldGroup.sort((a, b) => a.priority - b.priority).forEach((t, index) => {
        t.priority = index + 1;
    });

    const accordionState = uiUtils.getAccordionState();
    render.renderProjects(appData.projects, appData.userName, appData.userRole, accordionState);
    uiUtils.showMessage('Статус обновлён, идет сохранение...', 'info');
    
    // Создаем Map для быстрого поиска ID статуса по имени (O(1) вместо O(n))
    const statusMap = new Map(store.getAllStatuses().map(s => [s.name, s.statusId]));

    const tasksToUpdate = [...tasksInOldGroup, task].map(t => {
        return {
            taskId: t.taskId,
            priority: t.priority,
            statusId: statusMap.get(t.status)
        };
    });

    const rollbackAction = () => {
        task.status = oldStatus;
        task.priority = oldPriority;
        tasksInOldGroup.forEach(t => {
            // Восстанавливаем приоритеты для всех затронутых задач в старой группе
            t.priority = oldGroupPriorities.get(t.taskId);
        });
    };

    await savePrioritiesWithRollback(tasksToUpdate, appData.userName, rollbackAction);
}

export async function handleDragDrop(groupName, updatedTaskIdsInGroup, userRole) {
    const appData = store.getAppData();
    let tasksForScope;

    const isLimitedView = !['owner', 'admin'].includes(userRole);
    if (isLimitedView) {
        tasksForScope = appData.projects.flatMap(p => p.tasks);
    } else {
        const projectData = appData.projects.find(p => p.name === groupName);
        if (!projectData) {
            console.error(`[CLIENT ERROR] Project "${groupName}" not found for drag-drop!`);
            return;
        }
        tasksForScope = projectData.tasks;
    }

    const taskMap = new Map(tasksForScope.map(t => [t.taskId.toString(), t]));
    // Сохраняем старые приоритеты для возможного отката
    const oldPriorities = new Map(tasksForScope.map(t => [t.taskId.toString(), t.priority]));

    const tasksToUpdate = updatedTaskIdsInGroup.map((id, index) => {
        const task = taskMap.get(id);
        if (task) {
            // Оптимистичное обновление приоритета в локальном состоянии
            task.priority = index + 1;
            return { taskId: task.taskId, priority: task.priority, statusId: task.statusId };
        }
        return null;
    }).filter(Boolean);
    
    if (tasksToUpdate.length > 0) {
        uiUtils.showMessage('Идет сохранение нового порядка задач...', 'info');

        const rollbackAction = () => {
            updatedTaskIdsInGroup.forEach(id => {
                const task = taskMap.get(id);
                if (task) {
                    task.priority = oldPriorities.get(id);
                }
            });
        };

        await savePrioritiesWithRollback(tasksToUpdate, appData.userName, rollbackAction);
    }
}

/**
 * Отправляет обновленные приоритеты на сервер и обрабатывает откат в случае ошибки.
 * @param {Array<Object>} tasksToUpdate - Массив задач для обновления.
 * @param {string} modifierName - Имя пользователя, вносящего изменения.
 * @param {Function} rollbackAction - Функция для отката изменений в локальном хранилище.
 */
async function savePrioritiesWithRollback(tasksToUpdate, modifierName, rollbackAction) {
    try {
        console.log('[CLIENT LOG] Sending data to /updatepriorities:', tasksToUpdate);
        const result = await api.updatePriorities({ tasks: tasksToUpdate, modifierName });
        if (result.status !== 'success') {
            throw new Error(result.error || 'Ошибка сохранения на сервере');
        }
        uiUtils.showMessage('Сохранение завершено', 'success');
    } catch (error) {
        console.error('[CLIENT ERROR] Failed to update priorities:', error);
        uiUtils.showMessage('Не удалось сохранить изменения: ' + error.message, 'error');
        
        // Выполняем откат
        if (typeof rollbackAction === 'function') {
            rollbackAction();
        }

        // Повторная отрисовка UI с восстановленным состоянием
        const appData = store.getAppData();
        const accordionState = uiUtils.getAccordionState();
        render.renderProjects(appData.projects, appData.userName, appData.userRole, accordionState);
    }
}

export function handleSaveNewTaskClick() {
    // ... (код этой функции остается без изменений)
}
