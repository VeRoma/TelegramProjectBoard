import * as store from '../store.js';

function renderTaskCard(task, isUserView, statuses) {
    const taskDataString = JSON.stringify(task).replace(/'/g, '&apos;');
    const headerTopLine = isUserView ? task.project : (task.curator || 'Не назначен');
    const statusIcon = (statuses.find(s => s.name === task.status) || {}).icon || '';

    // --- ИЗМЕНЕНИЕ: Убираем класс .card и внешнюю обертку. Теперь это просто контейнер задачи. ---
    return `<div class="task-container" draggable="true" data-task-id="${task.taskId}" data-status-group="${task.status}">
                <div class="task-header flex justify-between items-center gap-3 cursor-pointer select-none">
                    <div class="flex-grow min-w-0">
                        <p class="text-xs pointer-events-none" style="color: var(--tg-theme-hint-color);">${headerTopLine}</p>
                        <p class="font-medium pointer-events-none line-clamp-2">${task.name}</p>
                    </div>
                    <div class="task-status-checker status-action-area" data-status="${task.status}">
                        ${statusIcon}
                    </div>
                </div>
                <div id="task-details-${task.taskId}" class="task-details collapsible-content" data-version="${task.version}" data-task='${taskDataString}'></div>
            </div>`;
}

export function renderProjects(projects, userName, userRole, expandedState = {}, filters = {}) {
    const mainContainer = document.getElementById('main-content');
    const projectsContainer = document.createElement('div');
    projectsContainer.id = 'projects-container';
    projectsContainer.className = 'space-y-4';

    const statuses = store.getAllStatuses();

    if (!projects || projects.length === 0) {
        mainContainer.innerHTML = `<div class="p-4 rounded-lg text-center" style="background-color: var(--tg-theme-secondary-bg-color);">Проекты не найдены.</div>`;
        return;
    }
    
    // --- НАЧАЛО ИСПРАВЛЕНИЙ: ЕДИНАЯ ЛОГИКА ДЛЯ ВСЕХ РОЛЕЙ ---
    
    // Перебираем проекты, которые уже отфильтрованы для текущего пользователя на сервере
    projects.forEach(project => {
        // Находим полные данные о проекте из общего списка (нужно для ID и кнопок управления)
        const allProjects = store.getAppData().allProjects || [];
        const fullProject = allProjects.find(p => p.projectName === project.name);

        if (!fullProject) return; // Пропускаем, если проект не найден
        
        // Не отображаем карточку проекта, если в нем нет задач для данного пользователя
        if (project.tasks.length === 0) return;

        const projectCard = document.createElement('div');
        projectCard.className = 'project-card card rounded-xl shadow-md overflow-hidden';

        let projectHtml = '';
        
        // Сортируем задачи внутри проекта
        project.tasks.sort((a, b) => {
            const orderA = (statuses.find(s => s.name === a.status) || { order: 99 }).order;
            const orderB = (statuses.find(s => s.name === b.status) || { order: 99 }).order;
            if (orderA !== orderB) return orderA - orderB;
            return (a.priority || 999) - (b.priority || 999);
        });

        // Группируем задачи по статусу
        const tasksByStatus = project.tasks.reduce((acc, task) => {
            if (!acc[task.status]) acc[task.status] = [];
            acc[task.status].push(task);
            return acc;
        }, {});
        
        const sortedStatusKeys = Object.keys(tasksByStatus).sort((a,b) => (statuses.find(s => s.name === a) || {}).order - (statuses.find(s => s.name === b) || {}).order);
        
        sortedStatusKeys.forEach(status => {
            const tasksInGroup = tasksByStatus[status];
            const statusIcon = (statuses.find(s => s.name === status) || {}).icon || '';
            const isUserView = !['admin', 'owner'].includes(userRole);

            projectHtml += `
                <div class="status-group p-2">
                    <h3 class="status-group-header text-sm font-bold p-2" style="color: var(--tg-theme-hint-color);">${statusIcon} ${status}</h3>
                    <div class="tasks-list space-y-2" data-status-group="${status}">
                        ${tasksInGroup.map(task => renderTaskCard(task, isUserView, statuses)).join('')}
                    </div>
                </div>
            `;
        });

        const title = project.name;
        const tasksInWorkCount = project.tasks.filter(t => t.status === 'В работе').length;
        const subtitle = `${tasksInWorkCount} задач в работе`;
        const isAdminOrOwner = userRole === 'admin' || userRole === 'owner';

        const manageMembersButton = isAdminOrOwner
            ? `<button class="manage-members-btn p-2 rounded-full absolute top-2 right-12 hover:bg-gray-200 dark:hover:bg-gray-700 z-10" data-project-id="${fullProject.projectId}" data-project-name="${fullProject.projectName}" title="Управлять участниками">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              </button>`
            : '';

        const manageStagesButton = isAdminOrOwner
            ? `<button class="manage-stages-btn p-2 rounded-full absolute top-2 right-2 hover:bg-gray-200 dark:hover:bg-gray-700 z-10" data-project-id="${fullProject.projectId}" data-project-name="${fullProject.projectName}" title="Настроить этапы">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0h6m-6 0H9m0 0h.01M13 19v-2a2 2 0 00-2-2h-2a2 2 0 00-2 2v2m8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2m4 0h.01"></path></svg>
              </button>`
            : '';

        projectCard.innerHTML = `
            <div class="project-header p-4 cursor-pointer">
                <div class="project-title-container">
                    <h2 class="font-bold text-lg pointer-events-none">${title}</h2>
                    <p class="text-sm mt-1 pointer-events-none" style="color: var(--tg-theme-hint-color);">${subtitle}</p>
                </div>
                <div class="project-actions">
                    ${manageMembersButton}
                    ${manageStagesButton}
                </div>
            </div>
            <div class="project-content collapsible-content">${projectHtml}</div>`;

        projectsContainer.appendChild(projectCard);
    });
    
    // --- КОНЕЦ ИСПРАВЛЕНИЙ ---
    
    mainContainer.innerHTML = '';
    mainContainer.appendChild(projectsContainer);

    if (Object.keys(expandedState).length > 0) {
        projectsContainer.querySelectorAll('.project-card').forEach(card => {
            const titleElement = card.querySelector('.project-header h2');
            if (titleElement) {
                const projectName = titleElement.textContent;
                if (expandedState[projectName] === true) {
                    const content = card.querySelector('.project-content');
                    if (content) content.classList.add('expanded');
                }
            }
        });
    }
}

export function renderTaskDetails(detailsContainer, userRole) {
    const task = JSON.parse(detailsContainer.dataset.task);

    // ИСПРАВЛЕНИЕ: Используем task.curator вместо task.responsible и меняем заголовок
    let responsibleFieldHtml = `
        <div>
            <label class="text-xs font-medium text-gray-500">Куратор</label>
            <div class="view-field mt-1">
                <p class="task-responsible-view">${task.curator || 'Не назначен'}</p>
            </div>
            <div class="edit-field modal-trigger-field mt-1 p-2 border rounded-md" data-modal-type="user" style="border-color: var(--tg-theme-hint-color);">
                <p class="task-responsible-view truncate pr-2">${task.curator || 'Выберите ответственных'}</p>
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
        </div>`;

    if (!['admin', 'owner'].includes(userRole)) {
        responsibleFieldHtml = `
        <div>
            <label class="text-xs font-medium text-gray-500">Куратор</label>
            <div class="view-field mt-1">
                <p class="task-responsible-view">${task.curator || 'Не назначен'}</p>
            </div>
        </div>`;
    }

    detailsContainer.innerHTML = `
        <div class="p-4 rounded-lg space-y-4 edit-container">
            <div class="flex justify-between items-start">
                <p class="font-bold text-lg view-field w-full">${task.name}</p>
                <div class="flex items-center ml-4 flex-shrink-0">
                    <button class="delete-btn p-2 rounded-full text-red-500"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                    <button class="edit-btn p-2 rounded-full ml-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"></path></svg></button>
                </div>
            </div>
            <div class="edit-field edit-field-block"><label class="text-xs font-medium text-gray-500">Наименование</label><input type="text" class="details-input task-name-edit mt-1" value="${task.name}"></div>
            <div><label class="text-xs font-medium text-gray-500">Сообщение исполнителю</label><p class="view-field whitespace-pre-wrap mt-1">${task.message || '...'}</p><textarea rows="3" class="edit-field edit-field-block details-input task-message-edit mt-1">${task.message || ''}</textarea></div>
            <div><label class="text-xs font-medium text-gray-500">Статус</label>
                <div class="view-field mt-1"><p class="task-status-view">${task.status}</p></div>
                <div class="edit-field modal-trigger-field mt-1 p-2 border rounded-md" data-modal-type="status" style="border-color: var(--tg-theme-hint-color);"><p class="task-status-view">${task.status}</p><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
            </div>
            <div><label class="text-xs font-medium text-gray-500">Проект</label>
                <div class="view-field mt-1"><p class="task-project-view">${task.project}</p></div>
                <div class="edit-field modal-trigger-field mt-1 p-2 border rounded-md" data-modal-type="project" style="border-color: var(--tg-theme-hint-color);"><p class="task-project-view">${task.project}</p><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500">Этап</label>
                <div class="view-field mt-1"><p class="task-stage-view">${store.getStageNameById(task.stageId) || 'Не назначен'}</p></div>
                <div class="edit-field modal-trigger-field mt-1 p-2 border rounded-md" data-modal-type="stage" style="border-color: var(--tg-theme-hint-color);"><p class="task-stage-view">${store.getStageNameById(task.stageId) || 'Не назначен'}</p><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
            </div>
            ${responsibleFieldHtml}
            <div class="text-xs mt-2" style="color: var(--tg-theme-hint-color);">
                <span>Последнее изменение: ${task.modifiedBy || 'N/A'} (${task.modifiedAt || 'N/A'})</span>
            </div>
        </div>`;
}

/**
 * Рендерит плоский список всех задач, сгруппированных по статусу.
 * @param {object[]} allTasks - Массив всех задач.
 * @param {object[]} statuses - Справочник статусов.
 */
export function renderTasksView(tasks, statuses, isMyTasksView = false) {
    const mainContainer = document.getElementById('main-content');
    const tasksContainer = document.createElement('div');
    tasksContainer.id = 'tasks-list-container';
    tasksContainer.className = 'space-y-4';

    if (!tasks || tasks.length === 0) {
        const message = isMyTasksView 
            ? 'У вас нет назначенных задач.' 
            : 'Задачи не найдены.';
        mainContainer.innerHTML = `<div class="p-4 rounded-lg text-center" style="background-color: var(--tg-theme-secondary-bg-color);">${message}</div>`;
        return;
    }

    tasks.sort((a, b) => {
        const orderA = (statuses.find(s => s.name === a.status) || { order: 99 }).order;
        const orderB = (statuses.find(s => s.name === b.status) || { order: 99 }).order;
        if (orderA !== orderB) return orderA - orderB;
        return (a.priority || 999) - (b.priority || 999);
    });

    const tasksByStatus = tasks.reduce((acc, task) => {
        const status = task.status || 'Неизвестный статус';
        if (!acc[status]) {
            acc[status] = [];
        }
        acc[status].push(task);
        return acc;
    }, {});
    
    const sortedStatusKeys = Object.keys(tasksByStatus).sort((a,b) => {
        const orderA = (statuses.find(s => s.name === a) || { order: 99 }).order;
        const orderB = (statuses.find(s => s.name === b) || { order: 99 }).order;
        return orderA - orderB;
    });
    
    let viewHtml = '';
    sortedStatusKeys.forEach(status => {
        const tasksInGroup = tasksByStatus[status];
        const statusInfo = statuses.find(s => s.name === status) || {};
        
        // --- ИЗМЕНЕНИЕ: Оборачиваем каждую группу в свою карточку ---
        viewHtml += `
            <div class="card rounded-xl shadow-md overflow-hidden">
                <div class="status-group p-3">
                    <h3 class="status-group-header text-sm font-bold p-2" style="color: var(--tg-theme-hint-color);">
                        ${statusInfo.icon || ''} ${status}
                    </h3>
                    <div class="tasks-list space-y-2" data-status-group="${status}">
                        ${tasksInGroup.map(task => renderTaskCard(task, true, statuses)).join('')}
                    </div>
                </div>
            </div>
        `;
    });
    
    tasksContainer.innerHTML = viewHtml;
    mainContainer.innerHTML = '';
    mainContainer.appendChild(tasksContainer);
}