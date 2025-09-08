// public/js/store.js

// --- НАЧАЛО ЗАМЕНЫ ФАЙЛА ---

// Приватные переменные, доступные только внутри этого модуля
let _appData = {};
let _allProjects = [];
let _allUsers = [];
let _allStatuses = [];
let stageFilters = {};
let activeStageFilters = new Set();

// Приватные переменные для фоновой загрузки
let _allProjectMembers = [];
let _allTaskMembers = [];
let _allProjectStages = [];

/**
 * Сохраняет данные, полученные в фоне.
 */
export function setAllConnections(connections) {
    if (!connections) return;
    _allProjectMembers = connections.projectMembers || [];
    _allTaskMembers = connections.taskMembers || [];
    _allProjectStages = connections.projectStages || [];
    console.log('[STORE.JS LOG] Background data loaded and stored.', {
        projectMembersCount: _allProjectMembers.length,
        taskMembersCount: _allTaskMembers.length,
        projectStagesCount: _allProjectStages.length
    });
}

/**
 * Возвращает всех участников всех проектов (из фоновой загрузки).
 */
export function getAllProjectMembers() {
    return _allProjectMembers;
}

/**
 * Возвращает все активные этапы для всех проектов (из фоновой загрузки).
 */
export function getAllProjectStages() {
    return _allProjectStages;
}

/**
 * Сохраняет все начальные данные приложения в хранилище.
 */
export function setAppData(data) {
    if (!data) return;
    _appData = data;
    _allProjects = data.allProjects || [];
    _allUsers = data.allUsers || [];
    _allStatuses = data.allStatuses || [];
}

/**
 * Устанавливает все доступные этапы как активные по умолчанию.
 */
export function selectAllStagesByDefault() {
    if (!_appData.allStages) return;
    const allStageIds = _appData.allStages.map(stage => String(stage.stageId));
    activeStageFilters = new Set(allStageIds);
}

/**
 * Возвращает полный объект данных приложения.
 */
export function getAppData() {
    return _appData;
}

/**
 * Возвращает массив со всеми проектами.
 */
export function getAllProjects() {
    return _allProjects;
}

/**
 * Возвращает массив со всеми сотрудниками.
 */
export function getAllUsers() {
    return _allUsers;
}

/**
 * Возвращает массив со всеми статусами.
 */
export function getAllStatuses() {
    return _allStatuses;
}

/**
 * Находит задачу и ее проект по taskId.
 */
export function findTask(taskId) {
    if (!_appData.projects) return { task: null, project: null };
    for (const project of _appData.projects) {
        const task = project.tasks.find(t => t.taskId == taskId);
        if (task) return { task, project };
    }
    return { task: null, project: null };
}

export const setStageFilters = (filters) => { stageFilters = filters; };
export const getStageFilters = () => stageFilters;

export const getStageNameById = (stageId) => {
    if (!stageId) return 'Без этапа';
    const data = getAppData();
    if (!data || !data.allStages) {
        return 'Неизвестный этап';
    }
    const stage = data.allStages.find(s => String(s.stageId) === String(stageId));
    return stage ? stage.name : 'Неизвестный этап';
};

// --- КОНЕЦ ЗАМЕНЫ ФАЙЛА ---

export function getActiveStageFilters() {
    return Array.from(activeStageFilters);
}

export function updateStageFilters(stageId, isSelected) {
    if (isSelected) {
        activeStageFilters.add(String(stageId));
    } else {
        activeStageFilters.delete(String(stageId));
    }
}