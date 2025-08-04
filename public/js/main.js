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
            else if (modalType === 'employee') modals.openEmployeeModal(activeTaskDetailsElement, store.getAllEmployees());
            else if (modalType === 'project') modals.openProjectModal(activeTaskDetailsElement, store.getAllProjects());
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

    let draggedElement = null;

    mainContainer.addEventListener('dragstart', (e) => {
        // --- ИСПРАВЛЕНИЕ: Блокируем перетаскивание в режиме редактирования ---
        const isEditing = document.querySelector('.task-details.edit-mode');
        if (isEditing) {
            e.preventDefault(); // Отменяем стандартное поведение
            return; // Прерываем выполнение
        }
        // ----------------------------------------------------------------

        const draggableCard = e.target.closest('[draggable="true"]');
        if (!draggableCard) return;
        
        draggedElement = draggableCard;
        
        setTimeout(() => {
            if (draggedElement) draggedElement.classList.add('dragging');
        }, 0);
        
        uiUtils.hideFab();
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

    mainContainer.addEventListener('drop', (e) => { // Обработчик события drop
        e.preventDefault();
        if (!draggedElement) return;
        
        const dropContainer = e.target.closest(`.tasks-list[data-status-group="${draggedElement.dataset.statusGroup}"]`);   // Ищем контейнер для сброса
        if (!dropContainer) {
             mainContainer.dispatchEvent(new Event('dragend'));
             return;
        };
        const afterElement = getDragAfterElement(dropContainer, e.clientY); // Получаем элемент после которого нужно вставить перетаскиваемый элемент
        if (afterElement) {
            dropContainer.insertBefore(draggedElement, afterElement);   // Вставляем перетаскиваемый элемент перед найденным элементом
        } else {
            dropContainer.appendChild(draggedElement);  // Если нет элемента после которого нужно вставить, добавляем в конец
        }
        
        const taskDataString = draggedElement.querySelector('.task-details').dataset.task;
        const taskData = JSON.parse(taskDataString.replace(/&apos;/g, "'"));
        const projectName = taskData.project;

        const tasksInGroup = Array.from(dropContainer.querySelectorAll('[draggable="true"]'));
        const updatedTaskIds = tasksInGroup.map(card => card.dataset.taskId);
        
        handlers.handleDragDrop(projectName, updatedTaskIds);
    });

    mainContainer.addEventListener('dragend', () => {
        // Убираем класс .dragging с элемента, который тащили
        if (draggedElement) {
            draggedElement.classList.remove('dragging');
        }
        // Находим ВСЕ возможные элементы с подсветкой и убираем ее
        const placeholders = document.querySelectorAll('.drag-over, .drag-over-end');
        placeholders.forEach(el => {
            el.classList.remove('drag-over', 'drag-over-end');
        });

        // Сбрасываем перетаскиваемый элемент
        draggedElement = null;

        // Гарантированно показываем кнопку "+"
        uiUtils.showFab();
    });

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

   async function startApp() {
        const success = await auth.initializeApp();
        if (success) {
            // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
            // Получаем актуальные данные из хранилища после инициализации
            const appData = store.getAppData();
            // -------------------------

             modals.setupModals(handlers.handleStatusUpdate, store.getAllEmployees);
            
            uiUtils.updateFabButtonUI(false, handlers.handleShowAddTaskModal, handlers.handleShowAddTaskModal);
        }
    }

    startApp();
});