import { statuses } from './data/statuses.js';
import { employees } from './data/employees.js';

const mainContainer = document.getElementById('main-content');
const appHeader = document.getElementById('app-header');
const toast = document.getElementById('toast-notification');
const fabButton = document.getElementById('fab-button');
const fabIconContainer = document.getElementById('fab-icon-container');
const statusModal = document.getElementById('status-modal');
const employeeModal = document.getElementById('employee-modal');
const projectModal = document.getElementById('project-modal');
const addTaskModal = document.getElementById('add-task-modal');

const ICONS = {
    refresh: `<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="var(--tg-theme-button-text-color, #ffffff)" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
    save: `<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="var(--tg-theme-button-text-color, #ffffff)" stroke-width="2"><path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
    add: `<svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="var(--tg-theme-button-text-color, #ffffff)" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>`
};

let saveTimeout;

export function showToast(message) {
    toast.textContent = message;
    toast.style.bottom = '1.5rem';
    toast.style.opacity = '1';
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        toast.style.bottom = '-100px';
        toast.style.opacity = '0';
    }, 2500);
}

function getStatusSymbol(status) {
    const symbols = {
        'Выполнено': '✔',
        'Отменено': '✖',
        'В работе': '⚒',
        'Отложено': '⏳',
        'На контроле': '🔍'
    };
    return symbols[status] || '';
}

