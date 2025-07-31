const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { SHEET_NAMES, TASK_COLUMNS, EMPLOYEE_ROLES, ERROR_MESSAGES } = require('../config/constants');

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
            statuses: doc.sheetsByTitle[SHEET_NAMES.STATUSES],
            employees: doc.sheetsByTitle[SHEET_NAMES.EMPLOYEES],
            logs: doc.sheetsByTitle[SHEET_NAMES.LOGS]
        };
        if (!req.sheets.tasks || !req.sheets.statuses || !req.sheets.employees || !req.sheets.logs) {
            return res.status(500).json({ error: ERROR_MESSAGES.SHEET_MISSING });
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

const getEmployeeById = async (userId) => {
    const employeesSheet = await getSheet(SHEET_NAMES.EMPLOYEES);
    const rows = await employeesSheet.getRows();
    return rows.find(row => row.get(TASK_COLUMNS.USER_ID) == userId);
};

const getOwnerEmployee = async () => {
    const employeesSheet = await getSheet(SHEET_NAMES.EMPLOYEES);
    const rows = await employeesSheet.getRows();
    return rows.find(row => row.get(TASK_COLUMNS.EMPLOYEE_ROLE) === EMPLOYEE_ROLES.OWNER);
};

const getAllEmployees = async () => {
    const employeesSheet = await getSheet(SHEET_NAMES.EMPLOYEES);
    const rows = await employeesSheet.getRows();
    return rows.map(row => ({
        name: row.get(TASK_COLUMNS.EMPLOYEE_NAME),
        phoneNumber: row.get(TASK_COLUMNS.EMPLOYEE_PHONE),
        userId: row.get(TASK_COLUMNS.USER_ID),
        role: row.get(TASK_COLUMNS.EMPLOYEE_ROLE)
    }));
};

const getTasks = async () => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    return await tasksSheet.getRows();
};

const updateTaskInSheet = async (taskData, modifierName) => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    const rows = await tasksSheet.getRows();
    const rowToUpdate = rows.find(row => row.get(TASK_COLUMNS.ROW_INDEX) == taskData.rowIndex);

    if (!rowToUpdate) {
        throw new Error(ERROR_MESSAGES.TASK_NOT_FOUND);
    }
    
    const currentVersion = parseInt(rowToUpdate.get(TASK_COLUMNS.VERSION) || 0);
    if (taskData.version !== undefined && taskData.version !== currentVersion) {
        throw new Error('Данные задачи были изменены другим пользователем. Обновите страницу и повторите попытку.');
    }

    rowToUpdate.set(TASK_COLUMNS.NAME, taskData.name);
    rowToUpdate.set(TASK_COLUMNS.STATUS, taskData.status);
    rowToUpdate.set(TASK_COLUMNS.PROJECT, taskData.project);
    rowToUpdate.set(TASK_COLUMNS.RESPONSIBLE, Array.isArray(taskData.responsible) ? taskData.responsible.join(', ') : taskData.responsible);
    rowToUpdate.set(TASK_COLUMNS.MESSAGE, taskData.message);
    rowToUpdate.set(TASK_COLUMNS.VERSION, currentVersion + 1);
    
    if (taskData.status === 'Выполнено') {
        rowToUpdate.set(TASK_COLUMNS.PRIORITY, 999);
    } else if (taskData.приоритет !== undefined) {
        rowToUpdate.set(TASK_COLUMNS.PRIORITY, taskData.приоритет);
    }

    rowToUpdate.set(TASK_COLUMNS.MODIFIED_BY, modifierName);
    rowToUpdate.set(TASK_COLUMNS.MODIFIED_AT, new Date().toLocaleString('ru-RU'));

    await rowToUpdate.save();
    return currentVersion + 1;
};

const addTaskToSheet = async (newTaskData, creatorName) => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    const newRowData = {
        [TASK_COLUMNS.NAME]: newTaskData.name,
        [TASK_COLUMNS.PROJECT]: newTaskData.project,
        [TASK_COLUMNS.STATUS]: newTaskData.status,
        [TASK_COLUMNS.RESPONSIBLE]: newTaskData.responsible,
        [TASK_COLUMNS.MESSAGE]: newTaskData.message,
        [TASK_COLUMNS.PRIORITY]: newTaskData.приоритет,
        [TASK_COLUMNS.VERSION]: 0,
        [TASK_COLUMNS.MODIFIED_BY]: creatorName,
        [TASK_COLUMNS.MODIFIED_AT]: new Date().toLocaleString('ru-RU')
    };
    const newRow = await tasksSheet.addRow(newRowData);
    const newRowIndex = newRow.rowNumber;
    newRow.set(TASK_COLUMNS.ROW_INDEX, newRowIndex);
    await newRow.save();
    return newRow;
};

const updateTaskPrioritiesInSheet = async (updatedTasks, modifierName) => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    
    const rows = await tasksSheet.getRows();
    const rowMap = new Map(rows.map(row => [row.get(TASK_COLUMNS.ROW_INDEX).toString(), row]));

    const now = new Date().toLocaleString('ru-RU');
    const promisesToSave = [];

    for (const task of updatedTasks) {
        const rowToUpdate = rowMap.get(task.rowIndex.toString());
        if (rowToUpdate) {
            const oldPriority = rowToUpdate.get(TASK_COLUMNS.PRIORITY);
            const oldStatus = rowToUpdate.get(TASK_COLUMNS.STATUS);
            
            // --- ФИНАЛЬНАЯ ЛОГИКА ЛОГИРОВАНИЯ ---
            if (task.status && task.status !== oldStatus) {
                console.log(`[LOG] Задача "${task.name}": статус изменен с "${oldStatus}" на "${task.status}", приоритет изменен с ${oldPriority} на ${task.приоритет}.`);
                rowToUpdate.set(TASK_COLUMNS.STATUS, task.status);
            } else if (oldPriority != task.приоритет) {
                 console.log(`[LOG] Задача "${task.name}": приоритет изменен с ${oldPriority} на ${task.приоритет}.`);
            }
            
            rowToUpdate.set(TASK_COLUMNS.PRIORITY, task.приоритет);
            rowToUpdate.set(TASK_COLUMNS.MODIFIED_BY, modifierName);
            rowToUpdate.set(TASK_COLUMNS.MODIFIED_AT, now);
            promisesToSave.push(rowToUpdate.save());
        }
    }
    
    if (promisesToSave.length > 0) {
        await Promise.all(promisesToSave);
    }
};

const logUserAccess = async (user) => {
    const logSheet = await getSheet(SHEET_NAMES.LOGS);
    await logSheet.addRow({
        [TASK_COLUMNS.TIMESTAMP]: new Date().toISOString(),
        [TASK_COLUMNS.USER_ID]: user.id,
        [TASK_COLUMNS.USERNAME]: user.username || '',
        [TASK_COLUMNS.FIRST_NAME]: user.first_name || '',
        [TASK_COLUMNS.LAST_NAME]: user.last_name || ''
    });
};

module.exports = {
    loadSheetDataMiddleware,
    getSheet,
    getEmployeeById,
    getOwnerEmployee,
    getAllEmployees,
    getTasks,
    updateTaskInSheet,
    addTaskToSheet,
    updateTaskPrioritiesInSheet,
    logUserAccess,
    doc
};