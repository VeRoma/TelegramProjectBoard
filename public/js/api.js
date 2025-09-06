/**
 * Загружает начальные данные для приложения.
 * @param {object} payload - Данные пользователя для верификации.
 * @returns {Promise<object>}
 */
export function loadAppData(payload) {
    return fetch('/api/appdata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(res => {
        if (!res.ok) throw new Error('Ошибка при загрузке данных приложения');
        return res.json();
    });
}

/**
 * Обновляет существующую задачу на сервере.
 * @param {object} payload - Объект с данными задачи и именем изменившего.
 * @returns {Promise<object>}
 */
export function saveTask(payload) {
    return fetch('/api/updatetask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(res => {
        if (!res.ok) throw new Error('Ошибка при сохранении задачи');
        return res.json();
    });
}

/**
 * Проверяет пользователя на сервере.
 * @param {object} user - Объект пользователя от Telegram.
 * @returns {Promise<object>}
 */
export function verifyUser(user) {
    return fetch('/api/verifyuser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user })
    }).then(res => {
        if (!res.ok) throw new Error('Ошибка верификации');
        return res.json();
    });
}

/**
 * Отправляет запрос на регистрацию нового пользователя.
 * @param {string} name - Имя, которое ввел пользователь.
 * @param {string} userId - ID пользователя в Telegram.
 * @returns {Promise<object>}
 */
export function requestRegistration(name, userId) {
    return fetch('/api/requestregistration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, userId })
    }).then(res => {
        if (!res.ok) throw new Error('Ошибка отправки запроса на регистрацию');
        return res.json();
    });
}

/**
 * Логирует действие на стороне клиента на сервере.
 * @param {string} message - Сообщение для лога.
 * @param {object} context - Дополнительный контекст.
 */
export function logAction(message, context = {}) {
    fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            level: context.level || 'INFO',
            message,
            context
        })
    }).catch(error => console.error('Не удалось залогировать действие:', error));
}

/**
 * Обновляет приоритеты для нескольких задач одним запросом.
 * @param {object} payload - Объект с массивом задач и именем изменившего.
 * @returns {Promise<object>}
 */
export async function updatePriorities(payload) {

    console.log('Updating priorities with payload:', payload);

    // --- ИСПРАВЛЕНИЕ ЗДЕСЬ: Отправляем payload напрямую ---
    const res = await fetch('/api/updatepriorities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Ошибка обновления приоритетов');
    return await res.json();
}

/**
 * Добавляет новую задачу на сервер.
 * @param {object} payload - Объект с данными новой задачи и именем создателя.
 * @returns {Promise<object>}
 */
export function addTask(payload) {
    return fetch('/api/addtask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(res => {
        if (!res.ok) throw new Error('Ошибка добавления задачи');
        return res.json();
    });
}

/**
 * Отправляет запрос на удаление (архивацию) задачи.
 * @param {object} payload - Объект с taskId и именем пользователя.
 * @returns {Promise<object>}
 */
export function deleteTask(payload) {
    return fetch('/api/deletetask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(res => {
        if (!res.ok) throw new Error('Ошибка при удалении задачи');
        return res.json();
    });
}

/**
 * Запрашивает список ID участников для конкретного проекта.
 * @param {string} projectId ID проекта.
 * @returns {Promise<string[]>}
 */
export function getProjectMembers(projectId) {
    return fetch(`/api/project/${projectId}/members`)
        .then(res => {
            if (!res.ok) throw new Error('Ошибка при загрузке участников проекта');
            return res.json();
        });
}

/**
 * Обновляет список участников проекта.
 * @param {string} projectId ID проекта.
 * @param {object} payload Объект с массивом memberIds и modifierName.
 * @returns {Promise<object>}
 */
export function updateProjectMembers(projectId, payload) {
    return fetch(`/api/project/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(res => {
        if (!res.ok) throw new Error('Ошибка при сохранении участников проекта');
        return res.json();
    });
}

/**
 * Запрашивает с сервера полный список всех этапов.
 * @returns {Promise<object[]>}
 */
export function getAllStages() {
    return fetch('/api/stages').then(res => {
        if (!res.ok) throw new Error('Ошибка при загрузке списка этапов');
        return res.json();
    });
}

/**
 * Обновляет список активных этапов для проекта.
 * @param {string} projectId ID проекта.
 * @param {object} payload Объект с массивом stageIds.
 * @returns {Promise<object>}
 */
export function updateProjectStages(projectId, payload) {
    return fetch(`/api/project/${projectId}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(res => {
        if (!res.ok) throw new Error('Ошибка при сохранении этапов проекта');
        return res.json();
    });
}

/**
 * Запрашивает список ID активных этапов для конкретного проекта.
 * @param {string} projectId ID проекта.
 * @returns {Promise<string[]>}
 */
export function getProjectStages(projectId) {
    return fetch(`/api/project/${projectId}/stages`)
        .then(res => {
            if (!res.ok) throw new Error('Ошибка при загрузке активных этапов проекта');
            return res.json();
        });
}

/**
 * Обновляет состав исполнителей и куратора для задачи.
 * @param {string} taskId ID задачи.
 * @param {object} payload Объект с curatorId, memberIds и modifierName.
 * @returns {Promise<object>}
 */
export function updateTaskMembers(taskId, payload) {
    return fetch(`/api/task/${taskId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(res => {
        if (!res.ok) {
            // Попытаемся получить текст ошибки с сервера
            return res.json().then(errorData => {
                throw new Error(errorData.error || 'Ошибка при обновлении исполнителей');
            });
        }
        return res.json();
    });
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

