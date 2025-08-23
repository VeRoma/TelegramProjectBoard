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
            statuses: doc.sheetsByTitle[SHEET_NAMES.STATUSES],
        };
        if (!req.sheets.tasks || !req.sheets.projects || !req.sheets.users || !req.sheets.statuses) {
            return res.status(500).json({ error: `Обязательные листы не найдены.` });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: ERROR_MESSAGES.GOOGLE_SHEET_ACCESS_ERROR });
    }
};

const getSheet = async (sheetTitle) => {
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[sheetTitle];
    if (!sheet) throw new Error(`Sheet "${sheetTitle}" not found.`);
    return sheet;
};

// --- Функции для работы со справочниками ---

const getAllUsers = async () => {
    const sheet = await getSheet(SHEET_NAMES.USERS);
    const rows = await sheet.getRows();
    return rows.map(row => ({
        userId: row.get(USER_COLUMNS.USER_ID),
        tgUserId: row.get(USER_COLUMNS.TG_USER_ID),
        name: row.get(USER_COLUMNS.NAME),
        role: row.get(USER_COLUMNS.ROLE)
    }));
};

const getAllProjects = async () => {
    const sheet = await getSheet(SHEET_NAMES.PROJECTS);
    const rows = await sheet.getRows();
    return rows.map(row => ({
        projectId: row.get(PROJECT_COLUMNS.PROJECT_ID),
        projectName: row.get(PROJECT_COLUMNS.PROJECT_NAME),
    }));
};

const getAllMembers = async () => {
    const sheet = await getSheet(SHEET_NAMES.MEMBERS);
    if (!sheet) return [];
    const rows = await sheet.getRows();
    return rows.map(row => ({
        memberId: row.get(MEMBER_COLUMNS.MEMBER_ID),
        taskId: row.get(MEMBER_COLUMNS.TASK_ID),
        userId: row.get(MEMBER_COLUMNS.USER_ID)
    }));
};

const getAllStatuses = async () => {
    const sheet = await getSheet(SHEET_NAMES.STATUSES);
    const rows = await sheet.getRows();
    return rows.map(row => ({
        statusId: row.get(STATUS_COLUMNS.STATUS_ID),
        name: row.get(STATUS_COLUMNS.STATUS_NAME),
    }));
};

const getTasks = async () => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    return await tasksSheet.getRows();
};

// --- Восстановленные функции, адаптированные под новую структуру ---

// Эта функция теперь синоним getAllUsers для совместимости
const getAllEmployees = getAllUsers;

// Ищем пользователя по его TG UserID
const getEmployeeById = async (tgUserId) => {
    const allUsers = await getAllUsers();
    return allUsers.find(user => user.tgUserId == tgUserId);
};

const getOwnerEmployee = async () => {
    const allUsers = await getAllUsers();
    return allUsers.find(user => user.role === EMPLOYEE_ROLES.OWNER);
};

// "Заглушки" для функций, которые мы реализуем на следующих этапах
const updateTaskInSheet = async () => Promise.resolve();
const addTaskToSheet = async () => Promise.resolve([]);
const updateTaskPrioritiesInSheet = async () => Promise.resolve();
const logUserAccess = async () => Promise.resolve();


module.exports = {
    loadSheetDataMiddleware,
    getSheet,
    getAllUsers,
    getAllProjects,
    getAllMembers,
    getAllStatuses,
    getTasks,
    // --- Восстанавливаем экспорты ---
    getEmployeeById,
    getOwnerEmployee,
    getAllEmployees,
    updateTaskInSheet,
    addTaskToSheet,
    updateTaskPrioritiesInSheet,
    logUserAccess,
    doc
};