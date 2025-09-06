const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { 
    SHEET_NAMES, 
    TASK_COLUMNS, 
    USER_COLUMNS, 
    PROJECT_COLUMNS, 
    MEMBER_COLUMNS, 
    TASK_MEMBERS_COLUMNS, 
    STATUS_COLUMNS,
    PROJECT_MEMBERS_COLUMNS,
    PROJECT_STAGES_COLUMNS,
    STAGES_COLUMNS,
    LOG_COLUMNS,
    ERROR_MESSAGES 
} = require('../config/constants');

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
    const rows = await tasksSheet.getRows();
    return rows.filter(row => row.get(TASK_COLUMNS.IS_DELETED) !== 'TRUE');
};

const getUserById = async (tgUserId) => {
    const allUsers = await getAllUsers();
    return allUsers.find(user => user.tgUserId == tgUserId);
};

const getOwnerUser = async () => {
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
        [TASK_COLUMNS.USER_ID]: (newTaskData.responsibleUserIds && newTaskData.responsibleUserIds.length > 0) 
    ? newTaskData.responsibleUserIds[0] 
    : newTaskData.creatorId,
        [TASK_COLUMNS.STATUS_ID]: newTaskData.statusId,
        [TASK_COLUMNS.PRIORITY]: newTaskData.priority,
        [TASK_COLUMNS.VERSION]: 0,
        [TASK_COLUMNS.AUTHOR_USER_ID]: newTaskData.creatorId,
        [TASK_COLUMNS.STAGE_ID]: newTaskData.stageId,
        [TASK_COLUMNS.IS_DELETED]: 'FALSE'
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

const archiveTaskInSheet = async (taskId, modifierName) => {
    try {
        const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
        const rows = await tasksSheet.getRows();
        const taskRow = rows.find(row => row.get(TASK_COLUMNS.TASK_ID) == taskId);

        if (taskRow) {
            taskRow.set(TASK_COLUMNS.IS_DELETED, 'TRUE');
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
        [LOG_COLUMNS.TIMESTAMP]: new Date().toISOString(),
        [LOG_COLUMNS.USER_ID]: user.id,
        [LOG_COLUMNS.USERNAME]: user.username || '',
        [LOG_COLUMNS.NAME]: user.first_name || 'N/A'
    });
};

const getProjectIdsByUserId = async (userId) => {
    const sheet = await getSheet(SHEET_NAMES.PROJECT_MEMBERS);
    if (!sheet) return [];
    
    const rows = await sheet.getRows();
    const projectIds = new Set();
    
    rows.forEach(row => {
        if (row.get(PROJECT_MEMBERS_COLUMNS.USER_ID) == userId && row.get(PROJECT_MEMBERS_COLUMNS.IS_ACTIVE) === 'TRUE') {
            projectIds.add(row.get(PROJECT_MEMBERS_COLUMNS.PROJECT_ID));
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
        if (row.get(PROJECT_MEMBERS_COLUMNS.PROJECT_ID) == projectId && row.get(PROJECT_MEMBERS_COLUMNS.IS_ACTIVE) === 'TRUE') {
            memberIds.add(row.get(PROJECT_MEMBERS_COLUMNS.USER_ID));
        }
    });

    return Array.from(memberIds);
};

const getAllTaskMembers = async () => {
    const sheet = await getSheet(SHEET_NAMES.TASK_MEMBERS); // Используем новое имя листа
    if (!sheet) {
        console.warn(`[WARN] Sheet "${SHEET_NAMES.TASK_MEMBERS}" not found. Task member functionality will be disabled.`);
        return [];
    }
    const rows = await sheet.getRows();
    return rows.map(row => ({
        taskMemberId: row.get(TASK_MEMBERS_COLUMNS.TASK_MEMBER_ID),
        taskId: row.get(TASK_MEMBERS_COLUMNS.TASK_ID),
        userId: row.get(TASK_MEMBERS_COLUMNS.USER_ID),
        statusId: row.get(TASK_MEMBERS_COLUMNS.STATUS_ID),
        priority: row.get(TASK_MEMBERS_COLUMNS.PRIORITY)
    }));
};

const getAllStages = async () => {
    const sheet = await getSheet(SHEET_NAMES.STAGES);
    const rows = await sheet.getRows();
    return rows.map(row => ({
        stageId: row.get(STAGES_COLUMNS.STAGE_ID),
        name: row.get(STAGES_COLUMNS.NAME),
    }));
};

// 1. ИСПРАВЛЕННАЯ функция для УЧАСТНИКОВ (удалено date_added)
const updateProjectMembersInSheet = async (projectId, newMemberIds, modifierName) => {
    const sheet = await getSheet(SHEET_NAMES.PROJECT_MEMBERS);
    const rows = await sheet.getRows();
    const existingMembers = rows.filter(row => row.get(PROJECT_MEMBERS_COLUMNS.PROJECT_ID) == projectId);

    const existingMemberIds = new Set(existingMembers.map(row => row.get(PROJECT_MEMBERS_COLUMNS.USER_ID)));
    const newMemberIdsSet = new Set(newMemberIds);

    const toDeactivate = existingMembers.filter(row => !newMemberIdsSet.has(row.get(PROJECT_MEMBERS_COLUMNS.USER_ID)));
    const toAdd = newMemberIds.filter(id => !existingMemberIds.has(id));

    for (const row of toDeactivate) {
        row.set(PROJECT_MEMBERS_COLUMNS.IS_ACTIVE, 'FALSE');
        await row.save();
    }

    const newRows = toAdd.map(userId => ({
        [PROJECT_MEMBERS_COLUMNS.PROJECT_ID]: projectId,
        [PROJECT_MEMBERS_COLUMNS.USER_ID]: userId,
        [PROJECT_MEMBERS_COLUMNS.IS_ACTIVE]: 'TRUE'
        // Поле date_added удалено
    }));

    if (newRows.length > 0) {
        await sheet.addRows(newRows);
    }

    return { success: true };
};


// 2. ИСПРАВЛЕННАЯ функция для ЭТАПОВ (удалено date_added, добавлено is_active)
const updateProjectStages = async (projectId, stageIds) => {
    const sheet = await getSheet(SHEET_NAMES.PROJECT_STAGES);
    const rows = await sheet.getRows();

    // Находим и удаляем старые записи для этого проекта
    const rowsToDelete = rows.filter(row => row.get(PROJECT_STAGES_COLUMNS.PROJECT_ID) == projectId);
    for (const row of rowsToDelete) {
        await row.delete();
    }

    // Добавляем новые записи
    if (stageIds && stageIds.length > 0) {
        const newRows = stageIds.map(stageId => ({
            [PROJECT_STAGES_COLUMNS.PROJECT_ID]: projectId,
            [PROJECT_STAGES_COLUMNS.STAGE_ID]: stageId,
            [PROJECT_STAGES_COLUMNS.IS_ACTIVE]: 'TRUE' // Поле is_active добавлено
            // Поле date_added удалено
        }));
        await sheet.addRows(newRows);
    }
    
    return { success: true };
};

const getActiveStageIdsByProjectId = async (projectId) => {
    const sheet = await getSheet(SHEET_NAMES.PROJECT_STAGES);
    const rows = await sheet.getRows();
    const activeIds = new Set();
    
    rows.forEach(row => {
        if (row.get(PROJECT_STAGES_COLUMNS.PROJECT_ID) == projectId && row.get(PROJECT_STAGES_COLUMNS.IS_ACTIVE) === 'TRUE') {
            activeIds.add(row.get(PROJECT_STAGES_COLUMNS.STAGE_ID));
        }
    });

    return Array.from(activeIds);
};

const getActiveProjectStages = async () => {
    const sheet = await getSheet(SHEET_NAMES.PROJECT_STAGES);
    const rows = await sheet.getRows();
    const projectStages = {};
    
    rows.forEach(row => {
        // Проверяем, что is_active равно TRUE
        if (row.get(PROJECT_STAGES_COLUMNS.IS_ACTIVE) === 'TRUE') {
            const projectId = row.get(PROJECT_STAGES_COLUMNS.PROJECT_ID);
            const stageId = row.get(PROJECT_STAGES_COLUMNS.STAGE_ID);
            if (!projectStages[projectId]) {
                projectStages[projectId] = [];
            }
            projectStages[projectId].push(stageId);
        }
    });
    return projectStages;
};

const updateTaskMembers = async (taskId, curatorId, memberIds, modifierName) => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    const taskRows = await tasksSheet.getRows();
    const taskToUpdate = taskRows.find(row => row.get(TASK_COLUMNS.TASK_ID) == taskId);

    if (!taskToUpdate) {
        throw new Error('Задача не найдена для обновления куратора.');
    }
    taskToUpdate.set(TASK_COLUMNS.USER_ID, curatorId);
    await taskToUpdate.save();

    const membersSheet = await getSheet(SHEET_NAMES.TASK_MEMBERS);
    const memberRows = await membersSheet.getRows();

    // ИСПРАВЛЕНИЕ: Используем TASK_MEMBERS_COLUMNS
    const rowsToDelete = memberRows.filter(row => row.get(TASK_MEMBERS_COLUMNS.TASK_ID) == taskId);
    await Promise.all(rowsToDelete.map(row => row.delete()));

    if (memberIds && memberIds.length > 0) {
        const allStatuses = await getAllStatuses();
        const defaultStatus = allStatuses.find(s => s.name === "К выполнению") || { statusId: '1' };

        // ИСПРАВЛЕНИЕ: Используем TASK_MEMBERS_COLUMNS
        const newRowsData = memberIds.map(userId => ({
            [TASK_MEMBERS_COLUMNS.TASK_ID]: taskId,
            [TASK_MEMBERS_COLUMNS.USER_ID]: userId,
            [TASK_MEMBERS_COLUMNS.STATUS_ID]: defaultStatus.statusId,
            [TASK_MEMBERS_COLUMNS.PRIORITY]: 99
        }));
        await membersSheet.addRows(newRowsData);
    }

    return { success: true };
};

const getAllProjectMembers = async () => {
    const sheet = await getSheet(SHEET_NAMES.PROJECT_MEMBERS);
    if (!sheet) return [];
    const rows = await sheet.getRows();
    return rows.map(row => ({
        projectMemberId: row.get(PROJECT_MEMBERS_COLUMNS.PROJECT_MEMBER_ID),
        projectId: row.get(PROJECT_MEMBERS_COLUMNS.PROJECT_ID),
        userId: row.get(PROJECT_MEMBERS_COLUMNS.USER_ID),
        isActive: row.get(PROJECT_MEMBERS_COLUMNS.IS_ACTIVE)
    }));
};

const getAllProjectStages = async () => {
    const sheet = await getSheet(SHEET_NAMES.PROJECT_STAGES);
    if (!sheet) return [];
    const rows = await sheet.getRows();
    return rows.map(row => ({
        projectStageId: row.get(PROJECT_STAGES_COLUMNS.PROJECT_STAGE_ID),
        projectId: row.get(PROJECT_STAGES_COLUMNS.PROJECT_ID),
        stageId: row.get(PROJECT_STAGES_COLUMNS.STAGE_ID),
        isActive: row.get(PROJECT_STAGES_COLUMNS.IS_ACTIVE)
    }));
};

// 3. ЗАМЕНИТЕ ВАШ БЛОК module.exports НА ЭТОТ
module.exports = {
    loadSheetDataMiddleware,
    getSheet,
    getAllUsers,
    getAllProjects,
    getAllMembers,
    getAllStatuses,
    getTasks,
    getUserById,
    getOwnerUser,
    updateTaskInSheet,
    addTaskToSheet,
    updateTaskPrioritiesInSheet,
    archiveTaskInSheet,
    getProjectIdsByUserId,
    getMemberIdsByProjectId,
    updateProjectMembersInSheet,
    logUserAccess,
    doc,
    getAllStages,
    updateProjectStages,
    getActiveStageIdsByProjectId,
    getActiveProjectStages,
    getAllTaskMembers,
    updateTaskMembers,
    // Новые экспорты для фоновой загрузки
    getAllProjectMembers,
    getAllProjectStages
};