const toast = document.getElementById('toast-notification');
const fabButton = document.getElementById('fab-button');
const fabIconContainer = document.getElementById('fab-icon-container');
const mainContainer = document.getElementById('main-content');

const ICONS = {
    refresh: `<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="var(--tg-theme-button-text-color, #ffffff)" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
    save: `<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="var(--tg-theme-button-text-color, #ffffff)" stroke-width="2"><path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
    add: `<svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="var(--tg-theme-button-text-color, #ffffff)" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>`
};

let saveTimeout;

export function showToast(message) {
    toast.textContent = message;
    toast.style.bottom = '1.5rem';
    toast.style.opacity = '1';
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        toast.style.bottom = '-100px';
        toast.style.opacity = '0';
    }, 2500);
}

export function showLoading() {
    document.getElementById('app').classList.remove('hidden');
    mainContainer.innerHTML = '<div class="text-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500 mx-auto mt-4"></div></div>';
}

export function hideLoading() {
    // В данной архитектуре эта функция может быть пустой,
    // так как renderProjects полностью перезаписывает содержимое.
    // Но она нужна для совместимости, чтобы избежать ошибок.
}

export function showDataLoadError(error) {
    const errorMessage = typeof error === 'object' ? error.message : String(error);
    mainContainer.innerHTML = `<div class="p-4 bg-red-100 text-red-700 rounded-lg"><p class="font-bold">Ошибка загрузки</p><p class="text-sm mt-1">${errorMessage}</p></div>`;
}

export function updateFabButtonUI(isEditMode, saveHandler, addHandler) {
    if (fabButton.onclick) {
        fabButton.removeEventListener('click', fabButton.onclick);
    }
    fabButton.onclick = isEditMode ? saveHandler : addHandler;
    fabIconContainer.innerHTML = isEditMode ? ICONS.save : ICONS.add;
}

export function showAccessDeniedScreen() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('auth-blocker').classList.remove('hidden');
}

export function showRegistrationModal() {
    document.body.classList.add('overflow-hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('registration-modal').classList.add('active');
}

export function setupUserInfo(nameFromSheet) {
    const greetingElement = document.getElementById('greeting-text');
    const userIdElement = document.getElementById('user-id-text');
    const user = window.Telegram.WebApp.initDataUnsafe.user;
    if (user && user.id) {
        const displayName = nameFromSheet || user.first_name || 'пользователь';
        greetingElement.textContent = `Привет, ${displayName}!`;
        userIdElement.textContent = `Ваш ID: ${user.id}`;
    }
}

export function hideFab() {
    fabButton.style.display = 'none';
}

export function showFab() {
    if (fabButton.style.display === 'flex') return;
    fabButton.style.display = 'flex';
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
    // Важно безопасно убирать обработчик
    tg.offEvent('backButtonClicked', exitEditMode);
}