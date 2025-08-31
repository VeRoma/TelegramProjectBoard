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

        const statusActionArea = event.target.closest('.status-action-area');
        if (statusActionArea) {
            console.log('[MAIN.JS LOG] Click on .status-action-area detected.');
            event.stopPropagation();
            
            const taskCard = statusActionArea.closest('[data-task-id]');
            const taskId = taskCard.dataset.taskId;
            console.log(`[MAIN.JS LOG] Extracted taskId: ${taskId}`);
            
            // Передаем напрямую taskId, а не весь detailsContainer
            modals.openStatusModal(taskId);
            return;
        }

        const editBtn = event.target.closest('.edit-btn');
        if (editBtn) {      // Кнопка редактирования задачи
            console.log('[MAIN.JS LOG] Click on .edit-btn detected.');
            event.stopPropagation();
            const detailsContainer = editBtn.closest('.task-details');
            const currentlyEditing = document.querySelector('.task-details.edit-mode');
            if (currentlyEditing && currentlyEditing !== detailsContainer) {
                await handlers.handleSaveActiveTask();
            }
            const backButtonHandler = () => {   // Обработчик для кнопки "назад"
                uiUtils.exitEditMode(detailsContainer);
                uiUtils.updateFabButtonUI(false, handlers.handleSaveActiveTask, handlers.handleShowAddTaskModal);
            };
            uiUtils.enterEditMode(detailsContainer, backButtonHandler);
            uiUtils.updateFabButtonUI(true, handlers.handleSaveActiveTask, handlers.handleShowAddTaskModal);
            return;
        }

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
            else if (modalType === 'employee') {
                const appData = store.getAppData();
                modals.openEmployeeModal(activeTaskDetailsElement, store.getAllEmployees(), appData.userRole);
            }
            else if (modalType === 'project') {
                modals.openProjectModal(activeTaskDetailsElement, store.getAllProjects());
            }
            return;
        }

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

        const projectHeader = event.target.closest('.project-header');
        if (projectHeader) {
            console.log('[MAIN.JS LOG] Click on .project-header detected.');
            projectHeader.nextElementSibling.classList.toggle('expanded');
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
        }
    }

    startApp();
});