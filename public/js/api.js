export function loadAppData(payload) {
    return fetch('/api/appdata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Отправляем объект напрямую, без дополнительной обёртки
        body: JSON.stringify(payload)
    }).then(res => res.json());
}

export function saveTask(taskData) {
    return fetch('/api/updatetask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
    }).then(res => res.json());
}
export function verifyUser(user) {
    return fetch('/api/verifyuser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user })
    }).then(res => res.json());
}
export function requestRegistration(name, userId) {
    return fetch('/api/requestregistration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, userId })
    }).then(res => res.json());
}

// Новая функция для логирования действий на сервере
export function logAction(message, context = {}) {
    fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            level: context.level || 'INFO',
            message,
            context
        })
    }).catch(error => console.error('Failed to log action:', error)); // Логируем ошибку логирования локально
}

export function updatePriorities(tasks) {
    return fetch('/api/updatepriorities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks })
    }).then(res => res.json());
}

export function addTask(taskData) {
    return fetch('/api/addtask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
    }).then(res => res.json());
}