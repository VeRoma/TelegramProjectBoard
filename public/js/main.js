// Главный файл. Инициализирует приложение и связывает модули.
import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();

    const mainContainer = document.getElementById('main-content');
    
    function setupUserInfo() {
        const greetingElement = document.getElementById('greeting-text');
        const userIdElement = document.getElementById('user-id-text');
        const user = tg.initDataUnsafe.user;

        if (user && user.id) {
            greetingElement.textContent = `Привет, ${user.first_name || 'пользователь'}!`;
            userIdElement.textContent = `Ваш ID: ${user.id}`;
        } else {
            greetingElement.textContent = 'Добро пожаловать!';
            userIdElement.textContent = 'ID пользователя не определен.';
        }
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
            responsible: selectedEmployees,
        };

        try {
            const result = await api.saveTask(updatedTask);
            if (result.status === 'success') {
                ui.showToast('Изменения сохранены');
                tg.HapticFeedback.notificationOccurred('success');
                activeEditElement.classList.remove('edit-mode');
                ui.updateFabButtonUI(false, handleSaveActiveTask, handleRefresh);
                const oldTaskData = JSON.parse(activeEditElement.dataset.task);
                const newTaskData = {...oldTaskData, ...updatedTask, responsible: selectedEmployees.join(', ')};
                activeEditElement.dataset.task = JSON.stringify(newTaskData).replace(/'/g, '&apos;');
            } else {
                tg.showAlert('Ошибка сохранения: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            tg.showAlert('Критическая ошибка сохранения: ' + error.message);
        }
    }

    async function handleRefresh() {
        await handleSaveActiveTask();
        document.getElementById('app-header').classList.remove('hidden-header');
        initializeApp();
    }

    mainContainer.addEventListener('click', async (event) => {
        const projectHeader = event.target.closest('.project-header');
        if (projectHeader) {
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
            
            if (modalType === 'status') {
                ui.openStatusModal(activeTaskDetailsElement);
            } else if (modalType === 'employee') {
                ui.openEmployeeModal(activeTaskDetailsElement);
            }
            return;
        }
    });

    async function initializeApp() {
        setupUserInfo();
        ui.showLoading();
        try {
            const data = await api.loadAppData();
            state.setInitialData(data);
            ui.renderProjects(data.projects);
        } catch (error) {
            ui.showDataLoadError(error);
        }
    }

    ui.setupModals();
    ui.updateFabButtonUI(false, handleSaveActiveTask, handleRefresh);
    initializeApp();
});
