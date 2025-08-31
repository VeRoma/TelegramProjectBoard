const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { SHEET_NAMES, TASK_COLUMNS, USER_COLUMNS, PROJECT_COLUMNS, MEMBER_COLUMNS, STATUS_COLUMNS, ERROR_MESSAGES } = require('../config/constants');

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

// --- ИЗМЕНЕНИЕ №1: Фильтрация удаленных задач ---
const getTasks = async () => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    const rows = await tasksSheet.getRows();
    // Фильтруем задачи, чтобы не получать те, у которых is_deleted = TRUE
    return rows.filter(row => row.get('is_deleted') !== 'TRUE');
};

const getEmployeeById = async (tgUserId) => {
    const allUsers = await getAllUsers();
    return allUsers.find(user => user.tgUserId == tgUserId);
};

const getOwnerEmployee = async () => {
    const allUsers = await getAllUsers();
    return allUsers.find(user => user.role === 'owner');
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

    await rowToUpdate.save();
    return currentVersion + 1;
};

const addTaskToSheet = async (newTaskData, creatorName) => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    const rows = await tasksSheet.getRows();
    const maxId = rows.reduce((max, row) => Math.max(max, parseInt(row.get(TASK_COLUMNS.TASK_ID), 10) || 0), 0);
    const newTaskId = maxId + 1;

    const newRowData = {
        [TASK_COLUMNS.TASK_ID]: newTaskId,
        [TASK_COLUMNS.NAME]: newTaskData.name,
        [TASK_COLUMNS.PROJECT_ID]: newTaskData.projectId,
        [TASK_COLUMNS.USER_ID]: newTaskData.responsibleUserIds[0],
        [TASK_COLUMNS.STATUS_ID]: newTaskData.statusId,
        [TASK_COLUMNS.PRIORITY]: newTaskData.priority,
        [TASK_COLUMNS.VERSION]: 0,
        [TASK_COLUMNS.AUTHOR_USER_ID]: newTaskData.creatorId,
        'is_deleted': 'FALSE' // Явно указываем при создании
    };

    const addedRow = await tasksSheet.addRow(newRowData);
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

// --- ИЗМЕНЕНИЕ №2: Новая функция для "мягкого" удаления ---
const archiveTaskInSheet = async (taskId, modifierName) => {
    try {
        const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
        const rows = await tasksSheet.getRows();
        const taskRow = rows.find(row => row.get(TASK_COLUMNS.TASK_ID) == taskId);

        if (taskRow) {
            // Устанавливаем флаг удаления
            taskRow.set('is_deleted', 'TRUE'); 
            
            // Опционально: можно добавить столбцы 'deleted_by' и 'deleted_at' в вашу таблицу
            // и раскомментировать эти строки для логирования
            // taskRow.set('deleted_by', modifierName);
            // taskRow.set('deleted_at', new Date().toISOString());
            
            await taskRow.save();
            return { success: true };
        } else {
            throw new Error('Task not found in Google Sheets');
        }
    } catch (error) {
        console.error('Error archiving task in sheet:', error);
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
        Name: user.first_name || 'N/A'
    });
};

const getProjectIdsByUserId = async (userId) => {
    // Убедитесь, что в constants.js у вас есть SHEET_NAMES.PROJECT_MEMBERS
    const sheet = await getSheet(SHEET_NAMES.PROJECT_MEMBERS);
    if (!sheet) return [];
    
    const rows = await sheet.getRows();
    const projectIds = new Set();
    
    rows.forEach(row => {
        // Убедитесь, что названия столбцов соответствуют вашей таблице
        if (row.get('user_id') == userId && row.get('is_active') === 'TRUE') {
            projectIds.add(row.get('project_id'));
        }
    });

    return Array.from(projectIds);
};

const getMemberIdsByProjectId = async (projectId) => {
    const sheet = await getSheet(SHEET_NAMES.PROJECT_MEMBERS);
    if (!sheet) return [];
    
    const rows = await sheet.getRows();
    const memberIds = new Set();
    
    rows.forEach(row => {
        // Убедитесь, что названия столбцов соответствуют вашей таблице
        if (row.get('project_id') == projectId && row.get('is_active') === 'TRUE') {
            memberIds.add(row.get('user_id'));
        }
    });

    return Array.from(memberIds);
};

// 2. Добавьте эту функцию для обновления списка участников
const updateProjectMembersInSheet = async (projectId, newMemberIds, modifierName) => {
    const sheet = await getSheet(SHEET_NAMES.PROJECT_MEMBERS);
    const rows = await sheet.getRows();
    const existingMembers = rows.filter(row => row.get('project_id') == projectId);

    const existingMemberIds = new Set(existingMembers.map(row => row.get('user_id')));
    const newMemberIdsSet = new Set(newMemberIds);

    const toDeactivate = existingMembers.filter(row => !newMemberIdsSet.has(row.get('user_id')));
    const toAdd = newMemberIds.filter(id => !existingMemberIds.has(id));

    // Деактивируем старых
    for (const row of toDeactivate) {
        row.set('is_active', 'FALSE');
        await row.save();
    }

    // Добавляем новых
    const newRows = toAdd.map(userId => ({
        'project_id': projectId,
        'user_id': userId,
        'is_active': 'TRUE',
        'date_added': new Date().toISOString()
    }));

    if (newRows.length > 0) {
        await sheet.addRows(newRows);
    }

    return { success: true };
};

// --- ИЗМЕНЕНИЕ №3: Экспортируем новую функцию ---
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
    archiveTaskInSheet, 
    getProjectIdsByUserId,
    getMemberIdsByProjectId,
    updateProjectMembersInSheet,
    logUserAccess,
    doc,
    getAllEmployees: getAllUsers
};