import { STATUSES } from '../data/statuses.js';
import * as uiUtils from './utils.js';
import * as handlers from '../handlers.js';

const statusModal = document.getElementById('status-modal');
const employeeModal = document.getElementById('employee-modal');
const projectModal = document.getElementById('project-modal');
const addTaskModal = document.getElementById('add-task-modal');

export function openStatusModal(activeTaskDetailsElement) {
    document.body.classList.add('overflow-hidden');
    
    statusModal.innerHTML = `
        <div class="modal-content modal-content-compact">
            <div class="modal-body p-2">
                ${STATUSES.map(status => `
                    <div class="status-option flex items-center p-3 rounded-lg hover:bg-gray-200 cursor-pointer" data-status-value="${status.name}">
                        <span class="text-2xl w-8 text-center">${status.icon}</span>
                        <span class="text-lg ml-3">${status.name}</span>
                    </div>
                `).join('')}
            </div>
        </div>`;
        
    statusModal.classList.add('active');
    statusModal.dataset.targetElement = `#${activeTaskDetailsElement.id || (activeTaskDetailsElement.id = `task-${Date.now()}`)}`;
}

export function openEmployeeModal(activeTaskDetailsElement, allEmployees) {
    document.body.classList.add('overflow-hidden');
    const currentResponsible = activeTaskDetailsElement.querySelector('.task-responsible-view').textContent.split(',').map(n => n.trim());
    const userEmployees = allEmployees.filter(e => e.role === 'user').map(e => e.name);
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

export function openAddTaskModal(allProjects, allEmployees, userRole, userName) {
    document.body.classList.add('overflow-hidden');
    const tg = window.Telegram.WebApp;
    const projectsOptions = allProjects.map(p => `<option value="${p}">${p}</option>`).join('');
    
    let responsibleHtml = '';
    if (userRole !== 'user') {
        const userEmployees = allEmployees.filter(e => e.role === 'user');
        const employeesCheckboxes = userEmployees.map(e => `<label class="flex items-center space-x-3 p-3 rounded-md hover:bg-gray-200"><input type="checkbox" value="${e.name}" class="employee-checkbox w-4 h-4 rounded"><span>${e.name}</span></label>`).join('');
        responsibleHtml = `
            <div>
                <label class="text-xs font-medium text-gray-500">Ответственные</label>
                <div class="modal-body-employee mt-1 border rounded-md p-2">${employeesCheckboxes}</div>
            </div>`;
    }
    
    // --- ИЗМЕНЕНИЯ: textarea и удаление кнопки "Создать" ---
    addTaskModal.innerHTML = `
        <div class="modal-content">
            <div class="p-4 border-b">
                <h3 class="text-lg font-bold">Новая задача</h3>
            </div>
            <div class="modal-body space-y-4">
                <div>
                    <label class="text-xs font-medium text-gray-500">Наименование</label>
                    <textarea id="new-task-name" rows="2" class="details-input mt-1" placeholder="Название задачи" required></textarea>
                </div>
                <div><label class="text-xs font-medium text-gray-500">Проект</label><select id="new-task-project" class="details-input mt-1" required><option value="" disabled selected>Выберите...</option>${projectsOptions}</select></div>
                <div>
                    <label class="text-xs font-medium text-gray-500">Статус</label>
                    <div id="new-task-status-toggle" class="status-toggle">
                        <div class="toggle-option active" data-status="К выполнению"><span class="toggle-icon">📥</span><span class="toggle-text">К выполнению</span></div>
                        <div class="toggle-option" data-status="В работе"><span class="toggle-icon">⚒️</span><span class="toggle-text">В работе</span></div>
                        <div class="toggle-option" data-status="На контроле"><span class="toggle-icon">🔍</span><span class="toggle-text">На контроле</span></div>
                    </div>
                </div>
                <div>
                    <label class="text-xs font-medium text-gray-500">Сообщение исполнителю</label>
                    <textarea id="new-task-message" rows="2" class="details-input mt-1"></textarea>
                </div>
                ${responsibleHtml}
            </div>
            </div>`;
    addTaskModal.classList.add('active');

    const statusToggle = document.getElementById('new-task-status-toggle');
    if (statusToggle) {
        statusToggle.addEventListener('click', (e) => {
            const targetOption = e.target.closest('.toggle-option');
            if (targetOption) {
                statusToggle.querySelectorAll('.toggle-option').forEach(opt => opt.classList.remove('active'));
                targetOption.classList.add('active');
            }
        });
    }

    tg.BackButton.onClick(closeAddTaskModal);
    tg.BackButton.show();
}

// --- ИЗМЕНЕНИЕ: Сброс FAB-кнопки при закрытии окна ---
export function closeAddTaskModal() {
    const tg = window.Telegram.WebApp;
    addTaskModal.classList.remove('active');
    document.body.classList.remove('overflow-hidden');
    tg.BackButton.hide();
    tg.BackButton.offClick(closeAddTaskModal);
    // Возвращаем FAB к исходному состоянию
    uiUtils.updateFabButtonUI(false, handlers.handleSaveActiveTask, handlers.handleShowAddTaskModal);
}

// --- ИЗМЕНЕНИЕ: Убираем логику создания задачи отсюда ---
export function setupModals(onStatusChange, getEmployeesCallback) {
    const modals = [statusModal, employeeModal, projectModal, addTaskModal];
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                document.body.classList.remove('overflow-hidden');
            }
            if (modal.id === 'status-modal' && e.target.closest('.status-option')) {
                const selectedOption = e.target.closest('.status-option');
                const targetElement = document.querySelector(modal.dataset.targetElement);
                if (!targetElement) return;
                const rowIndex = targetElement.querySelector('.task-row-index').value;
                const newStatus = selectedOption.dataset.statusValue;
                onStatusChange(rowIndex, newStatus);
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
                    if (selected) targetElement.querySelector('.task-project-view').textContent = selected.value;
                }
                modal.classList.remove('active');
                document.body.classList.remove('overflow-hidden');
            }
        });
    });
}