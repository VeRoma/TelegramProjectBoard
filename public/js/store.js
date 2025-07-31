// public/js/store.js

// Приватные переменные, доступные только внутри этого модуля
let _appData = {};
let _allProjects = [];
let _allEmployees = [];

/**
 * Сохраняет все начальные данные приложения в хранилище.
 * @param {object} data - Полный объект данных, полученный от сервера.
 */
export function setAppData(data) {
    if (!data) return;
    _appData = data;
    _allProjects = data.allProjects || [];
    _allEmployees = data.allEmployees || [];
}

/**
 * Возвращает полный объект данных приложения.
 * @returns {object}
 */
export function getAppData() {
    return _appData;
}

/**
 * Возвращает массив со всеми проектами.
 * @returns {Array<string>}
 */
export function getAllProjects() {
    return _allProjects;
}

/**
 * Возвращает массив со всеми сотрудниками.
 * @returns {Array<object>}
 */
export function getAllEmployees() {
    return _allEmployees;
}

/**
 * Находит задачу и ее проект по rowIndex.
 * @param {number} rowIndex - Уникальный номер строки задачи.
 * @returns {{task: object|null, project: object|null}}
 */
export function findTask(rowIndex) {
    for (const project of _appData.projects || []) {
        const task = project.tasks.find(t => t.rowIndex == rowIndex);
        if (task) return { task, project };
    }
    return { task: null, project: null };
}