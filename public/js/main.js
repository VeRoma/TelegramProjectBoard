// Файл: public/js/main.js (изменения в setupUserInfo)
import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();

    const mainContainer = document.getElementById('main-content');
    
    function setupUserInfo() {
        const greetingElement = document.getElementById('greeting-text');
        const user = tg.initDataUnsafe.user;

        if (user && user.id) {
            greetingElement.textContent = `Привет, ${user.first_name || 'пользователь'}!`;
            // --- НОВОЕ: Отправляем данные для логирования ---
            api.logUserVisit(user);
        } else {
            greetingElement.textContent = 'Добро пожаловать!';
        }
    }

    async function handleSaveActiveTask() {
        // ... (код без изменений)
    }

    async function handleRefresh() {
        // ... (код без изменений)
    }

    mainContainer.addEventListener('click', async (event) => {
        // ... (код без изменений)
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