import * as api from './api.js';
import * as render from './ui/render.js';
import * as modals from './ui/modals.js';
import * as uiUtils from './ui/utils.js';
import * as store from './store.js';

export async function handleSaveActiveTask() {
    const activeEditElement = document.querySelector('.task-details.edit-mode');
    if (!activeEditElement) return;

    const appData = store.getAppData();
    const responsibleText = activeEditElement.querySelector('.task-responsible-view').textContent;
    const selectedUserNames = responsibleText ? responsibleText.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    const taskId = activeEditElement.closest('[data-task-id]').dataset.taskId;
    const { task: taskInAppData } = store.findTask(taskId);

    if (!taskInAppData) {
        uiUtils.showMessage('Не удалось найти исходную задачу для сохранения.', 'error');
        return;
    }

    const allUsers = store.getAllUsers();
    const responsibleUserIds = allUsers
        .filter(emp => selectedUserNames.includes(emp.name))
        .map(emp => emp.userId);

    const statuses = store.getAllStatuses();
    const statusName = activeEditElement.querySelector('.task-status-view').textContent;
    const statusId = (statuses.find(s => s.name === statusName) || {}).statusId;

    const allProjects = store.getAppData().allProjects;
    const projectName = activeEditElement.querySelector('.task-project-view').textContent;
    const project = allProjects.find(p => p.projectName === projectName);
    const projectId = project ? project.projectId : null;

    const stageName = activeEditElement.querySelector('.task-stage-view').textContent;
    const allStages = store.getAppData().allStages || [];
    const stage = allStages.find(s => s.name === stageName);
    const stageId = stage ? stage.stageId : null;

    const updatedTask = {
        ...taskInAppData,
        name: activeEditElement.querySelector('.task-name-edit').value,
        status: statusName,
        statusId: statusId,
        project: projectName,
        projectId: projectId,
        stageId: stageId,
        responsible: selectedUserNames.join(', '),
        responsibleUserIds: responsibleUserIds,
        version: parseInt(activeEditElement.dataset.version, 10),
    };

    try {
        const result = await api.saveTask({ taskData: updatedTask, modifierName: appData.userName });
        if (result.status === 'success') {
            uiUtils.showMessage('Изменения сохранены', 'success');
            Object.assign(taskInAppData, updatedTask, { version: result.newVersion });
            
            activeEditElement.dataset.task = JSON.stringify(taskInAppData).replace(/'/g, '&apos;');
            activeEditElement.dataset.version = result.newVersion;

            uiUtils.exitEditMode(activeEditElement);
            uiUtils.updateFabButtonUI(false, null, handleShowAddTaskModal);
            
            const accordionState = uiUtils.getAccordionState();
            render.renderProjects(appData.projects, appData.userName, appData.userRole, accordionState, store.getStageFilters());

        } else {
             uiUtils.showMessage('Ошибка сохранения: ' + (result.error || 'Неизвестная ошибка'), 'error');
        }
    } catch (error) {
        uiUtils.showMessage('Критическая ошибка сохранения: ' + error.message, 'error');
    }
}

export function handleShowAddTaskModal() {
    const appData = store.getAppData();
    modals.openAddTaskModal(store.getAllProjects(), store.getAllUsers(), appData.userRole, appData.userName);
    uiUtils.updateFabButtonUI(true, handleSaveNewTaskClick);
}

export async function handleCreateTask(taskData) {
    const appData = store.getAppData();
    const allProjects = store.getAppData().projects;
    const projectForTask = store.getAllProjects().find(p => p.projectId === taskData.projectId);
    const projectName = projectForTask ? projectForTask.projectName : '';

    const allTasksForScope = (allProjects.find(p => p.name === projectName) || { tasks: [] }).tasks;
    const tasksInGroup = allTasksForScope.filter(t => t.status === taskData.status);
    const maxPriority = Math.max(0, ...tasksInGroup.map(t => t.priority));
    taskData.priority = maxPriority + 1;
    
    const tempTaskId = `temp_${Date.now()}`;
    const optimisticTask = { ...taskData, taskId: tempTaskId, project: projectName, version: 0 };
    
    let targetProject = allProjects.find(p => p.name === optimisticTask.project);
    if (!targetProject) {
        targetProject = { name: optimisticTask.project, tasks: [] };
        allProjects.push(targetProject);
    }
    targetProject.tasks.push(optimisticTask);
    modals.closeAddTaskModal();
    
    const accordionStateBefore = uiUtils.getAccordionState();
    render.renderProjects(allProjects, appData.userName, appData.userRole, accordionStateBefore, store.getStageFilters());
    uiUtils.showMessage('Задача добавлена, идет сохранение...', 'info');
    
    try {
        const result = await api.addTask({ newTaskData: taskData, creatorName: appData.userName });
        if (result.status === 'success' && result.tasks && result.tasks.length > 0) {
            const finalTask = result.tasks[0];
            const taskToUpdate = targetProject.tasks.find(t => t.taskId === tempTaskId);
            if (taskToUpdate) {
                Object.assign(taskToUpdate, finalTask, { project: projectName });
            }
            
            const accordionStateAfter = uiUtils.getAccordionState();
            render.renderProjects(allProjects, appData.userName, appData.userRole, accordionStateAfter, store.getStageFilters());
            uiUtils.showMessage('Задача успешно сохранена', 'success');

        } else {
            throw new Error(result.error || 'Неизвестная ошибка сервера');
        }
    } catch (error) {
        uiUtils.showMessage(`Не удалось сохранить задачу: ${error.message}. Обновляем список...`, 'error');
        // setTimeout(() => window.location.reload(), 3000);
    }
}

export async function handleStatusUpdate(taskId, newStatusName) {
    const appData = store.getAppData();
    const { task, project } = store.findTask(taskId);
    if (!task || !project) {
        console.error("[HANDLERS.JS ERROR] Task not found in store for ID:", taskId);
        return;
    }
    
    const oldStatus = task.status;
    const oldPriority = task.priority;
    
    const isLimitedView = !['owner', 'admin'].includes(appData.userRole);

    const allTasksForScope = isLimitedView 
        ? appData.projects.flatMap(p => p.tasks)
        : project.tasks;
    
    task.status = newStatusName;
    
    if (newStatusName === 'Выполнено') {
        task.priority = 999;
    } else {
        const tasksInNewGroup = allTasksForScope.filter(t => t.status === newStatusName && t.taskId !== task.taskId);
        const maxPriority = Math.max(0, ...tasksInNewGroup.map(t => t.priority));   
        task.priority = maxPriority + 1;
    }
    const tasksInOldGroup = allTasksForScope.filter(t => t.status === oldStatus && t.taskId !== task.taskId);
    tasksInOldGroup.sort((a, b) => a.priority - b.priority).forEach((t, index) => {
        t.priority = index + 1;
    });

    const accordionState = uiUtils.getAccordionState();
    render.renderProjects(appData.projects, appData.userName, appData.userRole, accordionState, store.getStageFilters());
    uiUtils.showMessage('Статус обновлён, идет сохранение...', 'info');
    
    const statuses = store.getAllStatuses();
    const tasksToUpdate = [...tasksInOldGroup, task].map(t => {
        const statusId = (statuses.find(s => s.name === t.status) || {}).statusId;
        return {
            taskId: t.taskId,
            priority: t.priority,
            statusId: statusId
        };
    });

    try {
        const result = await api.updatePriorities({ tasks: tasksToUpdate, modifierName: appData.userName });
        if (result.status !== 'success') throw new Error(result.error || 'Ошибка сохранения');
        uiUtils.showMessage('Сохранение завершено', 'success');
    } catch (error) {
        console.error('[HANDLERS.JS ERROR] Failed to update priorities:', error);
        uiUtils.showMessage('Не удалось сохранить изменения: ' + error.message, 'error');
        task.status = oldStatus;
        task.priority = oldPriority;
    }
}

export function handleDragDrop(groupName, updatedTaskIdsInGroup, userRole) {
    const appData = store.getAppData();
    let tasksForScope;

    const isLimitedView = !['owner', 'admin'].includes(userRole);
    if (isLimitedView) {
        tasksForScope = appData.projects.flatMap(p => p.tasks);
    } else {
        const projectData = appData.projects.find(p => p.name === groupName);
        if (!projectData) {
            console.error(`[handleDragDrop] Проект "${groupName}" не найден!`);
            return;
        }
        tasksForScope = projectData.tasks;
    }

    const taskMap = new Map(tasksForScope.map(t => [t.taskId.toString(), t]));

    const tasksToUpdate = updatedTaskIdsInGroup.map((id, index) => {
        const task = taskMap.get(id);
        if (task) {
            task.priority = index + 1;
            return { taskId: task.taskId, priority: task.priority, statusId: task.statusId };
        }
        return null;
    }).filter(Boolean);
    
    if (tasksToUpdate.length > 0) {
        uiUtils.showMessage('Идет сохранение нового порядка задач...', 'info');
        
        api.updatePriorities({ tasks: tasksToUpdate, modifierName: appData.userName })
            .then(result => {
                if (result.status === 'success') {
                    uiUtils.showMessage('Сохранение завершено', 'success');
                } else {
                    throw new Error(result.error || 'Неизвестная ошибка сервера');
                }
            })
            .catch(error => {
                uiUtils.showMessage('Не удалось сохранить новый порядок задач: ' + error.message, 'error');
                setTimeout(() => window.location.reload(), 3000);
            });
    }
}

export function handleSaveNewTaskClick() {
    const appData = store.getAppData();
    
    const taskName = document.getElementById('new-task-name')?.value;
    const projectId = document.getElementById('new-task-project')?.value;
    const stageId = document.getElementById('new-task-stage')?.value;
    const activeStatusElement = document.querySelector('#new-task-status-toggle .toggle-option.active');
    const statusName = activeStatusElement ? activeStatusElement.dataset.status : 'К выполнению';

    const isLimitedView = !['owner', 'admin'].includes(appData.userRole);
    let responsibleNames = [];
    if (isLimitedView) {
        responsibleNames = [appData.userName];
    } else {
        const responsibleCheckboxes = document.querySelectorAll('#add-task-modal .user-checkbox:checked');
        responsibleNames = [...responsibleCheckboxes].map(cb => cb.value);
    }

    if (!taskName || !projectId || !stageId ) {
        return uiUtils.showMessage('Пожалуйста, заполните все поля: Наименование, Проект, и Этап.', 'error');
    }

    const allUsers = store.getAllUsers();
    const responsibleUsers = allUsers.filter(emp => responsibleNames.includes(emp.name));
    const responsibleUserIds = responsibleUsers.map(emp => emp.userId);
    
    const statuses = store.getAllStatuses();
    const statusId = (statuses.find(s => s.name === statusName) || {}).statusId;

    const currentUser = allUsers.find(u => u.name === appData.userName);
    const creatorId = currentUser ? currentUser.userId : null;

    handleCreateTask({
        name: taskName,
        projectId: projectId,
        status: statusName,
        statusId: statusId,
        stageId: stageId,
        responsible: responsibleNames.join(', '),
        creatorId: creatorId,
        responsibleUserIds: responsibleUserIds
    });
}

export async function handleDeleteTask(taskId) {
    if (!confirm('Вы уверены, что хотите удалить эту задачу?')) {
        return;
    }

    const appData = store.getAppData();
    try {
        uiUtils.showMessage('Удаление задачи...', 'info');
        const result = await api.deleteTask({ taskId: taskId, modifierName: appData.userName });

        if (result.status === 'success') {
            const { project } = store.findTask(taskId);
            if (project) {
                project.tasks = project.tasks.filter(t => t.taskId !== taskId);
            }
            
            const accordionState = uiUtils.getAccordionState();
            render.renderProjects(appData.projects, appData.userName, appData.userRole, accordionState, store.getStageFilters());
            uiUtils.showMessage('Задача успешно удалена', 'success');
        } else {
            throw new Error(result.error || 'Неизвестная ошибка сервера');
        }
    } catch (error) {
        uiUtils.showMessage(`Не удалось удалить задачу: ${error.message}`, 'error');
    }
}

export async function handleManageMembers(projectId, projectName) {
    try {
        const allUsers = store.getAllUsers();
        
        // ИСПРАВЛЕНИЕ: Убираем запрос к API
        // const currentMemberIds = await api.getProjectMembers(projectId);
        
        // Вместо этого, получаем ВСЕХ участников из store и фильтруем их локально
        const allProjectMembers = store.getAllProjectMembers();
        const currentMemberIds = allProjectMembers
            .filter(m => m.projectId == projectId && m.isActive === 'TRUE')
            .map(m => m.userId);

        // Если фоновая загрузка еще не завершилась, allProjectMembers будет пустым.
        // В этом случае, для надежности, можно сделать старый запрос. (Опционально, но рекомендуется)
        if (allProjectMembers.length === 0) {
            console.warn('[HANDLERS.JS] Background data not ready, falling back to API call for members.');
            uiUtils.showMessage('Загрузка участников...', 'info');
            const ids = await api.getProjectMembers(projectId);
            currentMemberIds.push(...ids);
        }

        modals.openManageMembersModal(projectName, allUsers, currentMemberIds);
        
        const saveBtn = document.getElementById('save-members-btn');
        saveBtn.replaceWith(saveBtn.cloneNode(true));
        document.getElementById('save-members-btn').addEventListener('click', () => {
             handleSaveMembers(projectId);
        });

    } catch (error) {
        uiUtils.showMessage(`Ошибка: ${error.message}`, 'error');
    }
}

async function handleSaveMembers(projectId) {
    const checkedBoxes = document.querySelectorAll('#members-modal-list .member-checkbox:checked');
    const newMemberIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    const appData = store.getAppData();
    
    try {
        uiUtils.showMessage('Сохранение...', 'info');
        const result = await api.updateProjectMembers(projectId, { 
            memberIds: newMemberIds, 
            modifierName: appData.userName 
        });

        if (result.status === 'success') {
            document.getElementById('manage-members-modal').classList.remove('active');
            uiUtils.showMessage('Список участников обновлен!', 'success');
            handleBackgroundDataFetch();
        } else {
            throw new Error(result.error || 'Неизвестная ошибка сервера');
        }
    } catch (error) {
         uiUtils.showMessage(`Ошибка сохранения: ${error.message}`, 'error');
    }
}

export async function handleManageStages(projectId, projectName) {
    try {
        const allStages = store.getAppData().allStages; // Полный справочник этапов

        // ИСПРАВЛЕНИЕ: Убираем запрос к API
        // const activeStageIds = store.getStageFilters()[projectId] || [];

        // Вместо этого, получаем ВСЕ активные этапы из store и фильтруем их локально
        const allProjectStages = store.getAllProjectStages();
        const activeStageIds = allProjectStages
            .filter(ps => ps.projectId == projectId && ps.isActive === 'TRUE')
            .map(ps => ps.stageId);

        // Опциональная проверка на случай, если фоновая загрузка не успела завершиться
        if (allProjectStages.length === 0 && store.getStageFilters()[projectId]) {
             console.warn('[HANDLERS.JS] Background data not ready, falling back to initial data for stages.');
             activeStageIds.push(...store.getStageFilters()[projectId]);
        }

        modals.openManageStagesModal(projectName, allStages, activeStageIds);
        
        const saveBtn = document.getElementById('save-stages-btn');
        saveBtn.replaceWith(saveBtn.cloneNode(true));
        document.getElementById('save-stages-btn').addEventListener('click', () => {
             handleSaveStages(projectId);
        });

    } catch (error) {
        uiUtils.showMessage(`Ошибка: ${error.message}`, 'error');
    }
}

async function handleSaveStages(projectId) {
    const checkedBoxes = document.querySelectorAll('#stages-modal-list .stage-checkbox:checked');
    const newStageIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    try {
        uiUtils.showMessage('Сохранение...', 'info');
        const result = await api.updateProjectStages(projectId, { stageIds: newStageIds });

        if (result.status === 'success') {
            document.getElementById('manage-stages-modal').classList.remove('active');
            uiUtils.showMessage('Список этапов обновлен!', 'success');
            handleBackgroundDataFetch();
            const appData = store.getAppData();
            const currentFilters = store.getStageFilters();
            currentFilters[projectId] = newStageIds;
            store.setStageFilters(currentFilters);
            
            const accordionState = uiUtils.getAccordionState();
            render.renderProjects(appData.projects, appData.userName, appData.userRole, accordionState, currentFilters);

        } else {
            throw new Error(result.error || 'Неизвестная ошибка сервера');
        }
    } catch (error) {
         uiUtils.showMessage(`Ошибка сохранения: ${error.message}`, 'error');
    }
}

// public/js/handlers.js

// --- НАЧАЛО ЗАМЕНЫ ФУНКЦИИ ---
export async function handleUpdateTaskMembers(targetElementId, curatorId, memberIds) {
    try {
        // --- КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ ЗДЕСЬ ---
        // Мы получаем 'task-details-1' и превращаем его в '1'
        const taskId = targetElementId.replace('task-details-', '');

        const appData = store.getAppData();
        const payload = {
            curatorId: curatorId,
            memberIds: memberIds,
            modifierName: appData.userName
        };

        // Отправляем на сервер уже правильный, чистый taskId
        const result = await api.updateTaskMembers(taskId, payload);

        if (result.status === 'success') {
            uiUtils.showMessage('Состав исполнителей обновлен!', 'success');
            // Временно перезагружаем все данные для обновления интерфейса
            auth.initializeApp();
        } else {
            throw new Error(result.error || 'Неизвестная ошибка сервера');
        }
    } catch (error) {
        console.error('Ошибка при обновлении исполнителей:', error);
        uiUtils.showMessage(error.message, 'error');
    }
}


/**
 * Обработчик для фоновой загрузки всех связей.
 * Не показывает сообщений пользователю, работает тихо.
 */


/**
 * Обработчик для фоновой загрузки всех связей.
 */
export async function handleBackgroundDataFetch() {
    try {
        const connections = await api.fetchAllConnections();
        store.setAllConnections(connections);
    } catch (error) {
        console.error('[BACKGROUND FETCH ERROR]', error);
    }
}