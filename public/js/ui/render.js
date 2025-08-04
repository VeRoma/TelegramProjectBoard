import { STATUSES } from '../data/statuses.js';

function renderTaskCard(task, isUserView) {
    const taskDataString = JSON.stringify(task).replace(/'/g, '&apos;');
    const headerTopLine = isUserView ? task.project : (task.responsible || 'Не назначен');
    const statusIcon = (STATUSES.find(s => s.name === task.status) || {}).icon || '';

    return `<div class="card rounded-xl shadow-md overflow-hidden" draggable="true" data-task-id="${task.rowIndex}" data-status-group="${task.status}">
                <div class="task-header p-3 flex justify-between items-center gap-3 cursor-pointer select-none">
                    <div class="flex-grow min-w-0">
                        <p class="text-xs pointer-events-none" style="color: var(--tg-theme-hint-color);">${headerTopLine}</p>
                        <p class="font-medium pointer-events-none line-clamp-2">${task.name}</p>
                    </div>
                    <div class="task-status-checker status-action-area" data-status="${task.status}">
                        ${statusIcon}
                    </div>
                </div>                
                <div id="task-details-${task.rowIndex}" class="task-details collapsible-content px-4 pb-4" data-version="${task.version}" data-task='${taskDataString}'></div>
            </div>`;
}

export function renderProjects(projects, userName, userRole) {
    const appHeader = document.getElementById('app-header');
    const mainContainer = document.getElementById('main-content');
    appHeader.classList.add('hidden-header');
    const projectsContainer = document.createElement('div');
    projectsContainer.id = 'projects-container';
    projectsContainer.className = 'space-y-4';

    if (!projects || projects.length === 0) {
        mainContainer.innerHTML = `<div class="p-4 rounded-lg text-center" style="background-color: var(--tg-theme-secondary-bg-color);">Проекты не найдены.</div>`;
        return;
    }

    const isUserView = userRole === 'user';
    
    if (isUserView) {
        // --- ИСПРАВЛЕНИЕ: Собираем все задачи в один массив ДО сортировки ---
        let allUserTasks = projects.flatMap(p => p.tasks)
            .filter(task => task.status !== 'Выполнено');

        if (allUserTasks.length === 0) {
            mainContainer.innerHTML = `<div class="p-4 rounded-lg text-center" style="background-color: var(--tg-theme-secondary-bg-color);">Активных задач не найдено.</div>`;
            return;
        }

        allUserTasks.sort((a, b) => {
            const orderA = (STATUSES.find(s => s.name === a.status) || { order: 99 }).order;
            const orderB = (STATUSES.find(s => s.name === b.status) || { order: 99 }).order;
            if (orderA !== orderB) return orderA - orderB;
            return (a.priority || 999) - (b.priority || 999);
        });

        const tasksByStatus = allUserTasks.reduce((acc, task) => {
            if (!acc[task.status]) acc[task.status] = [];
            acc[task.status].push(task);
            return acc;
        }, {});
        
        const sortedStatusKeys = Object.keys(tasksByStatus).sort((a,b) => (STATUSES.find(s => s.name === a) || {}).order - (STATUSES.find(s => s.name === b) || {}).order);
        
        let userHtml = '';
        sortedStatusKeys.forEach(status => {
            const tasksInGroup = tasksByStatus[status];
            const statusIcon = (STATUSES.find(s => s.name === status) || {}).icon || '';
            userHtml += `
                <div class="status-group p-2">
                    <h3 class="status-group-header text-sm font-bold p-2" style="color: var(--tg-theme-hint-color);">${statusIcon} ${status}</h3>
                    <div class="tasks-list space-y-2" data-status-group="${status}">
                        ${tasksInGroup.map(task => renderTaskCard(task, true)).join('')}
                    </div>
                </div>
            `;
        });
        projectsContainer.innerHTML = userHtml;
    } else { // Вид для admin/owner
        projects.forEach(project => {
            project.tasks.sort((a, b) => {
                const orderA = (STATUSES.find(s => s.name === a.status) || { order: 99 }).order;
                const orderB = (STATUSES.find(s => s.name === b.status) || { order: 99 }).order;
                if (orderA !== orderB) return orderA - orderB;
                return (a.priority || 999) - (b.priority || 999);
            });

            if (project.tasks.length === 0) return;

            const projectCard = document.createElement('div');
            projectCard.className = 'card rounded-xl shadow-md overflow-hidden';
            
            const tasksByStatus = project.tasks.reduce((acc, task) => {
                if (!acc[task.status]) acc[task.status] = [];
                acc[task.status].push(task);
                return acc;
            }, {});
            const sortedStatusKeys = Object.keys(tasksByStatus).sort((a,b) => (STATUSES.find(s => s.name === a) || {}).order - (STATUSES.find(s => s.name === b) || {}).order);

            let projectHtml = '';
            sortedStatusKeys.forEach(status => {
                const tasksInGroup = tasksByStatus[status];
                const statusIcon = (STATUSES.find(s => s.name === status) || {}).icon || '';
                projectHtml += `
                    <div class="status-group p-2">
                        <h3 class="status-group-header text-sm font-bold p-2" style="color: var(--tg-theme-hint-color);">${statusIcon} ${status}</h3>
                        <div class="tasks-list space-y-2" data-status-group="${status}">
                            ${tasksInGroup.map(task => renderTaskCard(task, false)).join('')}
                        </div>
                    </div>
                `;
            });
            
            const tasksInWorkCount = project.tasks.filter(t => t.status === 'В работе').length;
            const projectTasksInfo = `${tasksInWorkCount} задач в работе`;

            projectCard.innerHTML = `
                <div class="project-header p-4 cursor-pointer">
                    <h2 class="font-bold text-lg pointer-events-none">${project.name}</h2>
                    <p class="text-sm mt-1 pointer-events-none" style="color: var(--tg-theme-hint-color);">${projectTasksInfo}</p>
                </div>
                <div class="project-content">${projectHtml}</div>`;
            projectsContainer.appendChild(projectCard);
        });
    }
    mainContainer.innerHTML = '';
    mainContainer.appendChild(projectsContainer);
}

export function renderTaskDetails(detailsContainer) {
    const task = JSON.parse(detailsContainer.dataset.task);
    detailsContainer.innerHTML = `
        <div class="p-4 rounded-lg space-y-4 edit-container">
            <input type="hidden" class="task-row-index" value="${task.rowIndex}">
            <div class="flex justify-between items-start">
                <p class="font-bold text-lg view-field w-full">${task.name}</p>
                <button class="edit-btn p-2 rounded-full ml-4 flex-shrink-0"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"></path></svg></button>
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
            <div><label class="text-xs font-medium text-gray-500">Ответственный</label>
                <div class="view-field mt-1"><p class="task-responsible-view">${task.responsible || '...'}</p></div>
                <div class="edit-field modal-trigger-field mt-1 p-2 border rounded-md" data-modal-type="employee" style="border-color: var(--tg-theme-hint-color);"><p class="task-responsible-view truncate pr-2">${task.responsible || '...'}</p><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
            </div>
            <div class="text-xs mt-2" style="color: var(--tg-theme-hint-color);">
                <span>Последнее изменение: ${task.modifiedBy || 'N/A'} (${task.modifiedAt || 'N/A'})</span>
            </div>
        </div>`;
}