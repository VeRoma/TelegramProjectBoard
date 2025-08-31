const express = require('express');
const router = express.Router();
const googleSheetsService = require('../dataAccess/googleSheetsService');
const { TASK_COLUMNS, ERROR_MESSAGES } = require('../config/constants');

router.use(googleSheetsService.loadSheetDataMiddleware);

router.post('/appdata', async (req, res) => {
    try {
        const { user } = req.body;
        if (!user || !user.id) {
            return res.status(400).json({ error: ERROR_MESSAGES.USER_OBJECT_REQUIRED });
        }

        // Загружаем все справочники один раз
        const allUsers = await googleSheetsService.getAllUsers();
        const allStatuses = await googleSheetsService.getAllStatuses();
        let allProjects = await googleSheetsService.getAllProjects();
        let allTasks = await googleSheetsService.getTasks();
        // Загружаем активные фильтры по этапам
        const activeProjectStages = await googleSheetsService.getActiveProjectStages();
        
        const currentUser = allUsers.find(u => u.tgUserId == user.id);
        if (!currentUser) {
            return res.status(200).json({ status: 'unregistered' });
        }

        const { name: userName, role: userRole, userId: currentInternalUserId } = currentUser;
        
        // --- Старый жесткий фильтр УДАЛЕН ---

        if (userRole !== 'admin' && userRole !== 'owner') {
            const userProjectIds = await googleSheetsService.getProjectIdsByUserId(currentInternalUserId);
            allProjects = allProjects.filter(p => userProjectIds.includes(p.projectId));
            const userProjectIdsSet = new Set(userProjectIds);
            allTasks = allTasks.filter(task => userProjectIdsSet.has(task.get(TASK_COLUMNS.PROJECT_ID)));
        }
        
        const allMembers = await googleSheetsService.getAllMembers();
        let tasksToProcess = [];

        if (userRole === 'admin' || userRole === 'owner') {
            tasksToProcess = allTasks;
        } else {
             tasksToProcess = allTasks.filter(task => {
                const mainAssigneeId = task.get(TASK_COLUMNS.USER_ID);
                if (mainAssigneeId == currentInternalUserId) return true;
                const taskId = task.get(TASK_COLUMNS.TASK_ID);
                const taskMembers = allMembers.filter(m => m.taskId === taskId).map(m => m.userId);
                return taskMembers.includes(currentInternalUserId);
            });
        }

        const validTasks = tasksToProcess.filter(row => row.get(TASK_COLUMNS.NAME));
        
        const enrichedTasks = validTasks.map(task => {
            const projectId = task.get(TASK_COLUMNS.PROJECT_ID) || '1';
            const statusId = task.get(TASK_COLUMNS.STATUS_ID) || '1';
            const priority = parseInt(task.get(TASK_COLUMNS.PRIORITY), 10) || 1;
            const project = allProjects.find(p => p.projectId == projectId);
            const status = allStatuses.find(s => s.statusId == statusId);
            const taskId = task.get(TASK_COLUMNS.TASK_ID);
            const memberUserIds = allMembers.filter(m => m.taskId === taskId).map(m => m.userId);
            const mainAssigneeId = task.get(TASK_COLUMNS.USER_ID);
            const responsibleIds = new Set([mainAssigneeId, ...memberUserIds].filter(Boolean));
            const responsibleNames = [...responsibleIds].map(id => allUsers.find(u => u.userId === id)?.name).filter(Boolean);

            return {
                taskId: taskId,
                name: task.get(TASK_COLUMNS.NAME),
                status: status ? status.name : 'Неизвестный статус',
                statusId: statusId,
                responsible: responsibleNames.join(', '),
                project: project ? project.projectName : 'Без проекта',
                projectId: projectId,
                priority: priority,
                version: parseInt(task.get(TASK_COLUMNS.VERSION) || 0, 10),
                stageId: task.get(TASK_COLUMNS.STAGE_ID) // <-- ВАЖНОЕ ИЗМЕНЕНИЕ
            };
        });

        console.log(`[SERVER LOG] Sending initial app data to user: ${userName}. Project count: ${allProjects.length}. Task count: ${enrichedTasks.length}`);

        const groups = {};
        enrichedTasks.forEach(task => {
            const project = allProjects.find(p => p.projectId === task.projectId);
            if (!project) return;
            const groupName = project.projectName;
            if (!groups[groupName]) {
                groups[groupName] = { name: groupName, tasks: [] };
            }
            groups[groupName].tasks.push(task);
        });
        
        res.status(200).json({ 
            projects: Object.values(groups),
            allProjects: allProjects, 
            userName, 
            userRole,
            allEmployees: allUsers,
            allStatuses: allStatuses,
            activeProjectStages: activeProjectStages // Передаем фильтры клиенту
        });

    } catch (error) {
        console.error('[SERVER ERROR] in /api/appdata:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/updatepriorities', async (req, res) => {
    try {
        const { tasks, modifierName } = req.body;
        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
            return res.status(400).json({ error: 'Invalid tasks data provided.' });
        }
        await googleSheetsService.updateTaskPrioritiesInSheet(tasks);
        res.status(200).json({ status: 'success', message: 'Priorities updated successfully.' });
    } catch (error) {
        console.error('[SERVER ERROR] in /api/updatepriorities:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/addtask', async (req, res) => {
    try {
        const { newTaskData, creatorName } = req.body;
        if (!newTaskData) {
            return res.status(400).json({ error: 'New task data is required.' });
        }
        const addedRows = await googleSheetsService.addTaskToSheet(newTaskData, creatorName);
        const createdTaskData = addedRows[0].toObject();
        const createdTask = {
            taskId: createdTaskData[TASK_COLUMNS.TASK_ID],
            name: createdTaskData[TASK_COLUMNS.NAME],
        };
        res.status(201).json({ status: 'success', tasks: [createdTask] });
    } catch (error) {
        console.error('[SERVER ERROR] in /api/addtask:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/deletetask', async (req, res) => {
    try {
        const { taskId, modifierName } = req.body;
        if (!taskId) {
            return res.status(400).json({ error: 'Task ID is required.' });
        }
        await googleSheetsService.archiveTaskInSheet(taskId, modifierName);
        res.status(200).json({ status: 'success', message: 'Task archived successfully.' });
    } catch (error) {
        console.error('[SERVER ERROR] in /api/deletetask:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/project/:projectId/members', async (req, res) => {
    try {
        const { projectId } = req.params;
        const memberIds = await googleSheetsService.getMemberIdsByProjectId(projectId);
        res.status(200).json(memberIds);
    } catch (error) {
        console.error(`[SERVER ERROR] GET /api/project/members:`, error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/project/:projectId/members', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { memberIds, modifierName } = req.body;
        if (!Array.isArray(memberIds)) {
            return res.status(400).json({ error: 'memberIds should be an array.' });
        }
        await googleSheetsService.updateProjectMembersInSheet(projectId, memberIds, modifierName);
        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error(`[SERVER ERROR] POST /api/project/members:`, error);
        res.status(500).json({ error: error.message });
    }
});

// --- МАРШРУТЫ ДЛЯ ЭТАПОВ ---
router.get('/stages', async (req, res) => {
    try {
        const allStages = await googleSheetsService.getAllStages();
        res.status(200).json(allStages);
    } catch (error) {
        console.error(`[SERVER ERROR] GET /api/stages:`, error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/project/:projectId/stages', async (req, res) => {
    try {
        const { projectId } = req.params;
        const activeStageIds = await googleSheetsService.getActiveStageIdsByProjectId(projectId);
        res.status(200).json(activeStageIds);
    } catch (error) {
        console.error(`[SERVER ERROR] GET /api/project/stages:`, error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/project/:projectId/stages', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { stageIds } = req.body;
        if (!Array.isArray(stageIds)) {
            return res.status(400).json({ error: 'stageIds should be an array.' });
        }
        await googleSheetsService.updateProjectStages(projectId, stageIds);
        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error(`[SERVER ERROR] POST /api/project/stages:`, error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;