const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { SHEET_NAMES, TASK_COLUMNS, USER_COLUMNS, PROJECT_COLUMNS, MEMBER_COLUMNS, ERROR_MESSAGES } = require('../config/constants');

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
        };
        if (!req.sheets.tasks || !req.sheets.projects || !req.sheets.users) {
            return res.status(500).json({ error: `Обязательные листы не найдены. Убедитесь, что существуют листы: ${SHEET_NAMES.TASKS}, ${SHEET_NAMES.PROJECTS}, ${SHEET_NAMES.USERS}` });
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

const getAllUsers = async () => {
    const usersSheet = await getSheet(SHEET_NAMES.USERS);
    const rows = await usersSheet.getRows();
    return rows.map(row => ({
        userId: row.get(USER_COLUMNS.USER_ID),
        tgUserId: row.get(USER_COLUMNS.TG_USER_ID),
        name: row.get(USER_COLUMNS.NAME),
        role: row.get(USER_COLUMNS.ROLE)
    }));
};

const getAllProjects = async () => {
    const projectsSheet = await getSheet(SHEET_NAMES.PROJECTS);
    const rows = await projectsSheet.getRows();
    return rows.map(row => ({
        projectId: row.get(PROJECT_COLUMNS.PROJECT_ID),
        projectName: row.get(PROJECT_COLUMNS.PROJECT_NAME),
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
    const rows = await tasksSheet.getRows();
    // Добавляем rowIndex в каждую строку для совместимости с фронтендом
    rows.forEach(row => {
        row.set(TASK_COLUMNS.ROW_INDEX, row.rowNumber);
    });
    return rows;
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
    getTasks,
    updateTaskInSheet,
    addTaskToSheet,
    updateTaskPrioritiesInSheet,
    logUserAccess,
    doc
};