// public/js/ui/modals.js

import * as store from '../store.js';
import * as uiUtils from './utils.js';
import * as handlers from '../handlers.js';
import * as api from '../api.js';

const statusModal = document.getElementById('status-modal');
const userModal = document.getElementById('user-modal');
const projectModal = document.getElementById('project-modal');
const addTaskModal = document.getElementById('add-task-modal');
const stageModal = document.getElementById('stage-modal');
const manageMembersModal = document.getElementById('manage-members-modal');
const manageStagesModal = document.getElementById('manage-stages-modal');

let statusModalContentLoaded = false;

// --- ИСПРАВЛЕННАЯ ФУНКЦИЯ 1 ---
export function openStageModal(activeTaskDetailsElement) {
    const taskData = JSON.parse(activeTaskDetailsElement.dataset.task);
    const projectId = taskData.projectId;
    const currentStageId = taskData.stageId;

    // Используем фоново загруженные данные из store
    const allProjectStages = store.getAllProjectStages();
    const activeStageIds = new Set(
        allProjectStages
            .filter(ps => ps.projectId == projectId && ps.isActive === 'TRUE')
            .map(ps => ps.stageId)
    );

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
                `).join('') || '<p class="p-4 text-center text-sm">Для этого проекта не настроены активные этапы.</p>'}
            </div>
            <div class="modal-footer">
                <button class="modal-select-btn px-4 py-2 rounded-lg">Выбрать</button>
            </div>
        </div>`;
    
    stageModal.classList.add('active');
    stageModal.dataset.targetElementId = activeTaskDetailsElement.id;
}

// --- БЕЗ ИЗМЕНЕНИЙ ---
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

