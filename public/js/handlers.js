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
    const selectedEmployees = responsibleText ? responsibleText.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    // Ищем по taskId из data-атрибута родительской карточки
    const taskId = activeEditElement.closest('[data-task-id]').dataset.taskId;
    const { task: taskInAppData } = store.findTask(taskId);

    if (!taskInAppData) {
        uiUtils.showMessage('Не удалось найти исходную задачу для сохранения.', 'error');
        return;
    }

    const updatedTask = {
        ...taskInAppData,
        name: activeEditElement.querySelector('.task-name-edit').value,
        status: activeEditElement.querySelector('.task-status-view').textContent,
        project: activeEditElement.querySelector('.task-project-view').textContent,
        responsible: selectedEmployees,
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
            uiUtils.updateFabButtonUI(false, handleSaveActiveTask, handleShowAddTaskModal);
            
            const accordionState = uiUtils.getAccordionState();
            render.renderProjects(appData.projects, appData.userName, appData.userRole, accordionState);

        } else {
            if (result.error && result.error.includes("изменены другим пользователем")) {
                uiUtils.showMessage(result.error + ' Страница будет перезагружена.', 'error');
                setTimeout(() => window.location.reload(), 3000);
            } else {
                uiUtils.showMessage('Ошибка сохранения: ' + (result.error || 'Неизвестная ошибка'), 'error');
            }
        }
    } catch (error) {
        uiUtils.showMessage('Критическая ошибка сохранения: ' + error.message, 'error');
    }
}

export function handleShowAddTaskModal() {
    const appData = store.getAppData();
    modals.openAddTaskModal(store.getAllProjects(), store.getAllEmployees(), appData.userRole, appData.userName);
    uiUtils.updateFabButtonUI(true, handleSaveNewTaskClick);
}

export async function handleCreateTask(taskData) {
    const appData = store.getAppData();
    const isLimitedView = !['owner', 'admin'].includes(appData.userRole);

    const allTasksForScope = isLimitedView
        ? appData.projects.flatMap(p => p.tasks)
        : (appData.projects.find(p => p.name === taskData.project) || { tasks: [] }).tasks;

    const tasksInGroup = allTasksForScope.filter(t => t.status === taskData.status);
    const maxPriority = Math.max(0, ...tasksInGroup.map(t => t.priority));
    taskData.priority = maxPriority + 1;
    
    
    const tempTaskId = `temp_${Date.now()}`;
    const optimisticTask = { ...taskData, taskId: tempTaskId, version: 0 };
    let targetProject = appData.projects.find(p => p.name === optimisticTask.project);
    if (!targetProject) {
        targetProject = { name: optimisticTask.project, tasks: [] };
        appData.projects.push(targetProject);
    }
    targetProject.tasks.push(optimisticTask);
    modals.closeAddTaskModal();
    
    const accordionStateBefore = uiUtils.getAccordionState();
    render.renderProjects(appData.projects, appData.userName, appData.userRole, accordionStateBefore);
    uiUtils.showMessage('Задача добавлена, идет сохранение...', 'info');
    
    try {
        const result = await api.addTask({ newTaskData: taskData, creatorName: appData.userName });
        if (result.status === 'success' && result.task) {
            const finalTask = result.task;
            // Ищем по tempTaskId
            const taskToUpdate = targetProject.tasks.find(t => t.taskId === tempTaskId);
            if (taskToUpdate) Object.assign(taskToUpdate, finalTask);
            
            const accordionStateAfter = uiUtils.getAccordionState();
            render.renderProjects(appData.projects, appData.userName, appData.userRole, accordionStateAfter);
            uiUtils.showMessage('Задача успешно сохранена', 'success');

        } else {
            throw new Error(result.error || 'Неизвестная ошибка сервера');
        }
    } catch (error) {
        uiUtils.showMessage(`Не удалось сохранить задачу: ${error.message}. Обновляем список...`, 'error');
        setTimeout(() => window.location.reload(), 3000);
    }
}

// Теперь функция принимает taskId
export async function handleStatusUpdate(taskId, newStatusName) {
    const appData = store.getAppData();
    const { task, project } = store.findTask(taskId);
    if (!task || !project) return;
    
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
        // Сравниваем по taskId
        const tasksInNewGroup = allTasksForScope.filter(t => t.status === newStatusName && t.taskId !== task.taskId);
        const maxPriority = Math.max(0, ...tasksInNewGroup.map(t => t.priority));
        task.priority = maxPriority + 1;
    }
    const tasksInOldGroup = allTasksForScope.filter(t => t.status === oldStatus);
    tasksInOldGroup.sort((a, b) => a.priority - b.priority).forEach((t, index) => {
        t.priority = index + 1;
    });

    const accordionState = uiUtils.getAccordionState();
    render.renderProjects(appData.projects, appData.userName, appData.userRole, accordionState);
    uiUtils.showMessage('Статус обновлён, идет сохранение...', 'info');
    
    const statuses = store.getAllStatuses();

    // Собираем данные для обновления, используя taskId и statusId
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
        uiUtils.showMessage('Не удалось сохранить изменения: ' + error.message, 'error');
        task.status = oldStatus;
        task.priority = oldPriority;
        setTimeout(() => window.location.reload(), 3000);
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

    // Используем taskId как ключ
    const taskMap = new Map(tasksForScope.map(t => [t.taskId.toString(), t]));

    const tasksToUpdate = updatedTaskIdsInGroup.map((id, index) => {
        const task = taskMap.get(id);
        if (task) {
            task.priority = index + 1;
            // Передаем taskId и statusId
            return { taskId: task.taskId, priority: task.priority, statusId: task.statusId };
        }
    }).filter(Boolean);
    
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

export function handleSaveNewTaskClick() {
    const appData = store.getAppData();
    
    const taskName = document.getElementById('new-task-name')?.value;
    const projectName = document.getElementById('new-task-project')?.value;
    const activeStatusElement = document.querySelector('#new-task-status-toggle .toggle-option.active');
    const statusName = activeStatusElement ? activeStatusElement.dataset.status : 'К выполнению';

    const isLimitedView = !['owner', 'admin'].includes(appData.userRole);
    let responsibleNames = [];
    if (isLimitedView) {
        responsibleNames = [appData.userName];
    } else {
        const responsibleCheckboxes = document.querySelectorAll('#add-task-modal .employee-checkbox:checked');
        responsibleNames = [...responsibleCheckboxes].map(cb => cb.value);
    }

    if (!taskName || !projectName || (!isLimitedView && responsibleNames.length === 0)) {
        return uiUtils.showMessage('Пожалуйста, заполните поля: Наименование, Проект и Ответственный.', 'error');
    }

    const allEmployees = store.getAllEmployees();
    const responsibleUsers = allEmployees.filter(emp => responsibleNames.includes(emp.name));
    const responsibleUserIds = responsibleUsers.map(emp => emp.userId);
    
    const statuses = store.getAllStatuses();
    const statusId = (statuses.find(s => s.name === statusName) || {}).statusId;

    const allProjects = store.getAllProjects();
    const project = allProjects.find(p => p.projectName === projectName);
    const projectId = project ? project.projectId : null;

    const currentUser = allEmployees.find(e => e.name === appData.userName);
    const creatorId = currentUser ? currentUser.userId : null;

    handleCreateTask({
        name: taskName,
        project: projectName,
        projectId: projectId,
        status: statusName,
        statusId: statusId,
        responsible: responsibleNames.join(', '),
        creatorId: creatorId,
        responsibleUserIds: responsibleUserIds
    });
}