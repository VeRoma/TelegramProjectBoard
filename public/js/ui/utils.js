const toast = document.getElementById('toast-notification');
const fabButton = document.getElementById('fab-button');
const fabIconContainer = document.getElementById('fab-icon-container');
const mainContainer = document.getElementById('main-content');
const loadingOverlay = document.getElementById('loading-overlay');
const app = document.getElementById('app'); // Добавляем недостающую константу

const ICONS = {
    refresh: `<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="var(--tg-theme-button-text-color, #ffffff)" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
    save: `<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="var(--tg-theme-button-text-color, #ffffff)" stroke-width="2"><path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
    add: `<svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="var(--tg-theme-button-text-color, #ffffff)" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>`
};

let saveTimeout;
let currentFabClickHandler = null; // Переменная для хранения текущего обработчика

export function showToast(message, type = 'info') {
    toast.textContent = message;
    
    if (type === 'success') {
        toast.style.backgroundColor = '#28a745';
    } else {
        toast.style.backgroundColor = 'var(--tg-theme-button-color, #007bff)';
    }

    toast.classList.add('show');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

export function showLoading() {
    if (app) app.classList.remove('hidden');
    if (mainContainer) mainContainer.innerHTML = '<div class="text-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500 mx-auto mt-4"></div></div>';
}

export function hideLoading() {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

export function showDataLoadError(error) {
    const errorMessage = typeof error === 'object' ? error.message : String(error);
    mainContainer.innerHTML = `<div class="p-4 bg-red-100 text-red-700 rounded-lg"><p class="font-bold">Ошибка загрузки</p><p class="text-sm mt-1">${errorMessage}</p></div>`;
}

export function updateFabButtonUI(isEditMode, saveHandler, addHandler) {
    // Корректно удаляем предыдущий обработчик, чтобы избежать утечек памяти и двойных срабатываний
    if (currentFabClickHandler) {
        fabButton.removeEventListener('click', currentFabClickHandler);
    }
    
    if (isEditMode) {
        // Настраиваем кнопку для режима "Сохранить"
        fabIconContainer.innerHTML = ICONS.save;
        currentFabClickHandler = saveHandler;
    } else {
        // Настраиваем кнопку для обычного режима "Добавить"
        fabIconContainer.innerHTML = ICONS.add;
        currentFabClickHandler = addHandler;
    }
    // Привязываем новый актуальный обработчик
    fabButton.addEventListener('click', currentFabClickHandler);
}

export function showAccessDeniedScreen() {
    if (app) app.classList.add('hidden');
    document.getElementById('auth-blocker').classList.remove('hidden');
}

export function showRegistrationModal() {
    document.body.classList.add('overflow-hidden');
    document.getElementById('app').classList.add('hidden');
    
    // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
    // Делаем видимым родительский контейнер
    document.getElementById('auth-blocker').classList.remove('hidden');
    // -------------------------

    document.getElementById('registration-modal').classList.add('active');
}

export function setupUserInfo(nameFromSheet) {
    const greetingElement = document.getElementById('greeting-text');
    const userIdElement = document.getElementById('user-id-text');
    
    // Используем имя, полученное с сервера (из таблицы Users)
    const displayName = nameFromSheet || 'Пользователь';
    greetingElement.textContent = `Привет, ${displayName}!`;

    // Просто скрываем элемент, где отображался ID
    if (userIdElement) {
        userIdElement.style.display = 'none';
    }
}

export function hideFab() {
    if(fabButton) fabButton.style.display = 'none';
}

export function showFab() {
    if(fabButton && fabButton.style.display === 'flex') return;
    if(fabButton) fabButton.style.display = 'flex';
}

export function enterEditMode(detailsContainer, onBackCallback) {
    const tg = window.Telegram.WebApp;
    detailsContainer.classList.add('edit-mode');
    tg.BackButton.onClick(onBackCallback);
    tg.BackButton.show();
}

export function exitEditMode(detailsContainer) {
    const tg = window.Telegram.WebApp;
    if (detailsContainer) {
        detailsContainer.classList.remove('edit-mode');
    }
    tg.BackButton.hide();
    tg.BackButton.offClick(exitEditMode);
}

/**
 * Показывает кастомное уведомление вверху экрана.
 * @param {string} message - Сообщение для отображения.
 * @param {string} type - Тип уведомления ('success' или 'error').
 */
export function showNotification(message, type = 'success') {
    // Удаляем старое уведомление, если оно есть
    const oldNotification = document.querySelector('.notification');
    if (oldNotification) {
        oldNotification.remove();
    }

    // Создаем новый элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Показываем уведомление
    setTimeout(() => {
        notification.classList.add('show');
    }, 10); // Небольшая задержка для срабатывания CSS-анимации

    // Скрываем и удаляем уведомление через 3 секунды
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 500); // Ждем окончания анимации скрытия
    }, 3000);
}

/**
 * Универсальная функция для отображения уведомлений пользователю.
 * @param {string} message - Текст сообщения.
 * @param {string} type - Тип сообщения ('success', 'error', 'info'). По умолчанию 'info'.
 */
export function showMessage(message, type = 'info') {
    // Определяем цвет в зависимости от типа сообщения
    let notificationType = 'success'; // По умолчанию зеленый
    if (type === 'error') {
        notificationType = 'error'; // Красный для ошибок
    }
    // Для 'info' можно добавить отдельный стиль, но пока используем 'success'
    
    showNotification(message, notificationType);

    // Добавляем тактильный отклик для важных сообщений
    if (window.Telegram.WebApp.HapticFeedback) {
        if (type === 'success') {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        } else if (type === 'error') {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        }
    }
    
    // Также выводим ошибки в консоль для удобства отладки
    if (type === 'error') {
        console.error("App Message (Error):", message);
    } else {
        console.log("App Message (Info/Success):", message);
    }
}

/**
 * Получает текущее состояние (свернут/развернут) всех проектов на странице.
 * @returns {Object} Объект, где ключ - название проекта, значение - true (развернут) или false (свернут).
 */
export function getAccordionState() {
    const state = {};
    document.querySelectorAll('#main-content .card').forEach(card => {
        const projectNameElement = card.querySelector('.project-header h2');
        if (projectNameElement) {
            const projectName = projectNameElement.textContent;
            const content = card.querySelector('.collapsible-content');
            // Проверяем, есть ли у контента класс .expanded
            const isExpanded = content && content.classList.contains('expanded');
            state[projectName] = isExpanded;
        }
    });
    return state;
}

/**
 * Принудительно сворачивает все открытые карточки задач и очищает их содержимое.
 */
export function collapseAllTaskDetails() {
    document.querySelectorAll('.task-details.expanded').forEach(detailsContainer => {
        detailsContainer.classList.remove('expanded');
        // Очищаем содержимое, чтобы убрать "остаточную" верхушку
        detailsContainer.innerHTML = ''; 
    });
}