import * as store from '../store.js';
import * as uiUtils from './utils.js';
import * as handlers from '../handlers.js';
import * as api from '../api.js';

const statusModal = document.getElementById('status-modal');
const employeeModal = document.getElementById('employee-modal');
const projectModal = document.getElementById('project-modal');
const addTaskModal = document.getElementById('add-task-modal');
const stageModal = document.getElementById('stage-modal');
const manageMembersModal = document.getElementById('manage-members-modal');
const manageStagesModal = document.getElementById('manage-stages-modal');

let statusModalContentLoaded = false;

export function openStageModal(activeTaskDetailsElement) {
    const taskData = JSON.parse(activeTaskDetailsElement.dataset.task);
    const projectId = taskData.projectId;
    const currentStageId = taskData.stageId;

    const activeStageIds = new Set((store.getStageFilters()[projectId] || []).map(String));
    const allStages = store.getAppData().allStages || [];

    const availableStages = allStages.filter(s => activeStageIds.has(String(s.stageId)));

    stageModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="font-bold">Выберите этап</h3>
                <button class="modal-close-btn">&times;</button>
            </div>
            <div class="modal-body">
                ${availableStages.map(stage => `
                    <label class="flex items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                        <input type="radio" name="stage" value="${stage.stageId}" ${stage.stageId == currentStageId ? 'checked' : ''} class="w-4 h-4">
                        <span class="ml-3">${stage.name}</span>
                    </label>
                `).join('')}
            </div>
            <div class="modal-footer">
                <button class="modal-select-btn px-4 py-2 rounded-lg">Выбрать</button>
            </div>
        </div>`;
    
    stageModal.classList.add('active');
    stageModal.dataset.targetElementId = activeTaskDetailsElement.id;
}

export function openStatusModal(taskId) {
    console.log(`[MODALS.JS LOG] openStatusModal received taskId: ${taskId}`);
    uiUtils.collapseAllTaskDetails();
    document.body.classList.add('overflow-hidden');
    
    if (!statusModalContentLoaded) {
        const statuses = store.getAllStatuses();
        statuses.sort((a, b) => a.order - b.order);

        statusModal.innerHTML = `
            <div class="modal-content modal-content-compact">
                <div class="modal-body p-2">
                    ${statuses.map(status => `
                        <div class="status-option flex items-center p-3 rounded-lg hover:bg-gray-200 cursor-pointer" data-status-value="${status.name}">
                            <span class="text-2xl w-8 text-center">${status.icon}</span>
                            <span class="text-lg ml-3">${status.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        statusModalContentLoaded = true;
    }
        
    statusModal.classList.add('active');
    statusModal.dataset.currentTaskId = taskId; 
}

export async function openEmployeeModal(activeTaskDetailsElement, allEmployees, userRole) {
    const taskData = JSON.parse(activeTaskDetailsElement.dataset.task);
    const projectId = taskData.projectId;
    const currentResponsibleText = activeTaskDetailsElement.querySelector('.task-responsible-view').textContent;
    const isLimitedView = !['owner', 'admin'].includes(userRole);

    if (isLimitedView) {
         employeeModal.innerHTML = `
            <div class="modal-content">
                <div class="p-4 border-b" style="border-color: var(--tg-theme-hint-color);">
                    <h3 class="text-lg font-bold">Ответственные</h3>
                </div>
                <div class="modal-body">
                    <p>${currentResponsibleText || 'Не назначены'}</p>
                </div>
            </div>`;
    } else {
        let employeesToShow = [];
        try {
            const memberIds = await api.getProjectMembers(projectId);
            const memberIdsSet = new Set(memberIds);
            employeesToShow = allEmployees.filter(emp => memberIdsSet.has(emp.userId));
        } catch (error) {
            console.error('Failed to load project members for editing:', error);
            uiUtils.showMessage('Ошибка загрузки участников проекта', 'error');
            employeesToShow = allEmployees;
        }
        
        employeesToShow.sort((a, b) => a.name.localeCompare(b.name));

        const currentResponsible = currentResponsibleText.split(',').map(n => n.trim());
        const employeesCheckboxes = employeesToShow.map(e => `
            <label class="flex items-center space-x-3 p-3 rounded-md hover:bg-gray-200">
                <input type="checkbox" value="${e.name}" ${currentResponsible.includes(e.name) ? 'checked' : ''} class="employee-checkbox w-4 h-4 rounded">
                <span>${e.name}</span>
            </label>
        `).join('');

        employeeModal.innerHTML = `
            <div class="modal-content">
                <div class="p-4 border-b" style="border-color: var(--tg-theme-hint-color);">
                    <h3 class="text-lg font-bold">Выберите ответственных</h3>
                </div>
                <div class="modal-body modal-body-employee">${employeesCheckboxes}</div>
                <div class="p-2 border-t flex justify-end" style="border-color: var(--tg-theme-hint-color);">
                    <button class="modal-select-btn px-4 py-2 rounded-lg">Выбрать</button>
                </div>
            </div>`;
    }
    employeeModal.classList.add('active');
    employeeModal.dataset.targetElementId = activeTaskDetailsElement.id;
}

export function openProjectModal(activeTaskDetailsElement, allProjects) {
    const currentProject = activeTaskDetailsElement.querySelector('.task-project-view').textContent;
    projectModal.innerHTML = `<div class="modal-content"><div class="p-4 border-b" style="border-color: var(--tg-theme-hint-color);"><h3 class="text-lg font-bold">Выберите проект</h3></div><div class="modal-body">${allProjects.map(p => `<label class="flex items-center space-x-3 p-3 rounded-md hover:bg-gray-200"><input type="radio" name="project" value="${p.projectName}" ${p.projectName === currentProject ? 'checked' : ''} class="w-4 h-4"><span>${p.projectName}</span></label>`).join('')}</div><div class="p-2 border-t flex justify-end" style="border-color: var(--tg-theme-hint-color);"><button class="modal-select-btn px-4 py-2 rounded-lg">Выбрать</button></div></div>`;
    projectModal.classList.add('active');
    projectModal.dataset.targetElementId = activeTaskDetailsElement.id;
}

// В файле public/js/ui/modals.js

export function openAddTaskModal(allProjects, allEmployees, userRole, userName) {
    document.body.classList.add('overflow-hidden');
    const tg = window.Telegram.WebApp;
    const projectsOptions = allProjects.map(p => `<option value="${p.projectId}">${p.projectName}</option>`).join('');
    
    // Фильтруем статусы
    const allStatuses = store.getAllStatuses();
    const allowedStatusIds = new Set(['1', '5', '6']);
    const filteredStatuses = allStatuses.filter(status => allowedStatusIds.has(status.statusId));
    filteredStatuses.sort((a, b) => a.order - b.order);

    const statusToggleHtml = filteredStatuses.map((status, index) => {
        const isActive = index === 0 ? 'active' : ''; 
        return `
            <div class="toggle-option ${isActive}" data-status="${status.name}">
                <span class="toggle-icon">${status.icon}</span>
                <span class="toggle-text">${status.name}</span>
            </div>
        `;
    }).join('');
    
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
                <div>
                    <label class="text-xs font-medium text-gray-500">Проект</label>
                    <select id="new-task-project" class="details-input mt-1" required>
                        <option value="" disabled selected>Выберите проект...</option>
                        ${projectsOptions}
                    </select>
                </div>
                <div>
                    <label class="text-xs font-medium text-gray-500">Этап</label>
                    <select id="new-task-stage" class="details-input mt-1" required>
                        <option value="" disabled selected>Сначала выберите проект...</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-medium text-gray-500">Статус</label>
                    <div id="new-task-status-toggle" class="status-toggle">${statusToggleHtml}</div>
                </div>
                <div id="new-task-employees-container" style="display: none;">
                    <label class="text-xs font-medium text-gray-500">Ответственные</label>
                    <div id="new-task-employees-list" class="modal-body-employee mt-1 border rounded-md p-2">
                        <p class="text-sm text-gray-500">Сначала выберите проект</p>
                    </div>
                </div>
            </div>
        </div>`;
        
    const projectSelect = document.getElementById('new-task-project');
    const employeeContainer = document.getElementById('new-task-employees-list');
    const employeeSection = document.getElementById('new-task-employees-container');
    const statusToggle = document.getElementById('new-task-status-toggle');
    const stageSelect = document.getElementById('new-task-stage');
    
    if (userRole === 'admin' || userRole === 'owner') {
        employeeSection.style.display = 'block';
    }

    const renderEmployees = (employees) => {
        if (employees.length === 0) {
            employeeContainer.innerHTML = `<p class="text-sm text-gray-500">Список пуст. Выберите проект или добавьте участников в него.</p>`;
            return;
        }
        employeeContainer.innerHTML = employees.map(emp => `
            <label class="flex items-center space-x-3 p-3 rounded-md hover:bg-gray-200">
                <input type="checkbox" value="${emp.name}" class="employee-checkbox w-4 h-4 rounded">
                <span>${emp.name}</span>
            </label>
        `).join('');
    };

    projectSelect.addEventListener('change', async (event) => {
        // --- НАЧАЛО БЛОКА С ЛОГАМИ ---
        console.log("--- DEBUG: Project selection changed ---");
        const projectId = event.target.value;
        console.log(`1. Selected Project ID: ${projectId}`);
        
        try {
            const memberIds = await api.getProjectMembers(projectId);
            const memberIdsSet = new Set(memberIds);
            const projectMembers = allEmployees.filter(emp => memberIdsSet.has(emp.userId));
            renderEmployees(projectMembers);
        } catch (error) {
            console.error('[DEBUG] Failed to load project members:', error);
            renderEmployees([]);
        }

        const allStageFilters = store.getStageFilters();
        console.log('2. All stored stage filters:', allStageFilters);

        const activeStageIdsForProject = allStageFilters[projectId] || [];
        console.log(`3. Active Stage IDs for this project (from store):`, activeStageIdsForProject);

        const allStages = store.getAppData().allStages || [];
        console.log('4. All available stages in the app:', allStages);

        const activeStageIdsSet = new Set(activeStageIdsForProject.map(String));
        const availableStages = allStages.filter(s => activeStageIdsSet.has(String(s.stageId)));
        console.log('5. Filtered stages to show in dropdown:', availableStages);

        const stageOptionsHtml = availableStages.map(stage => 
            `<option value="${stage.stageId}">${stage.name}</option>`
        ).join('');
        console.log('6. Final HTML for stages dropdown:', stageOptionsHtml);
        
        stageSelect.innerHTML = stageOptionsHtml;
        if(availableStages.length === 0) {
            stageSelect.innerHTML = '<option value="" disabled selected>Нет активных этапов</option>';
        }
        console.log("--- DEBUG: End of handler ---");
        // --- КОНЕЦ БЛОКА С ЛОГАМИ ---
    });

    if (statusToggle) {
        statusToggle.addEventListener('click', (e) => {
            const targetOption = e.target.closest('.toggle-option');
            if (targetOption) {
                statusToggle.querySelectorAll('.toggle-option').forEach(opt => opt.classList.remove('active'));
                targetOption.classList.add('active');
            }
        });
    }

    addTaskModal.classList.add('active');
    tg.BackButton.onClick(closeAddTaskModal);
    tg.BackButton.show();
}

export function closeAddTaskModal() {
    const tg = window.Telegram.WebApp;
    addTaskModal.classList.remove('active');
    document.body.classList.remove('overflow-hidden');
    tg.BackButton.hide();
    tg.BackButton.offClick(closeAddTaskModal);
    uiUtils.updateFabButtonUI(false, handlers.handleSaveActiveTask, handlers.handleShowAddTaskModal);
}

export function openManageMembersModal(projectName, allUsers, currentMemberIds) {
    const listContainer = document.getElementById('members-modal-list');
    const projectNameEl = document.getElementById('members-modal-project-name');
    projectNameEl.textContent = projectName;
    allUsers.sort((a, b) => a.name.localeCompare(b.name));

    let userHtml = '';
    allUsers.forEach(user => {
        const isChecked = currentMemberIds.includes(user.userId);
        userHtml += `
            <label class="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                <input type="checkbox" class="member-checkbox h-5 w-5 rounded mr-3" value="${user.userId}" ${isChecked ? 'checked' : ''}>
                <span class="text-lg">${user.name}</span>
            </label>
        `;
    });
    
    listContainer.innerHTML = userHtml;
    manageMembersModal.classList.add('active');
}

export function openManageStagesModal(projectName, allStages, activeStageIds) {
    const listContainer = document.getElementById('stages-modal-list');
    const projectNameEl = document.getElementById('stages-modal-project-name');
    projectNameEl.textContent = projectName;
    
    const activeStageIdsSet = new Set(activeStageIds.map(String));

    let stageHtml = '';
    allStages.forEach(stage => {
        const isChecked = activeStageIdsSet.has(String(stage.stageId));
        stageHtml += `
            <label class="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                <input type="checkbox" class="stage-checkbox h-5 w-5 rounded mr-3" value="${stage.stageId}" ${isChecked ? 'checked' : ''}>
                <span class="text-lg">${stage.name}</span>
            </label>
        `;
    });
    
    listContainer.innerHTML = stageHtml;
    manageStagesModal.classList.add('active');
}

export function setupModals(onStatusChange) {
    const modals = [statusModal, employeeModal, projectModal, addTaskModal, manageMembersModal, stageModal];
    modals.forEach(modal => {
        if (!modal) return;
        
        const closeBtn = modal.querySelector('.modal-close-btn');

        const closeModal = () => {
             if (modal.id === 'add-task-modal') {
                closeAddTaskModal();
            } else {
                modal.classList.remove('active');
                document.body.classList.remove('overflow-hidden');
            }
        };

        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }

            if (modal.id === 'status-modal' && e.target.closest('.status-option')) {
                const selectedOption = e.target.closest('.status-option');
                const taskId = modal.dataset.currentTaskId;
                const newStatus = selectedOption.dataset.statusValue;
                onStatusChange(taskId, newStatus);
                closeModal();
            }
            
            if (e.target.closest('.modal-select-btn') && modal.id !== 'add-task-modal') {
                const targetElement = document.getElementById(modal.dataset.targetElementId);
                if (!targetElement) return;

                if (modal.id === 'employee-modal') {
                    const selected = [...modal.querySelectorAll('.employee-checkbox:checked')].map(cb => cb.value);
                    targetElement.querySelector('.task-responsible-view').textContent = selected.join(', ');
                } else if (modal.id === 'project-modal') {
                    const selected = modal.querySelector('input[name="project"]:checked');
                    if (selected) targetElement.querySelector('.task-project-view').textContent = selected.value;
                } else if (modal.id === 'stage-modal') {
                    const selected = modal.querySelector('input[name="stage"]:checked');
                    if (selected) {
                        const newStageId = selected.value;
                        const newStageName = store.getStageNameById(newStageId);
                        targetElement.querySelector('.task-stage-view').textContent = newStageName;
                        
                        const taskData = JSON.parse(targetElement.dataset.task);
                        taskData.stageId = newStageId;
                        targetElement.dataset.task = JSON.stringify(taskData);
                    }
                }
                closeModal();
            }
        });
    });
}