import * as api from './api.js';
import * as render from './ui/render.js';
import * as modals from './ui/modals.js';
import * as uiUtils from './ui/utils.js';
import * as auth from './auth.js';
import * as handlers from './handlers.js';
import * as store from './store.js';

document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    const mainContainer = document.getElementById('main-content');
    
    mainContainer.addEventListener('click', async (event) => {
        console.log('[MAIN.JS LOG] Click detected on:', event.target);

        // --- Обработчик клика по иконке статуса в карточке ---
        const statusActionArea = event.target.closest('.status-action-area');
        if (statusActionArea) {
            console.log('[MAIN.JS LOG] Click on .status-action-area detected.');
            event.stopPropagation();
            const taskCard = statusActionArea.closest('[data-task-id]');
            const taskId = taskCard.dataset.taskId;
            console.log(`[MAIN.JS LOG] Extracted taskId: ${taskId}`);
            modals.openStatusModal(taskId);
            return;
        }

        // --- Обработчик кнопки "Редактировать" ---
        const editBtn = event.target.closest('.edit-btn');
        if (editBtn) {
            console.log('[MAIN.JS LOG] Click on .edit-btn detected.');
            event.stopPropagation();
            const detailsContainer = editBtn.closest('.task-details');
            const currentlyEditing = document.querySelector('.task-details.edit-mode');
            if (currentlyEditing && currentlyEditing !== detailsContainer) {
                await handlers.handleSaveActiveTask();
            }
            const backButtonHandler = () => {
                uiUtils.exitEditMode(detailsContainer);
                uiUtils.updateFabButtonUI(false, handlers.handleSaveActiveTask, handlers.handleShowAddTaskModal);
            };
            uiUtils.enterEditMode(detailsContainer, backButtonHandler);
            uiUtils.updateFabButtonUI(true, handlers.handleSaveActiveTask, handlers.handleShowAddTaskModal);
            return;
        }

        // --- Обработчик полей, вызывающих модальные окна в режиме редактирования ---
        const modalTrigger = event.target.closest('.modal-trigger-field');
        if (modalTrigger) {
            console.log('[MAIN.JS LOG] Click on .modal-trigger-field detected.');
            event.stopPropagation();
            const modalType = modalTrigger.dataset.modalType;
            const activeTaskDetailsElement = modalTrigger.closest('.task-details');
            if (modalType === 'status') {
                const taskId = activeTaskDetailsElement.closest('[data-task-id]').dataset.taskId;
                console.log(`[MAIN.JS LOG] Extracted taskId from modal trigger: ${taskId}`);
                modals.openStatusModal(taskId);
            }
            else if (modalType === 'user') {
                const appData = store.getAppData();
                modals.openUserModal(activeTaskDetailsElement, store.getAllUsers(), appData.userRole);
            }
            else if (modalType === 'project') {
                modals.openProjectModal(activeTaskDetailsElement, store.getAllProjects());
            }
            return;
        }

        // --- Обработчик клика по заголовку ЗАДАЧИ ---
        const taskHeader = event.target.closest('.task-header');
        if (taskHeader) {
            console.log('[MAIN.JS LOG] Click on .task-header detected.');
            if (event.target.closest('.status-action-area')) return;

            const detailsContainer = taskHeader.nextElementSibling;
            const currentlyOpen = document.querySelector('.task-details.expanded');

            if (currentlyOpen && currentlyOpen !== detailsContainer) {
                currentlyOpen.classList.remove('expanded');
                setTimeout(() => { if (currentlyOpen) currentlyOpen.innerHTML = ''; }, 300);
            }

            if (!detailsContainer.innerHTML) {
                const appData = store.getAppData();
                render.renderTaskDetails(detailsContainer, appData.userRole);
            }

            detailsContainer.classList.toggle('expanded');

            if (!detailsContainer.classList.contains('expanded')) {
                setTimeout(() => { if (detailsContainer) detailsContainer.innerHTML = ''; }, 300);
            }
            return;
        }

        const manageMembersBtn = event.target.closest('.manage-members-btn');
        if (manageMembersBtn) {
            console.log('[MAIN.JS LOG] Click on .manage-members-btn detected.');
            event.stopPropagation();
            const projectId = manageMembersBtn.dataset.projectId;
            const projectName = manageMembersBtn.dataset.projectName;
            handlers.handleManageMembers(projectId, projectName);
            return;
        }

        const manageStagesBtn = event.target.closest('.manage-stages-btn');
        if (manageStagesBtn) {
            console.log('[MAIN.JS LOG] Click on .manage-stages-btn detected.');
            event.stopPropagation();
            const projectId = manageStagesBtn.dataset.projectId;
            const projectName = manageStagesBtn.dataset.projectName;
            handlers.handleManageStages(projectId, projectName);
            return;
        }

        const projectHeader = event.target.closest('.project-header');
        if (projectHeader) {
            console.log('[MAIN.JS LOG] Final Fix: Click on .project-header detected.');

            const projectElement = projectHeader.closest('.project-card');
            
            if (!projectElement) {
                console.error('[MAIN.JS FATAL] Could not find parent ".project-card". Aborting.');
                return;
            }

            const projectBody = projectElement.querySelector('.project-content');
            const projectsContainer = document.getElementById('projects-container');

            if (!projectBody || !projectsContainer) {
                console.error('[MAIN.JS FATAL] Could not find projectBody (.project-content) or projectsContainer. Aborting.');
                return;
            }

            const wasOpen = projectBody.classList.contains('expanded');
            
            const anyOtherOpenBody = projectsContainer.querySelector('.project-card .project-content.expanded');
            if (anyOtherOpenBody && anyOtherOpenBody !== projectBody) {
                console.log('[MAIN.JS LOG] Closing previously open project.');
                anyOtherOpenBody.classList.remove('expanded');
            }

            projectBody.classList.toggle('expanded');
            console.log(`[MAIN.JS LOG] Project is now: ${projectBody.classList.contains('expanded') ? 'OPEN' : 'CLOSED'}`);

            if (!wasOpen && projectBody.classList.contains('expanded')) {
                console.log('[MAIN.JS LOG] Moving project to top.');
                projectElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }

        const deleteBtn = event.target.closest('.delete-btn');
        if (deleteBtn) {
            console.log('[MAIN.JS LOG] Click on .delete-btn detected.');
            event.stopPropagation();
            const taskCard = deleteBtn.closest('[data-task-id]');
            const taskId = taskCard.dataset.taskId;
            handlers.handleDeleteTask(taskId);
            return;
        } 
    });

    // --- ИСПРАВЛЕНИЕ: Единый обработчик для панели инструментов, вынесенный на правильный уровень ---
    const viewToolbar = document.getElementById('view-toolbar');
    viewToolbar.addEventListener('click', (event) => {
        const targetButton = event.target.closest('.view-btn');
        if (!targetButton) return;

        viewToolbar.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        targetButton.classList.add('active');

        const appData = store.getAppData();
        
        if (targetButton.id === 'view-btn-tasks') {
            const allTasks = appData.projects.flatMap(p => p.tasks);
            render.renderTasksView(allTasks, store.getAllStatuses());

        } else if (targetButton.id === 'view-btn-my-tasks') {
            const allTasks = appData.projects.flatMap(p => p.tasks);
            const currentUserId = appData.currentUserId;
            const myTasks = allTasks.filter(task => 
                task.curatorId == currentUserId || 
                (task.members && task.members.some(member => member.userId == currentUserId))
            );
            render.renderTasksView(myTasks, store.getAllStatuses(), true);

        } else { // 'view-btn-projects'
            render.renderProjects(appData.projects, appData.userName, appData.userRole, {});
        }
    });

    let draggedElement = null;

    mainContainer.addEventListener('dragstart', (e) => {
        const isEditing = document.querySelector('.task-details.edit-mode');
        if (isEditing) {
            e.preventDefault();
            return;
        }
        const draggableCard = e.target.closest('[draggable="true"]');
        if (!draggableCard) return;
        draggedElement = draggableCard;
        setTimeout(() => {
            if (draggedElement) draggedElement.classList.add('dragging');
        }, 0);
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('[draggable="true"]:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    mainContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedElement) return;
        const dragGroup = draggedElement.dataset.statusGroup;
        const container = e.target.closest(`.tasks-list[data-status-group="${dragGroup}"]`);
        
        document.querySelectorAll('.drag-over, .drag-over-end').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-end');
        });
        if (!container) return;
        const afterElement = getDragAfterElement(container, e.clientY);
        
        if (afterElement) {
            afterElement.classList.add('drag-over');
        } else {
            container.classList.add('drag-over-end');
        }
    });

    mainContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedElement) return;
        
        const dropContainer = e.target.closest(`.tasks-list[data-status-group="${draggedElement.dataset.statusGroup}"]`);
        if (!dropContainer) {
             mainContainer.dispatchEvent(new Event('dragend'));
             return;
        };

        const afterElement = getDragAfterElement(dropContainer, e.clientY);
        if (afterElement) {
            dropContainer.insertBefore(draggedElement, afterElement);
        } else {
            dropContainer.appendChild(draggedElement);
        }
        
        const appData = store.getAppData();
        let groupName;

        const isLimitedView = !['owner', 'admin'].includes(appData.userRole);
        if (isLimitedView) {
            groupName = appData.userName;
        } else {
            const projectElement = draggedElement.closest('.project-card')?.querySelector('.project-header h2');
            groupName = projectElement ? projectElement.textContent : 'Unknown Project';
        }

        const tasksInGroup = Array.from(dropContainer.querySelectorAll('[draggable="true"]'));
        const updatedTaskIds = tasksInGroup.map(card => card.dataset.taskId);
        
        handlers.handleDragDrop(groupName, updatedTaskIds, appData.userRole);
    });

    mainContainer.addEventListener('dragend', () => {
        if (draggedElement) {
            draggedElement.classList.remove('dragging');
        }
        const placeholders = document.querySelectorAll('.drag-over, .drag-over-end');
        placeholders.forEach(el => {
            el.classList.remove('drag-over', 'drag-over-end');
        });
        draggedElement = null;
        uiUtils.showFab();
    });

    document.getElementById('register-btn').addEventListener('click', async () => {
        const nameInput = document.getElementById('name-input');
        const name = nameInput.value.trim();
        const user = tg.initDataUnsafe.user;
        if (!name) {
            return;
        }
        try {
            const result = await api.requestRegistration(name, user.id);
            if (result.status === 'request_sent') {
                document.getElementById('registration-modal').classList.remove('active');
                tg.close();
            } else {
                throw new Error(result.error || 'Неизвестная ошибка');
            }
        } catch(error) {
            // Error handling
        }
    });

    async function startApp() {
        const success = await auth.initializeApp();
        if (success) {
            modals.setupModals(handlers.handleStatusUpdate);
            uiUtils.updateFabButtonUI(false, handlers.handleShowAddTaskModal, handlers.handleShowAddTaskModal);

            document.getElementById('greeting-container').style.display = 'none';
            const toolbar = document.getElementById('view-toolbar');
            toolbar.classList.remove('hidden');
            toolbar.classList.add('flex');

            const userRole = store.getAppData().userRole;
            const allowedRolesForMyTasks = ['admin', 'owner', 'client'];
            if (allowedRolesForMyTasks.includes(userRole)) {
                document.getElementById('view-btn-my-tasks').classList.remove('hidden');
            }
        }
    }

    startApp();
});