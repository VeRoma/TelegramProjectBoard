import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();

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
            }
            return;
        }
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
            api.logAction('User verification successful', { userId: user.id });
            document.getElementById('app').classList.remove('hidden');
            ui.setupUserInfo(verification.name);
            
            const data = await api.loadAppData(user);
            if (data && data.projects) {
                api.logAction('App data loaded successfully');
                state.setInitialData(data);
                // Передаём не только проекты, но и имя пользователя
                ui.renderProjects(data.projects, verification.name);
                
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
            }
        } else if (verification.status === 'unregistered') {
            api.logAction('User is unregistered', { userId: user.id });
            ui.showRegistrationModal();
        } else {
            throw new Error(verification.error || 'Неизвестный статус верификации');
        }
    } catch (error) {
        ui.showDataLoadError(error);
    }
}
    
    ui.setupModals();
    ui.updateFabButtonUI(false, handleSaveActiveTask, handleRefresh);
    initializeApp();
});