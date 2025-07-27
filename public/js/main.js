import * as api from './api.js';
import * as render from './ui/render.js';
import * as modals from './ui/modals.js';
import * as uiUtils from './ui/utils.js';
import { STATUSES } from './data/statuses.js'; // Импортируем статусы для сортировки

document.addEventListener('DOMContentLoaded', () => {
    // --- Глобальные переменные состояния ---
    let appData = {};
    let allProjects = [];
    let allEmployees = [];

    // --- Инициализация Telegram ---
    const tg = window.Telegram.WebApp;
    tg.ready();

    // --- Получение элементов DOM ---
    const mainContainer = document.getElementById('main-content');

    // --- Функции-обработчики (хендлеры) ---

    function getDebugUserId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('debug_user_id');
    }

    function getEmployees() {
        return allEmployees;
    }
    
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
            project: activeEditElement.querySelector('.task-project-view').textContent,
            responsible: selectedEmployees,
            version: parseInt(activeEditElement.dataset.version, 10),
        };

        try {
            const result = await api.saveTask({taskData: updatedTask, modifierName: appData.userName});
            if (result.status === 'success') {
                uiUtils.showToast('Изменения сохранены');
                tg.HapticFeedback.notificationOccurred('success');
                uiUtils.exitEditMode(activeEditElement);
                uiUtils.updateFabButtonUI(false, handleSaveActiveTask, handleShowAddTaskModal);
                
                const oldTaskData = JSON.parse(activeEditElement.dataset.task);
                const newTaskData = {...oldTaskData, ...updatedTask, responsible: selectedEmployees.join(', ')};
                activeEditElement.dataset.task = JSON.stringify(newTaskData).replace(/'/g, '&apos;');
                activeEditElement.dataset.version = result.newVersion;
            } else {
                if (result.error && result.error.includes("изменены другим пользователем")) {
                    tg.showAlert(result.error + '\nТекущие данные будут обновлены.', () => window.location.reload());
                } else {
                    tg.showAlert('Ошибка сохранения: ' + (result.error || 'Неизвестная ошибка'));
                }
            }
        } catch (error) {
            tg.showAlert('Критическая ошибка сохранения: ' + error.message);
        }
    }

    function handleShowAddTaskModal() {
        modals.openAddTaskModal(allProjects, allEmployees);
    }

    async function handleCreateTask(taskData) {
        const tempRowIndex = `temp_${Date.now()}`;
        const optimisticTask = { ...taskData, rowIndex: tempRowIndex, version: 0 };
        let targetProject;
        if (appData.userRole === 'user') {
            targetProject = appData.projects.find(p => p.name === appData.userName);
            if (!targetProject) {
                targetProject = { name: appData.userName, tasks: [] };
                appData.projects.push(targetProject);
            }
        } else {
            targetProject = appData.projects.find(p => p.name === optimisticTask.project);
        }
        if (targetProject) {
            targetProject.tasks.push(optimisticTask);
        } else {
            const newProject = { name: optimisticTask.project, tasks: [optimisticTask] };
            appData.projects.push(newProject);
            if (!allProjects.includes(optimisticTask.project)) {
                 allProjects.push(optimisticTask.project);
            }
        }
        modals.closeAddTaskModal();
        render.renderProjects(appData.projects, appData.userName, appData.userRole);
        uiUtils.showToast('Задача добавлена, сохранение...');
        tg.HapticFeedback.notificationOccurred('success');
        try {
            const result = await api.addTask({newTaskData: taskData, creatorName: appData.userName});
            if (result.status === 'success' && result.task) {
                const finalTask = result.task;
                const projectToUpdate = appData.projects.find(p => p.name === finalTask.project);
                if (projectToUpdate) {
                    const taskToUpdate = projectToUpdate.tasks.find(t => t.rowIndex === tempRowIndex);
                    if (taskToUpdate) {
                        Object.assign(taskToUpdate, finalTask);
                    }
                }
                render.renderProjects(appData.projects, appData.userName, appData.userRole);
                uiUtils.showToast('Задача успешно сохранена!');
            } else {
                throw new Error(result.error || 'Неизвестная ошибка сервера');
            }
        } catch (error) {
            tg.showAlert(`Не удалось сохранить задачу: ${error.message}. Обновляем список...`);
            window.location.reload();
        }
    }

    async function handleStatusUpdate(rowIndex, newStatus) {
        const project = appData.projects.find(p => p.tasks.some(t => t.rowIndex == rowIndex));
        if (!project) return;
        const task = project.tasks.find(t => t.rowIndex == rowIndex);
        if (!task) return;
        const oldStatus = task.status;
        task.status = newStatus;
        if (newStatus === 'Выполнено') task.приоритет = 99;
        render.renderProjects(appData.projects, appData.userName, appData.userRole);
        uiUtils.showToast('Статус обновлён');
        try {
            const result = await api.saveTask({taskData: task, modifierName: appData.userName});
            if (result.status !== 'success') throw new Error(result.error || 'Ошибка сохранения на сервере');
        } catch (error) {
            tg.showAlert('Не удалось сохранить новый статус. Возвращаем как было.');
            task.status = oldStatus;
            render.renderProjects(appData.projects, appData.userName, appData.userRole);
        }
    }

    // --- ИСПРАВЛЕННАЯ ФУНКЦИЯ DRAG-N-DROP ---
    function handleDragDrop(projectName, updatedTaskIdsInGroup) {
        const projectData = appData.projects.find(p => p.name === projectName);
        if (!projectData) return;

        const taskMap = new Map(projectData.tasks.map(t => [t.rowIndex.toString(), t]));

        // Пересчитываем приоритеты от 1 до N только для задач в измененной группе
        const tasksToUpdate = updatedTaskIdsInGroup.map((id, index) => {
            const task = taskMap.get(id);
            if (task) {
                task.приоритет = index + 1;
                return {
                    rowIndex: task.rowIndex,
                    приоритет: task.приоритет
                };
            }
        }).filter(Boolean);

        // Сразу перерисовываем интерфейс с новым локальным порядком
        render.renderProjects(appData.projects, appData.userName, appData.userRole);
        uiUtils.showToast('Сохранение нового порядка...');
        
        // Отправляем на сервер только измененные задачи
        api.updatePriorities({tasks: tasksToUpdate, modifierName: appData.userName})
            .then(result => {
                if (result.status === 'success') {
                    uiUtils.showToast('Новый порядок сохранён');
                } else {
                    throw new Error(result.error || 'Неизвестная ошибка сервера');
                }
            })
            .catch(error => {
                window.Telegram.WebApp.showAlert('Не удалось сохранить новый порядок задач: ' + error.message);
                window.location.reload(); // В случае ошибки - откатываемся
            });
    }

    // --- Установка обработчиков событий ---
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
                await handleSaveActiveTask();
            }
            const backButtonHandler = () => {
                uiUtils.exitEditMode(detailsContainer);
                uiUtils.updateFabButtonUI(false, handleSaveActiveTask, handleShowAddTaskModal);
            };
            uiUtils.enterEditMode(detailsContainer, backButtonHandler);
            uiUtils.updateFabButtonUI(true, handleSaveActiveTask, handleShowAddTaskModal);
            return;
        }
        const modalTrigger = event.target.closest('.modal-trigger-field');
        if (modalTrigger) {
            const modalType = modalTrigger.dataset.modalType;
            const activeTaskDetailsElement = modalTrigger.closest('.task-details');
            if (modalType === 'status') modals.openStatusModal(activeTaskDetailsElement);
            else if (modalType === 'employee') modals.openEmployeeModal(activeTaskDetailsElement, getEmployees());
            else if (modalType === 'project') modals.openProjectModal(activeTaskDetailsElement, allProjects);
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
        const draggableCard = e.target.closest('[draggable="true"]');
        if (!draggableCard) return;
        uiUtils.hideFab();
        draggedElement = draggableCard;
        setTimeout(() => { draggedElement.classList.add('dragging'); }, 0);
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
        const projectElement = draggedElement.closest('.card').querySelector('.project-header h2');
        const projectName = projectElement ? projectElement.textContent : appData.userName;
        const tasksInGroup = Array.from(dropContainer.querySelectorAll('[draggable="true"]'));
        const updatedTaskIds = tasksInGroup.map(card => card.dataset.taskId);
        handleDragDrop(projectName, updatedTaskIds);
    });

    mainContainer.addEventListener('dragend', () => {
        if (draggedElement) {
            draggedElement.classList.remove('dragging');
        }
        document.querySelectorAll('.drag-over, .drag-over-end').forEach(el => {
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

    // --- Главная функция инициализации ---
    async function initializeApp() {
        let user;
        const debugUserId = getDebugUserId();
        if (debugUserId) {
            user = { id: debugUserId, first_name: 'Debug', username: 'debuguser' };
        } else {
            user = tg.initDataUnsafe?.user;
        }
        if (!user || !user.id) {
            uiUtils.showAccessDeniedScreen();
            return;
        }
        window.currentUserId = user.id;
        try {
            uiUtils.showLoading();
            const verification = await api.verifyUser(user);
            if (verification.status === 'authorized') {
                uiUtils.setupUserInfo(verification.name);
                const data = await api.loadAppData({ user });
                if (data && data.projects) {
                    appData = data;
                    allProjects = data.allProjects || [];
                    allEmployees = data.allEmployees || [];
                    render.renderProjects(data.projects, data.userName, data.userRole);
                    document.querySelectorAll('.task-details').forEach(el => {
                        const rowIndex = el.id.split('-')[2];
                        const project = data.projects.find(p => p.tasks.some(t => t.rowIndex == rowIndex));
                        if (project) {
                            const task = project.tasks.find(t => t.rowIndex == rowIndex);
                            if (task) {
                                el.dataset.version = task.version;
                                el.dataset.task = JSON.stringify(task).replace(/'/g, '&apos;');
                            }
                        }
                    });
                } else {
                    render.renderProjects([], verification.name, verification.role);
                }
            } else if (verification.status === 'unregistered') {
                uiUtils.showRegistrationModal();
            } else {
                throw new Error(verification.error || 'Неизвестный статус верификации');
            }
        } catch (error) {
            uiUtils.showDataLoadError(error);
        } finally {
            uiUtils.hideLoading();
        }
    }
    
    // --- Запуск приложения ---
    modals.setupModals(handleStatusUpdate, handleCreateTask, getEmployees);
    uiUtils.updateFabButtonUI(false, handleSaveActiveTask, handleShowAddTaskModal);
    initializeApp();
});