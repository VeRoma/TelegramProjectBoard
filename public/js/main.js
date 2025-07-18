import * as api from './api.js';
import * as ui from './ui.js';
// Removed: import { employees } from './data/employees.js';

let allProjects = [];
let appData = {};
let allEmployees = []; // New global variable to store employees from server

document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();

    // Removed debugUserId block

    const mainContainer = document.getElementById('main-content');
    
    async function handleSaveActiveTask() {
        const activeEditElement = document.querySelector('.task-details.edit-mode');
        if (!activeEditElement) return;

        const responsibleText = activeEditElement.querySelector('.task-responsible-view').textContent;
        const selectedEmployees = responsibleText ? responsibleText.split(',').map(s => s.trim()).filter(Boolean) : [];
        
        const updatedTask = {
            rowIndex: activeEditElement.querySelector('.task-row-index').value,
            name: activeEditElement.querySelector('.task-name-edit').value,
            message: activeEditElement.querySelector('.task-message-edit').value,
            status: activeEditElement.querySelector('.task-status-view').textContent,
            responsible: selectedEmployees,
            version: parseInt(activeEditElement.dataset.version, 10),
        };

        try {
            api.logAction('Attempting to save task', { rowIndex: updatedTask.rowIndex, name: updatedTask.name });
            const result = await api.saveTask(updatedTask);
            if (result.status === 'success') {
                ui.showToast('Изменения сохранены');
                tg.HapticFeedback.notificationOccurred('success');
                
                ui.exitEditMode(activeEditElement);
                ui.updateFabButtonUI(false, handleSaveActiveTask, handleShowAddTaskModal);

                const oldTaskData = JSON.parse(activeEditElement.dataset.task);
                const newTaskData = {...oldTaskData, ...updatedTask, responsible: selectedEmployees.join(', ')};
                activeEditElement.dataset.task = JSON.stringify(newTaskData).replace(/'/g, '&apos;');
                activeEditElement.dataset.version = result.newVersion;
            } else {
                api.logAction('Task save failed', { level: 'WARN', rowIndex: updatedTask.rowIndex, error: result.error });
                if (result.error.includes("изменены другим пользователем")) {
                    return tg.showAlert(result.error + '\nТекущие данные будут обновлены.');
                }
                tg.showAlert('Ошибка сохранения: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            api.logAction('Critical save error', { level: 'ERROR', error: error.message });
            tg.showAlert('Критическая ошибка сохранения: ' + error.message);
        }
    }

    function handleShowAddTaskModal() {
        ui.openAddTaskModal(allProjects, allEmployees);
    }

    async function handleStatusUpdate(rowIndex, newStatus) {
        const project = appData.projects.find(p => p.tasks.some(t => t.rowIndex == rowIndex));
        if (!project) return;

        const task = project.tasks.find(t => t.rowIndex == rowIndex);
        if (!task) return;

        const oldStatus = task.status;
        task.status = newStatus;

        // userName will now come from appData
        ui.renderProjects(appData.projects, appData.userName);
        ui.showToast('Статус обновлён');

        try {
            const result = await api.saveTask({ ...task, status: newStatus });
            if (result.status !== 'success') {
                throw new Error(result.error || 'Ошибка сохранения на сервере');
            }
            api.logAction('Status updated successfully on server');
        } catch (error) {
            api.logAction('Status update failed', { level: 'ERROR', error: error.message });
            tg.showAlert('Не удалось сохранить новый статус. Возвращаем как было.');
            task.status = oldStatus;
            ui.renderProjects(appData.projects, appData.userName);
        }
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('[draggable="true"]:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    mainContainer.addEventListener('click', async (event) => {
    const statusActionArea = event.target.closest('.status-action-area');
    if (statusActionArea) {
        const taskCard = statusActionArea.closest('[data-task-id]');
        const detailsContainer = taskCard.querySelector('.task-details');
        if (!detailsContainer.innerHTML) {
            ui.renderTaskDetails(detailsContainer);
        }
        ui.openStatusModal(detailsContainer);
        return;
    }

    const editBtn = event.target.closest('.edit-btn');
    if (editBtn) {
        const detailsContainer = editBtn.closest('.task-details');
        const currentlyEditing = document.querySelector('.task-details.edit-mode');
        if (currentlyEditing && currentlyEditing !== detailsContainer) {
            await handleSaveActiveTask();
        }
        const backButtonHandler = () => {
            ui.exitEditMode(detailsContainer);
            ui.updateFabButtonUI(false, handleSaveActiveTask, handleShowAddTaskModal);
        };
        ui.enterEditMode(detailsContainer, backButtonHandler);
        ui.updateFabButtonUI(true, handleSaveActiveTask, handleShowAddTaskModal);
        return;
    }
    
    const modalTrigger = event.target.closest('.modal-trigger-field');
    if (modalTrigger) {
        const modalType = modalTrigger.dataset.modalType;
        const activeTaskDetailsElement = modalTrigger.closest('.task-details');
        if (modalType === 'status') {
            ui.openStatusModal(activeTaskDetailsElement);
        } else if (modalType === 'employee') {
            ui.openEmployeeModal(activeTaskDetailsElement);
        } else if (modalType === 'project') {
            ui.openProjectModal(activeTaskDetailsElement, allProjects);
        }
        return;
    }

    const taskHeader = event.target.closest('.task-header');
    if (taskHeader) {
        if (event.target.closest('.status-action-area')) {
            return;
        }
        
        const detailsContainer = taskHeader.nextElementSibling;

        const currentlyOpen = document.querySelector('.task-details.expanded');
        if (currentlyOpen && currentlyOpen !== detailsContainer) {
            currentlyOpen.classList.remove('expanded');
            setTimeout(() => {
                currentlyOpen.innerHTML = '';
            }, 300);
        }

        if (!detailsContainer.innerHTML) {
            ui.renderTaskDetails(detailsContainer);
        }
        
        detailsContainer.classList.toggle('expanded');

        if (detailsContainer.classList.contains('expanded')) {
            detailsContainer.addEventListener('transitionend', () => {
                detailsContainer.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }, { once: true });
        } else {
            setTimeout(() => {
                detailsContainer.innerHTML = '';
            }, 300);
        }
        return;
    }

    const projectHeader = event.target.closest('.project-header');
    if (projectHeader) {
        const targetList = projectHeader.nextElementSibling;
        targetList.classList.toggle('expanded');
        if (targetList.classList.contains('expanded')) {
            setTimeout(() => projectHeader.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }
        return;
    }
});

    let draggedElement = null;
    mainContainer.addEventListener('dragstart', (e) => {
        const draggableCard = e.target.closest('[draggable="true"]');
        if (!draggableCard) return;
        ui.hideFab();
        draggedElement = draggableCard;
        setTimeout(() => { draggedElement.classList.add('dragging'); }, 0);
    });

    mainContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const container = e.target.closest('#projects-container, .tasks-list');
        if (!container) return;
        const afterElement = getDragAfterElement(container, e.clientY);
        container.querySelectorAll('[draggable="true"]').forEach(el => el.classList.remove('drag-over'));
        if (afterElement) afterElement.classList.add('drag-over');
    });
    
    mainContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        const dropTarget = e.target.closest('[draggable="true"]');
        if (!draggedElement || !dropTarget) return;
        const container = dropTarget.parentElement;
        const fromIndex = Array.from(container.children).indexOf(draggedElement);
        const toIndex = Array.from(container.children).indexOf(dropTarget);
        const projectElement = draggedElement.closest('.card').querySelector('.project-header h2');
        const projectName = projectElement ? projectElement.textContent : appData.userName; // Use appData.userName now
        const projectData = appData.projects.find(p => p.name === projectName);
        if (!projectData) return;
        const [removed] = projectData.tasks.splice(fromIndex, 1);
        projectData.tasks.splice(toIndex, 0, removed);
        projectData.tasks.forEach((task, index) => { task.приоритет = index + 1; });
        ui.renderProjects(appData.projects, appData.userName); // Use appData.userName now
        ui.showFab();
        api.updatePriorities(projectData.tasks).then(result => {
            if (result.status === 'success') { ui.showToast('Новый порядок сохранён'); } 
            else { throw new Error(result.error || 'Неизвестная ошибка сервера'); }
        }).catch(error => {
            tg.showAlert('Не удалось сохранить новый порядок задач: ' + error.message);
            initializeApp(); 
        });
    });

    mainContainer.addEventListener('dragend', () => {
        ui.showFab();
        if (draggedElement) draggedElement.classList.remove('dragging');
        mainContainer.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        draggedElement = null;
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
            api.logAction('Registration request initiated', { name });
            const result = await api.requestRegistration(name, user.id);
            if (result.status === 'request_sent') {
                document.getElementById('registration-modal').classList.remove('active');
                tg.showAlert('Ваш запрос на регистрацию отправлен администратору. Вы получите уведомление после одобрения.');
                tg.close();
            } else {
                throw new Error(result.error || 'Неизвестная ошибка');
            }
        } catch(error) {
            api.logAction('Registration request failed', { level: 'ERROR', name, error: error.message });
            tg.showAlert('Ошибка отправки запроса: ' + error.message);
        }
    });

    async function initializeApp() {
        api.logAction('App initializing');
        const user = tg.initDataUnsafe.user;

        if (!user || !user.id) {
            api.logAction('Access denied: no user data', { level: 'WARN' });
            ui.showAccessDeniedScreen();
            return;
        }

        try {
            ui.showLoading();
            api.logAction('Verifying user', { userId: user.id });
            const verification = await api.verifyUser(user);

            if (verification.status === 'authorized') {
                ui.setupUserInfo(verification.name);
                api.logAction('User authorized, loading app data', { userId: user.id, name: verification.name });
                const data = await api.loadAppData({ user });
                if (data && data.projects) {
                    appData = data; 
                    allProjects = data.allProjects || [];
                    allEmployees = data.allEmployees || [];
                    ui.renderProjects(data.projects, data.userName);
                    data.projects.forEach(p => p.tasks.forEach(t => {
                        const taskElement = document.getElementById(`task-details-${t.rowIndex}`);
                        if (taskElement) taskElement.dataset.version = t.version;
                        else console.warn(`Не удалось найти элемент для задачи с rowIndex: ${t.rowIndex}`);
                    }));
                } else {
                    api.logAction('No projects data received', { userId: user.id, name: verification.name });
                    ui.renderProjects([], verification.name); 
                }
            } else if (verification.status === 'unregistered') {
                api.logAction('User is unregistered', { userId: user.id });
                ui.showRegistrationModal();
            } else {
                api.logAction('Unknown verification status', { level: 'ERROR', userId: user.id, status: verification.status, error: verification.error });
                throw new Error(verification.error || 'Неизвестный статус верификации');
            }
        } catch (error) {
            api.logAction('App initialization failed', { level: 'ERROR', error: error.message });
            if (error instanceof TypeError && error.message.includes("Unexpected token")) {
                ui.showDataLoadError(new Error("Сервер временно недоступен. Пожалуйста, попробуйте обновить страницу позже."));
            } else {
                ui.showDataLoadError(error);
            }
        }
    }
    
    ui.setupModals(handleStatusUpdate); 
    ui.updateFabButtonUI(false, handleSaveActiveTask, handleShowAddTaskModal);
    initializeApp();
});