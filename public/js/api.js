// Этот модуль отвечает за все коммуникации с нашим Node.js сервером.

/**
 * Загружает все данные приложения с сервера.
 * @returns {Promise<object>} - Промис с данными приложения.
 */
export function loadAppData() {
    return fetch('/api/appdata', { method: 'POST' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        });
}

/**
 * Сохраняет изменения в задаче на сервере.
 * @param {object} taskData - Объект с данными задачи для обновления.
 * @returns {Promise<object>}
 */
export function saveTask(taskData) {
    return fetch('/api/updatetask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    });
}