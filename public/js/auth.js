import * as api from './api.js';
import * as render from './ui/render.js';
import * as uiUtils from './ui/utils.js';
import * as store from './store.js';
import * as handlers from './handlers.js';

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
                console.log('[AUTH.JS LOG] Loaded app data:', data);
                // Сохраняем все данные в хранилище
                store.setAppData(data);
                
                // --- НОВЫЙ КОД ДЛЯ ФИЛЬТРОВ ---
                    // 1. Получаем сохраненные фильтры с сервера
                    const stageFilters = data.activeProjectStages || {};
                    
                    // 2. Устанавливаем фильтр по умолчанию ('2') для проектов, у которых нет сохраненных фильтров
                    if (data.allProjects) {
                        data.allProjects.forEach(p => {
                            if (!stageFilters[p.projectId]) {
                                stageFilters[p.projectId] = ['2'];
                            }
                        });
                    }
                    
                    // 3. Сохраняем итоговые фильтры в хранилище
                    store.setStageFilters(stageFilters);
                    // --- КОНЕЦ НОВОГО КОДА ---
                    
                    // 4. Рендерим проекты, передавая в функцию фильтры из хранилища
                    render.renderProjects(data.projects, data.userName, data.userRole, {}, store.getStageFilters());
                    
                    handlers.handleBackgroundDataFetch();
                    

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

/**
 * Загружает в фоне все детальные данные (связи).
 * @returns {Promise<object>}
 */
export function fetchAllConnections() {
    return fetch('/api/details/all-connections')
        .then(res => {
            if (!res.ok) throw new Error('Ошибка фоновой загрузки данных');
            return res.json();
        });
}