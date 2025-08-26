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
            logs: doc.sheetsByTitle[SHEET_NAMES.LOGS]
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
        icon: row.get(STATUS_COLUMNS.ICON),
        order: parseInt(row.get(STATUS_COLUMNS.ORDER), 10) || 99
    }));
};

const getTasks = async () => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    return await tasksSheet.getRows();
};

const getEmployeeById = async (tgUserId) => {
    const allUsers = await getAllUsers();
    return allUsers.find(user => user.tgUserId == tgUserId);
};

const getOwnerEmployee = async () => {
    const allUsers = await getAllUsers();
    return allUsers.find(user => user.role === EMPLOYEE_ROLES.OWNER);
};

const updateTaskInSheet = async (taskData, modifierName) => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    const rows = await tasksSheet.getRows();
    const rowToUpdate = rows.find(row => row.get(TASK_COLUMNS.TASK_ID) == taskData.taskId);

    if (!rowToUpdate) {
        throw new Error(ERROR_MESSAGES.TASK_NOT_FOUND);
    }
    
    const currentVersion = parseInt(rowToUpdate.get(TASK_COLUMNS.VERSION) || 0);
    if (taskData.version !== undefined && taskData.version !== currentVersion) {
        throw new Error(ERROR_MESSAGES.TASK_UPDATE_CONFLICT);
    }

    rowToUpdate.set(TASK_COLUMNS.NAME, taskData.name);
    rowToUpdate.set(TASK_COLUMNS.STATUS_ID, taskData.statusId);
    rowToUpdate.set(TASK_COLUMNS.PROJECT_ID, taskData.projectId);
    
    rowToUpdate.set(TASK_COLUMNS.VERSION, currentVersion + 1);
    rowToUpdate.set(TASK_COLUMNS.MODIFIED_BY, modifierName);
    rowToUpdate.set(TASK_COLUMNS.MODIFIED_AT, new Date().toLocaleString('ru-RU'));

    await rowToUpdate.save();
    return currentVersion + 1;
};

const addTaskToSheet = async (newTaskData, creatorName) => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    const now = new Date().toLocaleString('ru-RU');
    
    // Генерируем новый task_id. Простой способ - найти максимальный существующий и прибавить 1.
    const rows = await tasksSheet.getRows();
    const maxId = rows.reduce((max, row) => Math.max(max, parseInt(row.get(TASK_COLUMNS.TASK_ID), 10) || 0), 0);
    const newTaskId = maxId + 1;

    const newRowData = {
        [TASK_COLUMNS.TASK_ID]: newTaskId,
        [TASK_COLUMNS.NAME]: newTaskData.name,
        [TASK_COLUMNS.PROJECT_ID]: newTaskData.projectId,
        [TASK_COLUMNS.USER_ID]: newTaskData.responsibleUserIds[0], // Основной ответственный
        [TASK_COLUMNS.STATUS_ID]: newTaskData.statusId,
        [TASK_COLUMNS.PRIORITY]: newTaskData.priority,
        [TASK_COLUMNS.VERSION]: 0,
        [TASK_COLUMNS.MODIFIED_BY]: creatorName,
        [TASK_COLUMNS.MODIFIED_AT]: now,
        [TASK_COLUMNS.AUTHOR_USER_ID]: newTaskData.creatorId
    };

    const addedRow = await tasksSheet.addRow(newRowData);
    
    // Логика для добавления остальных ответственных в таблицу Members должна быть здесь, если требуется
    
    return [addedRow];
};

const updateTaskPrioritiesInSheet = async (tasksToUpdate) => {
    try {
        const sheet = await getSheet(SHEET_NAMES.TASKS);
        const rows = await sheet.getRows();

        const rowMap = new Map();
        rows.forEach(row => {
            rowMap.set(row.get(TASK_COLUMNS.TASK_ID), row);
        });

        const promises = tasksToUpdate.map(task => {
            const row = rowMap.get(task.taskId);
            if (row) {
                if (task.statusId !== undefined) {
                    row.set(TASK_COLUMNS.STATUS_ID, task.statusId);
                }
                if (task.priority !== undefined) {
                    row.set(TASK_COLUMNS.PRIORITY, task.priority);
                }
                return row.save();
            }
            return Promise.resolve();
        });

        await Promise.all(promises);
        return { success: true };
    } catch (error) {
        console.error('Error updating priorities in sheet:', error);
        throw new Error(ERROR_MESSAGES.GOOGLE_SHEET_UPDATE_ERROR);
    }
};

const logUserAccess = async (user) => {
    const logSheet = doc.sheetsByTitle[SHEET_NAMES.LOGS];
    if (!logSheet) return;
    await logSheet.addRow({
        Timestamp: new Date().toISOString(),
        UserID: user.id,
        Username: user.username || '',
        FirstName: user.first_name || '',
        LastName: user.last_name || ''
    });
};

module.exports = {
    loadSheetDataMiddleware,
    getSheet,
    getAllUsers,
    getAllProjects,
    getAllMembers,
    getAllStatuses,
    getTasks,
    getEmployeeById,
    getOwnerEmployee,
    updateTaskInSheet,
    addTaskToSheet,
    updateTaskPrioritiesInSheet,
    logUserAccess,
    doc
};