import * as state from './state.js';
const mainContainer = document.getElementById('main-content');
const appHeader = document.getElementById('app-header');
const toast = document.getElementById('toast-notification');
const fabButton = document.getElementById('fab-button');
const fabIconContainer = document.getElementById('fab-icon-container');
const statusModal = document.getElementById('status-modal');
const employeeModal = document.getElementById('employee-modal');

const ICONS = {
    refresh: `<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="var(--tg-theme-button-text-color, #ffffff)" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
    save: `<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="var(--tg-theme-button-text-color, #ffffff)" stroke-width="2"><path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" stroke-linecap="round" stroke-linejoin="round"></path></svg>`
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

export function renderProjects(projects) {
    appHeader.classList.add('hidden-header');
    mainContainer.innerHTML = '<div id="projects-container" class="space-y-4"></div>';
    const projectsContainer = document.getElementById('projects-container');
    if (!projects || projects.length === 0) {
        mainContainer.innerHTML = `<div class="p-4 rounded-lg text-center" style="background-color: var(--tg-theme-secondary-bg-color);">Проекты не найдены.</div>`;
        return;
    }
    projects.forEach(project => {
        const projectCard = document.createElement('div');
        projectCard.className = 'card rounded-xl shadow-md overflow-hidden';
        let tasksHtml = project.tasks.map(task => {
            const taskDataString = JSON.stringify(task).replace(/'/g, '&apos;');
            return `<div class="task-container border-t" style="border-color: var(--tg-theme-hint-color);"><div class="task-header p-4 cursor-pointer"><p class="font-medium pointer-events-none">${task.name}</p><p class="text-xs pointer-events-none" style="color: var(--tg-theme-hint-color);">${task.status}</p></div><div class="task-details collapsible-content px-4 pb-4" data-task='${taskDataString}'></div></div>`;
        }).join('');
        projectCard.innerHTML = `<div class="project-header p-4 cursor-pointer"><h2 class="font-bold text-lg pointer-events-none">${project.name}</h2><p class="text-sm mt-1 pointer-events-none" style="color: var(--tg-theme-hint-color);">${project.tasks.length} задач(и)</p></div><div class="tasks-list collapsible-content">${tasksHtml}</div>`;
        projectsContainer.appendChild(projectCard);
    });
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
            <div><label class="text-xs font-medium text-gray-500">Сообщение исполнителю</label><p class="view-field whitespace-pre-wrap mt-1">${task.message || '...'}</p><textarea rows="3" class="edit-field edit-field-block details-input task-message-edit mt-1">${task.message}</textarea></div>
            <div><label class="text-xs font-medium text-gray-500">Статус</label>
                <div class="view-field mt-1"><p class="task-status-view">${task.status}</p></div>
                <div class="edit-field modal-trigger-field mt-1 p-2 border rounded-md" data-modal-type="status" style="border-color: var(--tg-theme-hint-color);"><p class="task-status-view">${task.status}</p><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
            </div>
            <div><label class="text-xs font-medium text-gray-500">Ответственный</label>
                <div class="view-field mt-1"><p class="task-responsible-view">${task.responsible || '...'}</p></div>
                <div class="edit-field modal-trigger-field mt-1 p-2 border rounded-md" data-modal-type="employee" style="border-color: var(--tg-theme-hint-color);"><p class="task-responsible-view truncate pr-2">${task.responsible || '...'}</p><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
            </div>
        </div>`;
}

export function openStatusModal(activeTaskDetailsElement) {
    const currentStatus = activeTaskDetailsElement.querySelector('.task-status-view').textContent;
    statusModal.innerHTML = `<div class="modal-content"><div class="p-4 border-b" style="border-color: var(--tg-theme-hint-color);"><h3 class="text-lg font-bold">Выберите статус</h3></div><div class="modal-body">${state.availableStatuses.map(s => `<label class="flex items-center space-x-3 p-3 rounded-md hover:bg-gray-200"><input type="radio" name="status" value="${s}" ${s === currentStatus ? 'checked' : ''} class="w-4 h-4"><span>${s}</span></label>`).join('')}</div><div class="p-2 border-t flex justify-end" style="border-color: var(--tg-theme-hint-color);"><button class="modal-select-btn px-4 py-2 rounded-lg">Выбрать</button></div></div>`;
    statusModal.classList.add('active');
    statusModal.dataset.targetElement = `#${activeTaskDetailsElement.id || (activeTaskDetailsElement.id = `task-${Date.now()}`)}`;
}

export function openEmployeeModal(activeTaskDetailsElement) {
    const currentResponsible = activeTaskDetailsElement.querySelector('.task-responsible-view').textContent.split(',').map(n => n.trim());
    employeeModal.innerHTML = `<div class="modal-content"><div class="p-4 border-b" style="border-color: var(--tg-theme-hint-color);"><h3 class="text-lg font-bold">Выберите ответственных</h3></div><div class="modal-body modal-body-employee">${state.availableEmployees.map(e => `<label class="flex items-center space-x-3 p-3 rounded-md hover:bg-gray-200"><input type="checkbox" value="${e}" ${currentResponsible.includes(e) ? 'checked' : ''} class="employee-checkbox w-4 h-4 rounded"><span>${e}</span></label>`).join('')}</div><div class="p-2 border-t flex justify-end" style="border-color: var(--tg-theme-hint-color);"><button class="modal-select-btn px-4 py-2 rounded-lg">Выбрать</button></div></div>`;
    employeeModal.classList.add('active');
    employeeModal.dataset.targetElement = `#${activeTaskDetailsElement.id || (activeTaskDetailsElement.id = `task-${Date.now()}`)}`;
}

export function setupModals() {
    [statusModal, employeeModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('.modal-select-btn')) {
                const targetElement = document.querySelector(modal.dataset.targetElement);
                if (!targetElement) return;
                if (e.target.closest('.modal-select-btn')) {
                    if (modal.id === 'status-modal') {
                        const selected = modal.querySelector('input[name="status"]:checked');
                        if (selected) {
                            targetElement.querySelector('.task-status-view').textContent = selected.value;
                        }
                    } else if (modal.id === 'employee-modal') {
                        const selected = [...modal.querySelectorAll('.employee-checkbox:checked')].map(cb => cb.value);
                        targetElement.querySelector('.task-responsible-view').textContent = selected.join(', ');
                    }
                }
                modal.classList.remove('active');
                delete modal.dataset.targetElement;
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

export function updateFabButtonUI(isEditMode, saveHandler, refreshHandler) {
    const currentHandler = fabButton.onclick;
    if (currentHandler) {
        fabButton.removeEventListener('click', currentHandler);
    }
    
    if (isEditMode) {
        fabIconContainer.innerHTML = ICONS.save;
        fabButton.onclick = saveHandler;
    } else {
        fabIconContainer.innerHTML = ICONS.refresh;
        fabButton.onclick = refreshHandler;
    }
}

export function showAccessDeniedScreen() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('auth-blocker').classList.remove('hidden');
}

export function showRegistrationModal() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('registration-modal').classList.add('active');
}

export function setupUserInfo() {
    const greetingElement = document.getElementById('greeting-text');
    const userIdElement = document.getElementById('user-id-text');
    const user = window.Telegram.WebApp.initDataUnsafe.user;
    if (user && user.id) {
        greetingElement.textContent = `Привет, ${user.first_name || 'пользователь'}!`;
        userIdElement.textContent = `Ваш ID: ${user.id}`;
    }
}