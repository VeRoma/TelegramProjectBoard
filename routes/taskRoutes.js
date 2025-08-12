const express = require('express');
const router = express.Router();
const googleSheetsService = require('../dataAccess/googleSheetsService');
const telegramService = require('../dataAccess/telegramService');
const { SHEET_NAMES, TASK_COLUMNS, EMPLOYEE_ROLES, ERROR_MESSAGES } = require('../config/constants');

router.use(googleSheetsService.loadSheetDataMiddleware);

// routes/taskRoutes.js

router.post('/appdata', async (req, res) => {
    try {
        const { user } = req.body;
        if (!user || !user.id) {
            return res.status(400).json({ error: ERROR_MESSAGES.USER_OBJECT_REQUIRED });
        }
        const currentUserRecord = await googleSheetsService.getEmployeeById(user.id);
        if (!currentUserRecord) {
            return res.status(401).json({ error: ERROR_MESSAGES.UNAUTHORIZED_USER_NOT_FOUND });
        }

        const userName = currentUserRecord.get(TASK_COLUMNS.EMPLOYEE_NAME);
        const userRole = currentUserRecord.get(TASK_COLUMNS.EMPLOYEE_ROLE);
        
        const allTasks = await googleSheetsService.getTasks();
        const allEmployees = await googleSheetsService.getAllEmployees();
        const userEmployeeNames = allEmployees.filter(e => e.role === 'user').map(e => e.name);

        let tasksToProcess = [];

        // --- НОВАЯ ЛОГИКА ДЛЯ РОЛЕЙ ---
        if (userRole === EMPLOYEE_ROLES.USER) {
            // User видит только свои задачи
            tasksToProcess = allTasks.filter(row => (row.get(TASK_COLUMNS.RESPONSIBLE) || '').split(',').map(n => n.trim()).includes(userName));
        
        } else if (userRole === EMPLOYEE_ROLES.GAP) {
            // GAP видит свои задачи + задачи всех user'ов
            tasksToProcess = allTasks.filter(row => {
                const responsibles = (row.get(TASK_COLUMNS.RESPONSIBLE) || '').split(',').map(n => n.trim());
                // Возвращаем true, если ответственный - сам GAP или кто-то из user'ов
                return responsibles.some(r => r === userName || userEmployeeNames.includes(r));
            });
        } else { // admin / owner
            // Admin/Owner видят все задачи
            tasksToProcess = allTasks;
        }

        const validTasksRows = tasksToProcess.filter(row => row.get(TASK_COLUMNS.NAME));
        const projects = {};

        // --- НОВАЯ ЛОГИКА ГРУППИРОВКИ ---
        if (userRole === EMPLOYEE_ROLES.GAP) {
            // Для GAP группируем по Ответственным
            validTasksRows.forEach(row => {
                const responsibles = (row.get(TASK_COLUMNS.RESPONSIBLE) || 'Не назначен').split(',').map(n => n.trim());
                responsibles.forEach(responsibleName => {
                    if (!projects[responsibleName]) {
                        projects[responsibleName] = { name: responsibleName, tasks: [] };
                    }
                    projects[responsibleName].tasks.push(createTaskObject(row));
                });
            });
        } else {
            // Для остальных группируем по Проектам
            validTasksRows.forEach(row => {
                const projectName = row.get(TASK_COLUMNS.PROJECT) || 'Без проекта';
                if (!projects[projectName]) {
                    projects[projectName] = { name: projectName, tasks: [] };
                }
                projects[projectName].tasks.push(createTaskObject(row));
            });
        }
        
        const allProjectsList = [...new Set(allTasks.map(r => r.get(TASK_COLUMNS.PROJECT)).filter(Boolean))];
        
        res.status(200).json({ 
            projects: Object.values(projects), 
            allProjects: allProjectsList, 
            userName, 
            userRole, 
            allEmployees 
        });

    } catch (error) {
        console.error('Error in /api/appdata:', error);
        res.status(500).json({ error: error.message });
    }
});

// Вспомогательная функция, чтобы не дублировать код
function createTaskObject(row) {
    return {
        name: row.get(TASK_COLUMNS.NAME),
        status: row.get(TASK_COLUMNS.STATUS),
        responsible: row.get(TASK_COLUMNS.RESPONSIBLE),
        message: row.get(TASK_COLUMNS.MESSAGE),
        version: parseInt(row.get(TASK_COLUMNS.VERSION) || 0, 10),
        rowIndex: parseInt(row.get(TASK_COLUMNS.ROW_INDEX) || row.rowNumber, 10),
        project: row.get(TASK_COLUMNS.PROJECT),
        priority: parseInt(row.get(TASK_COLUMNS.PRIORITY), 10) || 999,
        modifiedBy: row.get(TASK_COLUMNS.MODIFIED_BY),
        modifiedAt: row.get(TASK_COLUMNS.MODIFIED_AT),
        groupId: row.get(TASK_COLUMNS.GROUP_ID)
    };
}

router.post('/updatetask', async (req, res) => {
    try {
        const { taskData, modifierName } = req.body;
        if (!taskData || !modifierName) {
            return res.status(400).json({ error: 'Неполные данные для обновления задачи' });
        }
        const newVersion = await googleSheetsService.updateTaskInSheet(taskData, modifierName);
        res.status(200).json({ status: 'success', newVersion });
    } catch (error) {
        console.error('Error in /api/updatetask:', error);
        if (error.message.includes('изменены другим пользователем')) {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

router.post('/updatepriorities', async (req, res) => {
    try {
        const { tasks: updatedTasks, modifierName } = req.body;
        if (!updatedTasks || !Array.isArray(updatedTasks) || !modifierName) {
            return res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA_FORMAT });
        }
        await googleSheetsService.updateTaskPrioritiesInSheet(updatedTasks, modifierName);
        res.status(200).json({ status: 'success' });
    }
    catch (error) {
        console.error('Error in /api/updatepriorities:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/addtask', async (req, res) => {
    try {
        const { newTaskData, creatorName } = req.body;
        if (!newTaskData || !creatorName) {
            return res.status(400).json({ error: 'Неполные данные для создания задачи' });
        }
        const newRow = await googleSheetsService.addTaskToSheet(newTaskData, creatorName);
        if (newTaskData.responsibleUserIds && newTaskData.creatorId) {
            newTaskData.responsibleUserIds.forEach(userId => {
                if (userId !== newTaskData.creatorId) {
                    telegramService.sendNewTaskNotification(userId, newTaskData.name, newTaskData.priority === 1);
                }
            });
        }
        const responseTask = {
            name: newRow.get(TASK_COLUMNS.NAME),
            project: newRow.get(TASK_COLUMNS.PROJECT),
            status: newRow.get(TASK_COLUMNS.STATUS),
            responsible: newRow.get(TASK_COLUMNS.RESPONSIBLE),
            message: newRow.get(TASK_COLUMNS.MESSAGE),
            priority: parseInt(newRow.get(TASK_COLUMNS.PRIORITY), 10) || 999,
            version: parseInt(newRow.get(TASK_COLUMNS.VERSION), 10) || 0,
            rowIndex: parseInt(newRow.get(TASK_COLUMNS.ROW_INDEX), 10) || newRow.rowNumber,
            modifiedBy: newRow.get(TASK_COLUMNS.MODIFIED_BY),
            modifiedAt: newRow.get(TASK_COLUMNS.MODIFIED_AT)
        };
        res.status(200).json({ status: 'success', task: responseTask });
    } catch (error) {
        console.error('Error in /api/addtask:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;