export function renderProjects(projects, userName) {
    appHeader.classList.add('hidden-header');
    mainContainer.innerHTML = '<div id="projects-container" class="space-y-4"></div>';
    const projectsContainer = document.getElementById('projects-container');

    if (!projects || projects.length === 0) {
        mainContainer.innerHTML = `<div class="p-4 rounded-lg text-center" style="background-color: var(--tg-theme-secondary-bg-color);">Проекты не найдены.</div>`;
        return;
    }

    const isUserView = projects.length === 1 && projects[0].name === userName;

    if (isUserView) {
        const userTasks = projects[0].tasks;
        if (!userTasks || userTasks.length === 0) {
            mainContainer.innerHTML = `<div class="p-4 rounded-lg text-center" style="background-color: var(--tg-theme-secondary-bg-color);">Задачи не найдены.</div>`;
            return;
        }

        userTasks.sort((a, b) => a.приоритет - b.приоритет);

        const tasksHtml = userTasks.map(task => {
            const taskDataString = JSON.stringify(task).replace(/'/g, '&apos;');
            return `<div class="card rounded-xl shadow-md overflow-hidden" draggable="true" data-task-id="${task.rowIndex}">
                        <div class="task-header p-3 flex justify-between items-center gap-3 cursor-pointer select-none">
                            <div class="flex-grow min-w-0">
                                <p class="text-xs pointer-events-none" style="color: var(--tg-theme-hint-color);">${task.project}</p>
                                <p class="font-medium pointer-events-none line-clamp-2">${task.name}</p>
                            </div>
                            <div class="task-status-checker status-action-area" data-status="${task.status}">
                                ${getStatusSymbol(task.status)}
                            </div>
                        </div>
                        <div id="task-details-${task.rowIndex}" class="task-details collapsible-content px-4 pb-4" data-task='${taskDataString}'></div>
                    </div>`;
        }).join('');
        projectsContainer.innerHTML = tasksHtml;

    } else {
        projects.forEach(project => {
            const projectCard = document.createElement('div');
            projectCard.className = 'card rounded-xl shadow-md overflow-hidden';
            
            project.tasks.sort((a, b) => a.приоритет - b.приоритет);
            
            let tasksHtml = project.tasks.map(task => {
                const taskDataString = JSON.stringify(task).replace(/'/g, '&apos;');
                return `<div class="task-container" draggable="true" data-task-id="${task.rowIndex}">
                            <div class="task-header p-3 flex justify-between items-center gap-3 cursor-pointer select-none">
                                <div class="flex-grow min-w-0">
                                    <p class="text-xs pointer-events-none" style="color: var(--tg-theme-hint-color);">${task.project}</p>
                                    <p class="font-medium pointer-events-none line-clamp-2">${task.name}</p>
                                </div>
                                <div class="task-status-checker status-action-area" data-status="${task.status}">
                                    ${getStatusSymbol(task.status)}
                                </div>
                            </div>
                            <div id="task-details-${task.rowIndex}" class="task-details collapsible-content px-4 pb-4" data-task='${taskDataString}'></div>
                        </div>`;
            }).join('');
            projectCard.innerHTML = `<div class="project-header p-4 cursor-pointer"><h2 class="font-bold text-lg pointer-events-none">${project.name}</h2><p class="text-sm mt-1 pointer-events-none" style="color: var(--tg-theme-hint-color);">РџСЂРѕРµРєС‚РѕРІ: ${project.tasks.length} задач(и)</p></div><div class="tasks-list collapsible-content expanded">${tasksHtml}</div>`;
            projectsContainer.appendChild(projectCard);
        });
    }
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
        </div>`;
}

export function openStatusModal(activeTaskDetailsElement) {
    document.body.classList.add('overflow-hidden');
    
    statusModal.innerHTML = `
        <div class="modal-content modal-content-compact">
            <div class="modal-body p-2">
                ${statuses.map(s => `
                    <div class="status-option flex items-center p-3 rounded-lg hover:bg-gray-200 cursor-pointer" data-status-value="${s}">
                        <span class="text-2xl w-8 text-center">${getStatusSymbol(s)}</span>
                        <span class="text-lg ml-3">${s}</span>
                    </div>
                `).join('')}
            </div>
        </div>`;
        
    statusModal.classList.add('active');
    statusModal.dataset.targetElement = `#${activeTaskDetailsElement.id || (activeTaskDetailsElement.id = `task-${Date.now()}`)}`;
}

export function openEmployeeModal(activeTaskDetailsElement) {
    document.body.classList.add('overflow-hidden');
    const currentResponsible = activeTaskDetailsElement.querySelector('.task-responsible-view').textContent.split(',').map(n => n.trim());
    const userEmployees = employees.filter(e => e.role === 'user').map(e => e.name);
    employeeModal.innerHTML = `<div class="modal-content"><div class="p-4 border-b" style="border-color: var(--tg-theme-hint-color);"><h3 class="text-lg font-bold">Выберите ответственных</h3></div><div class="modal-body modal-body-employee">${userEmployees.map(e => `<label class="flex items-center space-x-3 p-3 rounded-md hover:bg-gray-200"><input type="checkbox" value="${e}" ${currentResponsible.includes(e) ? 'checked' : ''} class="employee-checkbox w-4 h-4 rounded"><span>${e}</span></label>`).join('')}</div><div class="p-2 border-t flex justify-end" style="border-color: var(--tg-theme-hint-color);"><button class="modal-select-btn px-4 py-2 rounded-lg">Выбрать</button></div></div>`;
    employeeModal.classList.add('active');
    employeeModal.dataset.targetElement = `#${activeTaskDetailsElement.id || (activeTaskDetailsElement.id = `task-${Date.now()}`)}`;
}

export function openProjectModal(activeTaskDetailsElement, allProjects) {
    document.body.classList.add('overflow-hidden');
    const currentProject = activeTaskDetailsElement.querySelector('.task-project-view').textContent;
    projectModal.innerHTML = `<div class="modal-content"><div class="p-4 border-b" style="border-color: var(--tg-theme-hint-color);"><h3 class="text-lg font-bold">Выберите проект</h3></div><div class="modal-body">${allProjects.map(p => `<label class="flex items-center space-x-3 p-3 rounded-md hover:bg-gray-200"><input type="radio" name="project" value="${p}" ${p === currentProject ? 'checked' : ''} class="w-4 h-4"><span>${p}</span></label>`).join('')}</div><div class="p-2 border-t flex justify-end" style="border-color: var(--tg-theme-hint-color);"><button class="modal-select-btn px-4 py-2 rounded-lg">Выбрать</button></div></div>`;
    projectModal.classList.add('active');
    projectModal.dataset.targetElement = `#${activeTaskDetailsElement.id || (activeTaskDetailsElement.id = `task-${Date.now()}`)}`;
}

export function setupModals(onStatusChange) {
    [statusModal, employeeModal, projectModal, addTaskModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (modal.id === 'status-modal' && e.target.closest('.status-option')) {
                const selectedOption = e.target.closest('.status-option');
                const targetElement = document.querySelector(modal.dataset.targetElement);
                if (!targetElement) return;

                const rowIndex = targetElement.querySelector('.task-row-index').value;
                const newStatus = selectedOption.dataset.statusValue;
                
                onStatusChange(rowIndex, newStatus);
                
                modal.classList.remove('active');
                delete modal.dataset.targetElement;
                document.body.classList.remove('overflow-hidden');
                return;
            }

            if (e.target === modal) {
                if (modal.id === 'status-modal') {
                    const targetElement = document.querySelector(modal.dataset.targetElement);
                    if (targetElement && !targetElement.classList.contains('expanded')) {
                        targetElement.innerHTML = '';
                    }
                }
                modal.classList.remove('active');
                document.body.classList.remove('overflow-hidden');
            }
            
            if (e.target.closest('.modal-select-btn') && modal.id !== 'add-task-modal') {
                const targetElement = document.querySelector(modal.dataset.targetElement);
                if (!targetElement) return;

                if (modal.id === 'employee-modal') {
                    const selected = [...modal.querySelectorAll('.employee-checkbox:checked')].map(cb => cb.value);
                    targetElement.querySelector('.task-responsible-view').textContent = selected.join(', ');
                } else if (modal.id === 'project-modal') {
                   const selected = modal.querySelector('input[name="project"]:checked');
                    if (selected) {
                        targetElement.querySelector('.task-project-view').textContent = selected.value;
                    }
                }
                
                modal.classList.remove('active');
                delete modal.dataset.targetElement;
                document.body.classList.remove('overflow-hidden');
            }
        });
    });
}

