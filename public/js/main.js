import * as api from './api.js';
import * as ui from './ui.js';
import { employees } from './data/employees.js';

let allProjects = [];
let appData = {}; // Будем хранить здесь текущие данные

document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();

    // Блок для обхода (для отладки в браузере)
    const urlParams = new URLSearchParams(window.location.search);
    const debugUserId = parseInt(urlParams.get('debug_user_id'), 10);

    if (debugUserId) {
        const debugUserRecord = employees.find(e => e.userId === debugUserId);
        if (debugUserRecord) {
            tg.initDataUnsafe.user = {
                id: debugUserRecord.userId,
                first_name: debugUserRecord.name,
                username: debugUserRecord.name.toLowerCase(),
            };
            console.warn(`!!! РЕЖИМ ОТЛАДКИ АКТИВЕН для пользователя: ${debugUserRecord.name} !!!`);
        } else {
            console.error(`Пользователь для отладки с ID ${debugUserId} не найден в employees.js`);
        }
    }

    const mainContainer = document.getElementById('main-content');
    
    // Эти функции должны быть определены на этом верхнем уровне
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
                activeEditElement.classList.remove('edit-mode');
                ui.updateFabButtonUI(false, handleSaveActiveTask, handleRefresh);

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

    async function handleRefresh() {
        api.logAction('Refresh requested by user');
        initializeApp();
    }

    mainContainer.addEventListener('click', async (event) => {
        const projectHeader = event.target.closest('.project-header');
        if (projectHeader) {
            const projectName = projectHeader.querySelector('h2').textContent;
            api.logAction('Toggled project view', { project: projectName });
            await handleSaveActiveTask();
            const targetList = projectHeader.nextElementSibling;
            const currentlyExpanded = document.querySelector('.tasks-list.expanded');
            if (currentlyExpanded && currentlyExpanded !== targetList) {
                currentlyExpanded.classList.remove('expanded');
            }
            targetList.classList.toggle('expanded');
            if (targetList.classList.contains('expanded')) {
                setTimeout(() => projectHeader.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
            }
            return;
        }

        const taskHeader = event.target.closest('.task-header');
        if (taskHeader) {
            const taskName = taskHeader.querySelector('p.font-medium').textContent;
            api.logAction('Toggled task details', { task: taskName });
            await handleSaveActiveTask();
            const detailsContainer = taskHeader.nextElementSibling;
            if (!detailsContainer.innerHTML) {
                ui.renderTaskDetails(detailsContainer);
            }
            detailsContainer.classList.toggle('expanded');
            return;
        }

        const editBtn = event.target.closest('.edit-btn');
        if (editBtn) {
            const taskName = editBtn.closest('.task-details').querySelector('p.view-field').textContent;
            api.logAction('Edit mode toggled', { task: taskName });
            const detailsContainer = editBtn.closest('.task-details');
            const currentlyEditing = document.querySelector('.task-details.edit-mode');
            if (currentlyEditing && currentlyEditing !== detailsContainer) {
                await handleSaveActiveTask();
            }
            const isInEditMode = detailsContainer.classList.toggle('edit-mode');
            ui.updateFabButtonUI(isInEditMode, handleSaveActiveTask, handleRefresh);
            return;
        }
        
        const modalTrigger = event.target.closest('.modal-trigger-field');
        if (modalTrigger) {
            const modalType = modalTrigger.dataset.modalType;
            const activeTaskDetailsElement = modalTrigger.closest('.task-details');
            
            api.logAction('Modal opened', { type: modalType });
            if (modalType === 'status') {
                ui.openStatusModal(activeTaskDetailsElement);
            } else if (modalType === 'employee') {
                ui.openEmployeeModal(activeTaskDetailsElement);
            } else if (modalType === 'project') {
                ui.openProjectModal(activeTaskDetailsElement, allProjects);
            }
            return;
        }
    });

    let draggedElement = null;

    mainContainer.addEventListener('dragstart', (e) => {
    const draggableCard = e.target.closest('[draggable="true"]');
    if (!draggableCard) return;

    // ▼▼▼ Прячем кнопку в самом начале ▼▼▼
    ui.hideFab();

    draggedElement = draggableCard;
    setTimeout(() => {
        draggedElement.classList.add('dragging');
    }, 0);
});

    mainContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        
        const container = e.target.closest('#projects-container, .tasks-list');
        if (!container) return;

        const afterElement = getDragAfterElement(container, e.clientY);
        const draggable = document.querySelector('.dragging');

        container.querySelectorAll('[draggable="true"]').forEach(el => el.classList.remove('drag-over'));
        
        if (afterElement) {
            afterElement.classList.add('drag-over');
        }
    });
    
    mainContainer.addEventListener('drop', (e) => { // Убираем async, так как основная логика теперь не ждёт ответа
    e.preventDefault();
    
    const dropTarget = e.target.closest('[draggable="true"]');
    if (!draggedElement || !dropTarget) return;

    const container = dropTarget.parentElement;
    const fromIndex = Array.from(container.children).indexOf(draggedElement);
    const toIndex = Array.from(container.children).indexOf(dropTarget);
    
    const projectData = appData.projects[0];
    const [removed] = projectData.tasks.splice(fromIndex, 1);
    projectData.tasks.splice(toIndex, 0, removed);

    projectData.tasks.forEach((task, index) => {
        task.приоритет = index + 1;
    });

    // --- НОВАЯ ЛОГИКА ---
    // 1. СНАЧАЛА мгновенно перерисовываем интерфейс с новым порядком
    const userName = employees.find(e => e.userId === tg.initDataUnsafe.user.id).name;
    ui.renderProjects(appData.projects, userName);
    ui.showFab(); // Сразу показываем кнопку

    // 2. ПОТОМ отправляем запрос на сервер в фоновом режиме
    api.logAction('Attempting to save new priorities');
    api.updatePriorities(projectData.tasks)
        .then(result => {
            if (result.status === 'success') {
                // Если всё хорошо, просто показываем уведомление
                ui.showToast('Новый порядок сохранён');
                api.logAction('Новый порядок сохранён');
            } else {
                // Если ошибка на сервере, сообщаем пользователю
                throw new Error(result.error || 'Неизвестная ошибка сервера');
            }
        })
        .catch(error => {
            // Если произошла ошибка сети или сервера
            api.logAction('Priority save failed', { level: 'ERROR', error: error.message });
            tg.showAlert('Не удалось сохранить новый порядок задач. Пожалуйста, обновите список: ' + error.message);
            // В этом случае лучше перезагрузить приложение, чтобы избежать рассинхронизации
            initializeApp(); 
        });
});

    mainContainer.addEventListener('dragend', () => {
    // ▼▼▼ Показываем кнопку снова, когда перетаскивание закончено ▼▼▼
    ui.showFab();

    if (draggedElement) {
        draggedElement.classList.remove('dragging');
    }
    mainContainer.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedElement = null;
});

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
            
            const currentUserRecord = employees.find(e => e.userId === user.id);
    
            if (currentUserRecord) {
                api.logAction('User verification successful', { userId: user.id });
                document.getElementById('app').classList.remove('hidden');
                ui.setupUserInfo(currentUserRecord.name);
                
                const data = await api.loadAppData({
                    user,
                    userName: currentUserRecord.name,
                    userRole: currentUserRecord.role
                });
    
                if (data && data.projects) {
                    api.logAction('App data loaded successfully');
                    
                    appData = data; 
                    allProjects = data.allProjects || [];
                    
                    ui.renderProjects(data.projects, currentUserRecord.name);
                    
                    data.projects.forEach(p => p.tasks.forEach(t => {
                        const taskElement = document.getElementById(`task-details-${t.rowIndex}`);
                        if (taskElement) {
                            taskElement.dataset.version = t.version;
                        } else {
                            console.warn(`Не удалось найти элемент для задачи с rowIndex: ${t.rowIndex}`);
                        }
                    }));
                } else {
                    api.logAction('App data is missing projects', { level: 'WARN', data });
                    ui.renderProjects([], currentUserRecord.name); 
                }
            } else {
                api.logAction('User is unregistered', { userId: user.id });
                ui.showRegistrationModal();
            }
    
        } catch (error) {
            ui.showDataLoadError(error);
        }
    }
    
    ui.setupModals();
    ui.updateFabButtonUI(false, handleSaveActiveTask, handleRefresh);
    initializeApp();
});