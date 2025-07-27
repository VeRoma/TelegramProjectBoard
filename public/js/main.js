import * as api from './api.js';
import * as render from './ui/render.js';
import * as modals from './ui/modals.js';
import * as uiUtils from './ui/utils.js';
import * as auth from './auth.js';
import * as handlers from './handlers.js';
import { appData } from './handlers.js';

document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    const mainContainer = document.getElementById('main-content');
    
    mainContainer.addEventListener('click', async (event) => {
        const statusActionArea = event.target.closest('.status-action-area');
        if (statusActionArea) {
            const taskCard = statusActionArea.closest('[data-task-id]');
            const detailsContainer = taskCard.querySelector('.task-details');
            if (!detailsContainer.innerHTML) render.renderTaskDetails(detailsContainer);
            modals.openStatusModal(detailsContainer);
            return;
        }
        const editBtn = event.target.closest('.edit-btn');
        if (editBtn) {
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
        const modalTrigger = event.target.closest('.modal-trigger-field');
        if (modalTrigger) {
            const modalType = modalTrigger.dataset.modalType;
            const activeTaskDetailsElement = modalTrigger.closest('.task-details');
            if (modalType === 'status') modals.openStatusModal(activeTaskDetailsElement);
            else if (modalType === 'employee') modals.openEmployeeModal(activeTaskDetailsElement, handlers.getEmployees());
            else if (modalType === 'project') modals.openProjectModal(activeTaskDetailsElement, handlers.allProjects);
            return;
        }
        const taskHeader = event.target.closest('.task-header');
        if (taskHeader) {
            if (event.target.closest('.status-action-area')) return;
            const detailsContainer = taskHeader.nextElementSibling;
            const currentlyOpen = document.querySelector('.task-details.expanded');
            
            if (currentlyOpen && currentlyOpen !== detailsContainer) {
                currentlyOpen.classList.remove('expanded');
                setTimeout(() => { currentlyOpen.innerHTML = ''; }, 300);
            }
            if (!detailsContainer.innerHTML) render.renderTaskDetails(detailsContainer);
            detailsContainer.classList.toggle('expanded');
            if (!detailsContainer.classList.contains('expanded')) {
                setTimeout(() => { detailsContainer.innerHTML = ''; }, 300);
            }
            return;
        }
        const projectHeader = event.target.closest('.project-header');
        if (projectHeader) {
            projectHeader.nextElementSibling.classList.toggle('expanded');
        }
    });

    // --- ПЕРЕПИСАННАЯ С НУЛЯ ЛОГИКА DRAG-N-DROP ---
    let draggedElement = null;

    mainContainer.addEventListener('dragstart', (e) => {
        console.log('--- [EVENT] dragstart ---');
        const target = e.target.closest('[draggable="true"]');
        if (!target) return;
        
        draggedElement = target;
        console.log(`[dragstart] Начато перетаскивание элемента с ID: ${draggedElement.dataset.taskId}`);
        
        // Даем браузеру время "схватить" элемент перед тем, как сделать его полупрозрачным
        setTimeout(() => {
            draggedElement.classList.add('dragging');
        }, 0);
        
        uiUtils.hideFab();
    });

    mainContainer.addEventListener('dragover', (e) => {
        e.preventDefault(); // Это обязательно, чтобы событие 'drop' сработало
        if (!draggedElement) return;

        const dragGroup = draggedElement.dataset.statusGroup;
        const container = e.target.closest(`.tasks-list[data-status-group="${dragGroup}"]`);

        // Сначала всегда убираем все подсветки
        document.querySelectorAll('.drag-over, .drag-over-end').forEach(el => el.classList.remove('drag-over', 'drag-over-end'));

        if (!container) return; // Если курсор не над "родным" контейнером, ничего не делаем

        const afterElement = getDragAfterElement(container, e.clientY);
        if (afterElement) {
            afterElement.classList.add('drag-over');
        } else {
            container.classList.add('drag-over-end');
        }
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

    mainContainer.addEventListener('drop', (e) => {
        console.log('--- [EVENT] drop ---');
        e.preventDefault();
        if (!draggedElement) return;

        const dropContainer = e.target.closest(`.tasks-list[data-status-group="${draggedElement.dataset.statusGroup}"]`);
        if (!dropContainer) {
            console.log('[drop] Элемент брошен не в свою группу. Отмена.');
            return;
        }
        
        const afterElement = getDragAfterElement(dropContainer, e.clientY);
        if (afterElement) {
            dropContainer.insertBefore(draggedElement, afterElement);
        } else {
            dropContainer.appendChild(draggedElement);
        }
        console.log('[drop] Элемент вставлен в DOM в новую позицию.');

        const projectElement = draggedElement.closest('.card').querySelector('.project-header h2');
        const projectName = projectElement ? projectElement.textContent : appData.userName;
        
        const tasksInGroup = Array.from(dropContainer.querySelectorAll('[draggable="true"]'));
        const updatedTaskIds = tasksInGroup.map(card => card.dataset.taskId);
        
        console.log(`[drop] Вызов handleDragDrop. Проект: "${projectName}", новый порядок ID:`, updatedTaskIds);
        handlers.handleDragDrop(projectName, updatedTaskIds);
    });

    mainContainer.addEventListener('dragend', (e) => {
        console.log('--- [EVENT] dragend ---');
        // Убираем все визуальные эффекты
        if (draggedElement) {
            draggedElement.classList.remove('dragging');
        }
        document.querySelectorAll('.drag-over, .drag-over-end').forEach(el => el.classList.remove('drag-over', 'drag-over-end'));
        draggedElement = null;
        uiUtils.showFab();
        console.log('[dragend] Все стили и переменные очищены.');
    });


    // --- Логика регистрации ---
    document.getElementById('register-btn').addEventListener('click', async () => {
        const nameInput = document.getElementById('name-input');
        const name = nameInput.value.trim();
        const user = tg.initDataUnsafe.user;
        if (!name) {
            tg.showAlert('Пожалуйста, введите ваше имя.');
            return;
        }
        try {
            const result = await api.requestRegistration(name, user.id);
            if (result.status === 'request_sent') {
                document.getElementById('registration-modal').classList.remove('active');
                tg.showAlert('Ваш запрос на регистрацию отправлен администратору.');
                tg.close();
            } else {
                throw new Error(result.error || 'Неизвестная ошибка');
            }
        } catch(error) {
            tg.showAlert('Ошибка отправки запроса: ' + error.message);
        }
    });

    // --- Запуск приложения ---
    async function startApp() {
        const initialData = await auth.initializeApp();
        if (initialData) {
            handlers.setInitialData(initialData);
            modals.setupModals(handlers.handleStatusUpdate, handlers.handleCreateTask, handlers.getEmployees);
            uiUtils.updateFabButtonUI(false, handlers.handleSaveActiveTask, handlers.handleShowAddTaskModal);
        }
    }

    startApp();
});