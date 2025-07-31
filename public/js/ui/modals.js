import { STATUSES } from '../data/statuses.js';

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

export function openAddTaskModal(allProjects, allEmployees) {
    console.log('[modals.js] > openAddTaskModal вызвана.');
    document.body.classList.add('overflow-hidden');
    const tg = window.Telegram.WebApp;
    const projectsOptions = allProjects.map(p => `<option value="${p}">${p}</option>`).join('');
    const userEmployees = allEmployees.filter(e => e.role === 'user');
    const employeesCheckboxes = userEmployees.map(e => `<label class="flex items-center space-x-3 p-3 rounded-md hover:bg-gray-200"><input type="checkbox" name="responsible[]" value="${e.name}" class="employee-checkbox w-4 h-4 rounded"><span>${e.name}</span></label>`).join('');
    
    addTaskModal.innerHTML = `
        <div class="modal-content">
            <div class="p-4 border-b">
                <h3 class="text-lg font-bold">Новая задача</h3>
            </div>
            <form id="add-task-form" class="modal-body space-y-4">
                <div><label class="text-xs font-medium text-gray-500">Наименование</label><input type="text" name="name" class="details-input mt-1" placeholder="Название задачи" required></div>
                <div><label class="text-xs font-medium text-gray-500">Проект</label><select name="project" class="details-input mt-1" required><option value="" disabled selected>Выберите...</option>${projectsOptions}</select></div>
                <div>
                    <label class="text-xs font-medium text-gray-500">Статус</label>
                    <div id="new-task-status-toggle" class="status-toggle">
                        <div class="toggle-option active" data-status="В работе">В работе</div>
                        <div class="toggle-option" data-status="На контроле">На контроле</div>
                    </div>
                </div>
                <div><label class="text-xs font-medium text-gray-500">Сообщение исполнителю</label><textarea name="message" rows="3" class="details-input mt-1"></textarea></div>
                <div><label class="text-xs font-medium text-gray-500">Ответственные</label><div class="modal-body-employee mt-1 border rounded-md p-2">${employeesCheckboxes}</div></div>
            </form>
            <div class="p-2 border-t flex justify-end">
                <button type="submit" form="add-task-form" class="modal-select-btn px-4 py-2 rounded-lg">Создать</button>
            </div>
        </div>`;
    addTaskModal.classList.add('active');

    const statusToggle = document.getElementById('new-task-status-toggle');
    if (statusToggle) {
        statusToggle.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('toggle-option')) {
                statusToggle.querySelectorAll('.toggle-option').forEach(opt => opt.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    }

    tg.BackButton.onClick(closeAddTaskModal);
    tg.BackButton.show();
    console.log('[modals.js] > Модальное окно создания задачи отрисовано и показано.');
}

export function closeAddTaskModal() {
    const tg = window.Telegram.WebApp;
    addTaskModal.classList.remove('active');
    document.body.classList.remove('overflow-hidden');
    tg.BackButton.hide();
    tg.BackButton.offClick(closeAddTaskModal);
}

export function setupModals(onStatusChange, onCreateTask, getEmployeesCallback) {
    console.log('[modals.js] > setupModals вызвана. Установка обработчиков...');
    const modals = [statusModal, employeeModal, projectModal, addTaskModal];
    
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                document.body.classList.remove('overflow-hidden');
            }
            
            if (e.target.closest('.status-option')) {
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

    document.addEventListener('submit', (e) => {
        console.log('[modals.js] > Зафиксировано событие "submit".');
        if (e.target && e.target.id === 'add-task-form') {
            console.log('[modals.js] > Событие "submit" пришло от нашей формы #add-task-form.');
            e.preventDefault();
            const formData = new FormData(e.target);
            const taskName = formData.get('name');
            const projectName = formData.get('project');
            const responsibleNames = formData.getAll('responsible[]');
            const activeStatusElement = document.querySelector('#new-task-status-toggle .toggle-option.active');
            const status = activeStatusElement ? activeStatusElement.dataset.status : 'В работе';

            if (!taskName || !projectName || responsibleNames.length === 0) {
                window.Telegram.WebApp.showAlert('Пожалуйста, заполните все поля: Название, Проект и Ответственный.');
                return;
            }
            
            const allEmployees = getEmployeesCallback();
            const responsibleUsers = allEmployees.filter(emp => responsibleNames.includes(emp.name));
            const responsibleUserIds = responsibleUsers.map(emp => emp.userId);

            const taskData = {
                name: taskName,
                project: projectName,
                status: status,
                responsible: responsibleNames.join(', '),
                message: formData.get('message'),
                priority: 999,
                creatorId: window.currentUserId,
                responsibleUserIds: responsibleUserIds
            };
            console.log('[modals.js] > Данные собраны. Вызов onCreateTask с данными:', taskData);
            onCreateTask(taskData);
        } else {
             console.log('[modals.js] > Событие "submit" пришло НЕ от нашей формы. ID формы:', e.target.id);
        }
    });
    console.log('[modals.js] > Обработчики успешно установлены.');
}