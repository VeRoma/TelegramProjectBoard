export function loadAppData() {
    return fetch('/api/appdata', { method: 'POST' })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        });
}

export function saveTask(taskData) {
    return fetch('/api/updatetask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    });
}

/**
 * НОВАЯ ФУНКЦИЯ: Отправляет данные о пользователе на сервер для логирования.
 * @param {object} userData - Объект с данными пользователя от Telegram.
 */
export function logUserVisit(userData) {
    // Мы не ждем ответа, просто отправляем "в пустоту"
    fetch('/api/logvisit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    }).catch(error => console.error('Failed to log visit:', error));
}