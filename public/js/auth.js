import * as api from './api.js';
import * as render from './ui/render.js';
import * as uiUtils from './ui/utils.js';
import * as store from './store.js';

function getDebugUserId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debug_user_id');
}

export async function initializeApp() {
    api.logAction('App initializing');
    const tg = window.Telegram.WebApp;
    let user;
    const debugUserId = getDebugUserId();

    if (debugUserId) {
        user = { id: debugUserId, first_name: 'Debug', username: 'debuguser' };
    } else {
        user = tg.initDataUnsafe?.user;
    }

    if (!user || !user.id) {
        uiUtils.showAccessDeniedScreen();
        return false;
    }

    window.currentUserId = user.id;

    try {
        uiUtils.showLoading();
        const verification = await api.verifyUser(user);

        if (verification.status === 'authorized') {
            uiUtils.setupUserInfo(verification.name);
            const data = await api.loadAppData({ user });
            
            if (data && data.projects) {
                // Сохраняем все данные в хранилище
                store.setAppData(data);
                
                // Просто рендерим проекты. Все data-атрибуты уже будут на месте.
                render.renderProjects(data.projects, data.userName, data.userRole);
                
                // --- УДАЛЕН ИЗБЫТОЧНЫЙ БЛОК forEach ---

                return true; // Возвращаем true в случае успеха
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
    return false;
}