export function showLoading() {
    document.getElementById('app').classList.remove('hidden');
    mainContainer.innerHTML = '<div class="text-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500 mx-auto mt-4"></div></div>';
}

export function showDataLoadError(error) {
    const errorMessage = typeof error === 'object' ? error.message : String(error);
    mainContainer.innerHTML = `<div class="p-4 bg-red-100 text-red-700 rounded-lg"><p class="font-bold">Ошибка загрузки</p><p class="text-sm mt-1">${errorMessage}</p></div>`;
}

export function updateFabButtonUI(isEditMode, saveHandler, addHandler) {
    const currentHandler = fabButton.onclick;
    if (currentHandler) {
        fabButton.removeEventListener('click', currentHandler);
    }
    
    if (isEditMode) {
        fabIconContainer.innerHTML = ICONS.save;
        fabButton.onclick = saveHandler;
    } else {
        fabIconContainer.innerHTML = ICONS.add;
        fabButton.onclick = addHandler;
    }
}

export function showAccessDeniedScreen() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('auth-blocker').classList.remove('hidden');
}

export function showRegistrationModal() {
    document.body.classList.add('overflow-hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('registration-modal').classList.add('active');
}

export function setupUserInfo(nameFromSheet) {
    const greetingElement = document.getElementById('greeting-text');
    const userIdElement = document.getElementById('user-id-text');
    const user = window.Telegram.WebApp.initDataUnsafe.user;
    if (user && user.id) {
        const displayName = nameFromSheet || user.first_name || 'пользователь';
        greetingElement.textContent = `Привет, ${displayName}!`;
        userIdElement.textContent = `Ваш ID: ${user.id}`;
    }
}

export function hideFab() {
    fabButton.style.display = 'none';
}

export function showFab() {
    if (fabButton.style.display === 'flex') return;
    fabButton.style.display = 'flex';
}

export function openAddTaskModal(allProjects, allEmployees) {
    document.body.classList.add('overflow-hidden');
    const tg = window.Telegram.WebApp;
    const projectsOptions = allProjects.map(p => `<option value="${p}">${p}</option>`).join('');
    
    const userEmployees = allEmployees.filter(e => e.role === 'user');
    const employeesCheckboxes = userEmployees.map(e => `<label class="flex items-center space-x-3 p-3 rounded-md hover:bg-gray-200"><input type="checkbox" value="${e.name}" class="employee-checkbox w-4 h-4 rounded"><span>${e.name}</span></label>`).join('');

    addTaskModal.innerHTML = `
        <div class="modal-content">
            <div class="p-4 border-b">
                <h3 class="text-lg font-bold">Новая задача</h3>
            </div>
            <div class="modal-body space-y-4">
                <div>
                    <label class="text-xs font-medium text-gray-500">Наименование</label>
                    <input type="text" id="new-task-name" class="details-input mt-1" placeholder="Название задачи">
                </div>
                <div>
                    <label class="text-xs font-medium text-gray-500">Проект</label>
                    <select id="new-task-project" class="details-input mt-1">${projectsOptions}</select>
                </div>
                <div>
                    <label class="text-xs font-medium text-gray-500">Сообщение исполнителю</label>
                    <textarea id="new-task-message" rows="3" class="details-input mt-1"></textarea>
                </div>
                <div>
                    <label class="text-xs font-medium text-gray-500">Ответственные</label>
                    <div class="modal-body-employee mt-1 border rounded-md p-2">${employeesCheckboxes}</div>
                </div>
            </div>
            <div class="p-2 border-t flex justify-end">
                <button id="add-task-btn" class="modal-select-btn px-4 py-2 rounded-lg">Создать</button>
            </div>
        </div>`;
    addTaskModal.classList.add('active');

    tg.BackButton.onClick(closeAddTaskModal);
    tg.BackButton.show();
}

export function closeAddTaskModal() {
    const tg = window.Telegram.WebApp;
    document.getElementById('add-task-modal').classList.remove('active');
    document.body.classList.remove('overflow-hidden');
    tg.BackButton.hide();
    tg.BackButton.offClick(closeAddTaskModal);
}

export function enterEditMode(detailsContainer, onBackCallback) {
    const tg = window.Telegram.WebApp;
    detailsContainer.classList.add('edit-mode');
    
    tg.BackButton.onClick(onBackCallback);
    tg.BackButton.show();
}

export function exitEditMode(detailsContainer) {
    const tg = window.Telegram.WebApp;
    if (detailsContainer) {
        detailsContainer.classList.remove('edit-mode');
    }
    
    tg.BackButton.hide();
    tg.BackButton.offClick(exitEditMode);
}