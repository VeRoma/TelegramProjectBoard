const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { SHEET_NAMES, TASK_COLUMNS, USER_COLUMNS, PROJECT_COLUMNS, MEMBER_COLUMNS, STATUS_COLUMNS, EMPLOYEE_ROLES, ERROR_MESSAGES } = require('../config/constants');

const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);

const loadSheetDataMiddleware = async (req, res, next) => {
    try {
        await doc.loadInfo();
        req.sheets = {
            tasks: doc.sheetsByTitle[SHEET_NAMES.TASKS],
            projects: doc.sheetsByTitle[SHEET_NAMES.PROJECTS],
            users: doc.sheetsByTitle[SHEET_NAMES.USERS],
            members: doc.sheetsByTitle[SHEET_NAMES.MEMBERS],
            statuses: doc.sheetsByTitle[SHEET_NAMES.STATUSES]
        };
        if (!req.sheets.tasks || !req.sheets.projects || !req.sheets.users || !req.sheets.statuses) {
            return res.status(500).json({ error: `Обязательные листы не найдены. Убедитесь, что существуют листы: ${SHEET_NAMES.TASKS}, ${SHEET_NAMES.PROJECTS}, ${SHEET_NAMES.USERS}, ${SHEET_NAMES.STATUSES}` });
        }
        next();
    } catch (error) {
        console.error('Error loading Google Sheets info:', error);
        res.status(500).json({ error: ERROR_MESSAGES.GOOGLE_SHEET_ACCESS_ERROR });
    }
};

const getSheet = async (sheetTitle) => {
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[sheetTitle];
    if (!sheet) throw new Error(`Sheet "${sheetTitle}" not found.`);
    return sheet;
};

/**
 * Получает всех сотрудников из Google Таблицы и преобразует их в стандартные JS-объекты.
 * Это основная функция для получения данных о сотрудниках.
 * @returns {Promise<Array<object>>} Массив объектов сотрудников.
 */
const getAllEmployees = async () => {
    const usersSheet = await getSheet(SHEET_NAMES.USERS);
    const rows = await usersSheet.getRows();
    // Преобразуем строки таблицы в стандартизированные объекты
    return rows.map(row => ({
        userId: row.get(USER_COLUMNS.USER_ID),
        tgUserId: row.get(USER_COLUMNS.TG_USER_ID),
        name: row.get(USER_COLUMNS.NAME),
        role: row.get(USER_COLUMNS.ROLE),
    }));
};

/**
 * Находит сотрудника по его Telegram User ID, используя данные из getAllEmployees.
 * @param {string|number} tgUserId - Telegram User ID сотрудника.
 * @returns {Promise<object|undefined>} Объект сотрудника или undefined, если не найден.
 */
const getEmployeeById = async (tgUserId) => {
    const employees = await getAllEmployees();
    // Сравниваем как строки, чтобы избежать проблем с типами данных (число vs строка)
    return employees.find(employee => String(employee.tgUserId) === String(tgUserId));
};

/**
 * Находит сотрудника с ролью "Владелец", используя данные из getAllEmployees.
 * @returns {Promise<object|undefined>} Объект владельца или undefined, если не найден.
 */
const getOwnerEmployee = async () => {
    const employees = await getAllEmployees();
    return employees.find(employee => employee.role === EMPLOYEE_ROLES.OWNER);
};

const getAllProjects = async () => {
    const projectsSheet = await getSheet(SHEET_NAMES.PROJECTS);
    const rows = await projectsSheet.getRows();
    return rows.map(row => ({
        projectId: row.get(PROJECT_COLUMNS.PROJECT_ID),
        projectName: row.get(PROJECT_COLUMNS.PROJECT_NAME),
    }));
};

const getAllStatuses = async () => {
    const statusesSheet = await getSheet(SHEET_NAMES.STATUSES);
    const rows = await statusesSheet.getRows();
    return rows.map(row => ({
        statusId: row.get(STATUS_COLUMNS.STATUS_ID),
        statusName: row.get(STATUS_COLUMNS.STATUS_NAME),
    }));
};

const getAllMembers = async () => {
    const membersSheet = await getSheet(SHEET_NAMES.MEMBERS);
    if (!membersSheet) return [];
    const rows = await membersSheet.getRows();
    return rows.map(row => ({
        memberId: row.get(MEMBER_COLUMNS.MEMBER_ID),
        taskId: row.get(MEMBER_COLUMNS.TASK_ID),
        userId: row.get(MEMBER_COLUMNS.USER_ID)
    }));
};

const getTasks = async () => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    return await tasksSheet.getRows();
};

const addTaskToSheet = async (newTaskData, creatorName) => {
    // ... (Этот код будет реализован на следующем этапе)
};

const updateTaskInSheet = async (taskData, modifierName) => {
    // ... (Этот код будет реализован на следующем этапе)
};

const updateTaskPrioritiesInSheet = async (updatedTasks, modifierName) => {
     // ... (Этот код будет реализован на следующем этапе)
};

const logUserAccess = async (user) => {
     // ... (Этот код будет реализован на следующем этапе)
};

module.exports = {
    loadSheetDataMiddleware,
    getSheet,
    getAllStatuses,
    getAllProjects,
    getAllMembers,
    getTasks,
    // --- ВОССТАНАВЛИВАЕМ ЭКСПОРТЫ ---
    getEmployeeById,
    getOwnerEmployee,
    getAllEmployees,
    updateTaskInSheet,
    addTaskToSheet,
    updateTaskPrioritiesInSheet,
    logUserAccess,
    doc
};