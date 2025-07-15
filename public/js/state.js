// Файл: public/js/state.js
// Этот модуль хранит глобальное состояние приложения.

// Переменные для хранения списков, загруженных с сервера.
export let availableStatuses = [];
export let availableEmployees = [];

/**
 * Устанавливает начальные данные, полученные от сервера.
 * @param {object} data - Объект с данными { statuses, employees }.
 */
export function setInitialData(data) {
    availableStatuses = data.statuses || [];
    availableEmployees = data.employees || [];
}
