// public/js/store.js

// Приватные переменные, доступные только внутри этого модуля
let _appData = {};
let _allProjects = [];
let _allEmployees = [];
let _allStatuses = [];

/**
 * Сохраняет все начальные данные приложения в хранилище.
 * @param {object} data - Полный объект данных, полученный от сервера.
 */
export function setAppData(data) {
    if (!data) return;
    _appData = data;
    _allProjects = data.allProjects || [];
    _allEmployees = data.allEmployees || [];
    _allStatuses = data.allStatuses || [];
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
 * @returns {Array<object>}
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
 * Возвращает массив со всеми статусами.
 * @returns {Array<object>}
 */
export function getAllStatuses() {
    return _allStatuses;
}

/**
 * Находит задачу и ее проект по taskId.
 * @param {string} taskId - Уникальный идентификатор задачи.
 * @returns {{task: object|null, project: object|null}}
 */
export function findTask(taskId) {
    if (!_appData.projects) return { task: null, project: null };
    
    for (const project of _appData.projects) {
        // Ищем задачу по taskId
        const task = project.tasks.find(t => t.taskId == taskId);
        if (task) return { task, project };
    }
    return { task: null, project: null };
}

let stageFilters = {};
export const setStageFilters = (filters) => { stageFilters = filters; };
export const getStageFilters = () => stageFilters;

// --- НАЧАЛО ЗАМЕНЫ ФУНКЦИИ ---

export const getStageNameById = (stageId) => {
    if (!stageId) return 'Без этапа';

    // Правильно получаем данные через функцию getAppData()
    const data = getAppData(); 
    if (!data || !data.allStages) {
        return 'Неизвестный этап';
    }

    const stage = data.allStages.find(s => String(s.stageId) === String(stageId));
    return stage ? stage.name : 'Неизвестный этап';
};

// --- КОНЕЦ ЗАМЕНЫ ФУНКЦИИ ---