// --- ИСПРАВЛЕННАЯ ФУНКЦИЯ 2 ---
export async function openUserModal(activeTaskDetailsElement, allUsers, userRole) {
    const taskData = JSON.parse(activeTaskDetailsElement.dataset.task);
    const projectId = taskData.projectId;
    const currentCuratorId = taskData.curatorId;
    const currentMemberIds = new Set((taskData.members || []).map(m => m.userId));

    // Используем фоново загруженные данные из store
    const allProjectMembers = store.getAllProjectMembers();
    const projectMemberIds = new Set(
        allProjectMembers
            .filter(m => m.projectId == projectId && m.isActive === 'TRUE')
            .map(m => m.userId)
    );

    let usersToShow = allUsers.filter(emp => projectMemberIds.has(emp.userId));
    usersToShow.sort((a, b) => a.name.localeCompare(b.name));

    const renderUserList = (curatorId) => {
        return usersToShow.map(e => {
            const isCurator = e.userId == curatorId;
            return `
                <label class="user-select-label flex items-center space-x-3 p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" value="${e.userId}" class="user-checkbox w-5 h-5 rounded">
                    <span class="user-name">${e.name}</span>
                    ${isCurator ? '<span class="curator-icon text-lg">👑</span>' : ''}
                </label>
            `;
        }).join('');
    };
    
    userModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="font-bold">Выберите ответственных</h3>
                <button class="modal-close-btn">&times;</button>
            </div>
            <div class="modal-body modal-body-user" id="user-list-container">
                ${renderUserList(currentCuratorId)}
            </div>
            <div class="modal-footer">
                <button class="modal-select-btn w-full p-3 rounded-lg font-bold">Выбрать</button>
            </div>
        </div>
    `;

    currentMemberIds.forEach(id => {
        const checkbox = userModal.querySelector(`input[value="${id}"]`);
        if (checkbox) checkbox.checked = true;
    });

    userModal.classList.add('active');
    userModal.dataset.targetElementId = activeTaskDetailsElement.id;

    const container = userModal.querySelector('#user-list-container');
    let lastCheckedOrder = Array.from(userModal.querySelectorAll('.user-checkbox:checked')).map(cb => cb.value);

    container.addEventListener('change', (e) => {
        if (e.target.classList.contains('user-checkbox')) {
            const targetId = e.target.value;
            if (e.target.checked) {
                lastCheckedOrder.push(targetId);
            } else {
                lastCheckedOrder = lastCheckedOrder.filter(id => id !== targetId);
            }
            const newCuratorId = lastCheckedOrder.length > 0 ? lastCheckedOrder[0] : null;
            container.querySelectorAll('.curator-icon').forEach(icon => icon.remove());
            if (newCuratorId) {
                const curatorLabel = container.querySelector(`input[value="${newCuratorId}"]`).parentElement;
                const icon = document.createElement('span');
                icon.className = 'curator-icon text-lg';
                icon.textContent = '👑';
                curatorLabel.appendChild(icon);
            }
        }
    });
}

// --- БЕЗ ИЗМЕНЕНИЙ ---
export function openProjectModal(activeTaskDetailsElement, allProjects) {
    const currentProject = activeTaskDetailsElement.querySelector('.task-project-view').textContent;
    projectModal.innerHTML = `<div class="modal-content"><div class="p-4 border-b" style="border-color: var(--tg-theme-hint-color);"><h3 class="text-lg font-bold">Выберите проект</h3></div><div class="modal-body">${allProjects.map(p => `<label class="flex items-center space-x-3 p-3 rounded-md hover:bg-gray-200"><input type="radio" name="project" value="${p.projectName}" ${p.projectName === currentProject ? 'checked' : ''} class="w-4 h-4"><span>${p.projectName}</span></label>`).join('')}</div><div class="p-2 border-t flex justify-end" style="border-color: var(--tg-theme-hint-color);"><button class="modal-select-btn px-4 py-2 rounded-lg">Выбрать</button></div></div>`;
    projectModal.classList.add('active');
    projectModal.dataset.targetElementId = activeTaskDetailsElement.id;
}

// --- ИСПРАВЛЕННАЯ ФУНКЦИЯ 3 ---
export function openAddTaskModal(allProjects, allUsers, userRole, userName) {
    document.body.classList.add('overflow-hidden');
    const tg = window.Telegram.WebApp;
    const projectsOptions = allProjects.map(p => `<option value="${p.projectId}">${p.projectName}</option>`).join('');
    
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
                <div id="new-task-users-container" style="display: none;">
                    <label class="text-xs font-medium text-gray-500">Ответственные</label>
                    <div id="new-task-users-list" class="modal-body-user mt-1 border rounded-md p-2">
                        <p class="text-sm text-gray-500">Сначала выберите проект</p>
                    </div>
                </div>
            </div>
        </div>`;
        
    const projectSelect = document.getElementById('new-task-project');
    const userContainer = document.getElementById('new-task-users-list');
    const userSection = document.getElementById('new-task-users-container');
    const statusToggle = document.getElementById('new-task-status-toggle');
    const stageSelect = document.getElementById('new-task-stage');
    
    if (userRole === 'admin' || userRole === 'owner') {
        userSection.style.display = 'block';
    }

    projectSelect.addEventListener('change', (event) => {
        const projectId = event.target.value;

        // Обновляем список участников из предзагруженных данных
        const allProjectMembers = store.getAllProjectMembers();
        const projectMemberIds = new Set(
            allProjectMembers
                .filter(m => m.projectId == projectId && m.isActive === 'TRUE')
                .map(m => m.userId)
        );
        const projectMembers = allUsers.filter(emp => projectMemberIds.has(emp.userId));
        
        if (projectMembers.length === 0) {
            userContainer.innerHTML = `<p class="text-sm text-gray-500">В этом проекте нет участников.</p>`;
        } else {
            userContainer.innerHTML = projectMembers.map(emp => `
                <label class="flex items-center space-x-3 p-3 rounded-md hover:bg-gray-200">
                    <input type="checkbox" value="${emp.name}" class="user-checkbox w-4 h-4 rounded">
                    <span>${emp.name}</span>
                </label>
            `).join('');
        }

        // Обновляем список этапов из предзагруженных данных
        const allProjectStages = store.getAllProjectStages();
        const activeStageIds = new Set(
            allProjectStages
                .filter(ps => ps.projectId == projectId && ps.isActive === 'TRUE')
                .map(ps => ps.stageId)
        );
        const allStages = store.getAppData().allStages || [];
        const availableStages = allStages.filter(s => activeStageIds.has(String(s.stageId)));
        
        if (availableStages.length === 0) {
            stageSelect.innerHTML = '<option value="" disabled selected>Нет активных этапов</option>';
        } else {
            stageSelect.innerHTML = availableStages.map(stage => 
                `<option value="${stage.stageId}">${stage.name}</option>`
            ).join('');
        }
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

// --- БЕЗ ИЗМЕНЕНИЙ ---
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
        // --- НАЧАЛО ИЗМЕНЕНИЙ ---
        const isAdminOrOwner = user.role === 'admin' || user.role === 'owner';
        
        // Администратор всегда выбран. Для остальных проверяем, есть ли они в списке участников.
        const isChecked = isAdminOrOwner || currentMemberIds.includes(user.userId);
        
        // Администратора нельзя убрать.
        const isDisabled = isAdminOrOwner;
        
        // Добавляем подсказку для заблокированных чекбоксов
        const titleHint = isDisabled ? 'title="Администраторы всегда являются участниками проекта"' : '';
        const disabledClass = isDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer';

        userHtml += `
            <label class="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${disabledClass}" ${titleHint}>
                <input type="checkbox" class="member-checkbox h-5 w-5 rounded mr-3" value="${user.userId}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
                <span class="text-lg">${user.name} ${isDisabled ? ' (Админ)' : ''}</span>
            </label>
        `;
        // --- КОНЕЦ ИЗМЕНЕНИЙ ---
    });
    
    listContainer.innerHTML = userHtml;
    manageMembersModal.classList.add('active');
}

// --- БЕЗ ИЗМЕНЕНИЙ ---
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

// --- БЕЗ ИЗМЕНЕНИЙ ---
export function setupModals(onStatusChange) {
    const modals = [statusModal, userModal, projectModal, addTaskModal, manageMembersModal, manageStagesModal];
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

                if (modal.id === 'user-modal') {
                    const checkedCheckboxes = [...modal.querySelectorAll('.user-checkbox:checked')];
                    
                    if (checkedCheckboxes.length === 0) {
                        uiUtils.showMessage('Задача должна иметь хотя бы одного ответственного (Куратора).', 'error');
                        return;
                    }

                    const memberIds = checkedCheckboxes.map(cb => cb.value);
                    const curatorId = memberIds[0];
                    handlers.handleUpdateTaskMembers(targetElement.id, curatorId, memberIds);
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