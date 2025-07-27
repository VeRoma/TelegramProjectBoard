import * as api from './api.js';
import * as render from './ui/render.js';
import * as uiUtils from './ui/utils.js';

/**
 * Получает ID пользователя из URL для отладки.
 * @returns {string|null}
 */
function getDebugUserId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debug_user_id');
}

/**
 * Главная функция инициализации приложения.
 * Проверяет пользователя и загружает данные.
 * @returns {Promise<object|null>} - Возвращает данные приложения или null в случае ошибки.
 */
export async function initializeApp() {
    api.logAction('App initializing');
    const tg = window.Telegram.WebApp;
    let user;
    const debugUserId = getDebugUserId();

    if (debugUserId) {
        console.warn(`Включен режим отладки: используется ID пользователя ${debugUserId}`);
        user = { id: debugUserId, first_name: 'Debug', username: 'debuguser' };
    } else {
        user = tg.initDataUnsafe?.user;
    }

    if (!user || !user.id) {
        uiUtils.showAccessDeniedScreen();
        return null;
    }

    window.currentUserId = user.id;

    try {
        uiUtils.showLoading();
        const verification = await api.verifyUser(user);

        if (verification.status === 'authorized') {
            uiUtils.setupUserInfo(verification.name);
            const data = await api.loadAppData({ user });
            if (data && data.projects) {
                render.renderProjects(data.projects, data.userName, data.userRole);
                // Устанавливаем dataset.version и dataset.task после рендеринга
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
                return data; // Возвращаем загруженные данные
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
    return null;
}