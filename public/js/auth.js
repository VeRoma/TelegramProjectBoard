import * as api from './api.js';
import * as render from './ui/render.js';
import * as uiUtils from './ui/utils.js';
import * as store from './store.js'; // Импортируем наше хранилище

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
        return false; // Возвращаем false в случае неудачи
    }

    window.currentUserId = user.id;

    try {
        uiUtils.showLoading();
        const verification = await api.verifyUser(user);

        if (verification.status === 'authorized') {
            uiUtils.setupUserInfo(verification.name);
            const data = await api.loadAppData({ user });
            
            if (data && data.projects) {
                // --- ГЛАВНОЕ ИЗМЕНЕНИЕ: Сохраняем данные в хранилище ---
                store.setAppData(data);
                
                render.renderProjects(data.projects, data.userName, data.userRole);
                
                // Устанавливаем data-атрибуты после рендеринга
                document.querySelectorAll('.task-details').forEach(el => {
                    const rowIndex = el.id.split('-')[2];
                    const { task } = store.findTask(rowIndex);
                    if (task) {
                        el.dataset.version = task.version;
                        el.dataset.task = JSON.stringify(task).replace(/'/g, '&apos;');
                    }
                });
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