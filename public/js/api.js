export function loadAppData() {
    return fetch('/api/appdata', { method: 'POST' }).then(res => res.json());
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