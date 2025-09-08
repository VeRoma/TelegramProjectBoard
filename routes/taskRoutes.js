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

        // --- ИЗМЕНЕНИЕ №1: Загружаем данные об исполнителях задач ---
        const [
            allUsers, 
            allStatuses, 
            allStages, 
            allProjects, 
            allTasks, 
            activeProjectStages, 
            allTaskMembers // <-- ДОБАВЛЕНО
        ] = await Promise.all([
            googleSheetsService.getAllUsers(),
            googleSheetsService.getAllStatuses(),
            googleSheetsService.getAllStages(),
            googleSheetsService.getAllProjects(),
            googleSheetsService.getTasks(),
            googleSheetsService.getActiveProjectStages(),
            googleSheetsService.getAllTaskMembers() // <-- ДОБАВЛЕНО
        ]);
        
        const currentUser = allUsers.find(u => u.tgUserId == user.id);
        if (!currentUser) {
            return res.status(200).json({ status: 'unregistered' });
        }

        const { name: userName, role: userRole, userId: currentInternalUserId } = currentUser;
        
        // --- ИЗМЕНЕНИЕ №2: Группируем исполнителей по ID задачи для быстрого доступа ---
        const taskMembersByTaskId = allTaskMembers.reduce((acc, member) => {
            if (!acc[member.taskId]) {
                acc[member.taskId] = [];
            }
            acc[member.taskId].push(member);
            return acc;
        }, {});


        let filteredProjects = allProjects;
        let filteredTasks = allTasks;

        if (userRole !== 'admin' && userRole !== 'owner') {
            const userProjectIds = await googleSheetsService.getProjectIdsByUserId(currentInternalUserId);
            filteredProjects = allProjects.filter(p => userProjectIds.includes(p.projectId));
            const userProjectIdsSet = new Set(userProjectIds);
            filteredTasks = allTasks.filter(task => userProjectIdsSet.has(task.get(TASK_COLUMNS.PROJECT_ID)));
        }
        
        let tasksToProcess = [];
        if (userRole === 'admin' || userRole === 'owner') {
            tasksToProcess = filteredTasks;
        } else {
            // Эта логика может потребовать пересмотра, когда мы будем определять видимость по TaskMembers
            tasksToProcess = filteredTasks.filter(task => {
                const mainAssigneeId = task.get(TASK_COLUMNS.USER_ID);
                if (mainAssigneeId == currentInternalUserId) return true;
                const taskId = task.get(TASK_COLUMNS.TASK_ID);
                return (taskMembersByTaskId[taskId] || []).some(m => m.userId == currentInternalUserId);
            });
        }

        const validTasks = tasksToProcess.filter(row => row.get(TASK_COLUMNS.NAME));
        
        const enrichedTasks = validTasks.map(task => {
            const taskId = task.get(TASK_COLUMNS.TASK_ID);
            const projectId = task.get(TASK_COLUMNS.PROJECT_ID) || '1';
            const statusId = task.get(TASK_COLUMNS.STATUS_ID) || '1';

            const project = allProjects.find(p => p.projectId == projectId);
            const status = allStatuses.find(s => s.statusId == statusId);
            const mainAssigneeId = task.get(TASK_COLUMNS.USER_ID);
            const curator = allUsers.find(u => u.userId === mainAssigneeId);

            return {
                taskId: taskId,
                name: task.get(TASK_COLUMNS.NAME),
                status: status ? status.name : 'Неизвестный статус',
                statusId: statusId,
                curator: curator ? curator.name : 'Не назначен',
                userId: mainAssigneeId, 
                project: project ? project.projectName : 'Без проекта',
                projectId: projectId,
                priority: parseInt(task.get(TASK_COLUMNS.PRIORITY), 10) || 1,
                version: parseInt(task.get(TASK_COLUMNS.VERSION) || 0, 10),
                stageId: task.get(TASK_COLUMNS.STAGE_ID),
                members: taskMembersByTaskId[taskId] || [] // <-- ИСПОЛНИТЕЛИ ЗАДАЧИ
            };
        });

        console.log(`[SERVER LOG] Sending initial app data to user: ${userName}. Project count: ${filteredProjects.length}. Task count: ${enrichedTasks.length}`);

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
            currentUserId: currentInternalUserId,
            allUsers: allUsers,
            allStatuses: allStatuses,
            allStages: allStages,
            activeProjectStages: activeProjectStages


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

// --- НАЧАЛО НОВОГО БЛОКА ---
router.post('/task/:taskId/members', async (req, res) => {
    try {
        const { taskId } = req.params;
        // Получаем ID куратора и полный список ID всех участников
        const { curatorId, memberIds, modifierName } = req.body;

        if (!taskId || !curatorId || !Array.isArray(memberIds)) {
            return res.status(400).json({ error: 'Некорректные данные для обновления участников.' });
        }

        // Вызываем новую функцию для обновления данных в Google Sheets
        await googleSheetsService.updateTaskMembers(taskId, curatorId, memberIds, modifierName);
        
        res.status(200).json({ status: 'success', message: 'Состав исполнителей успешно обновлен.' });
    } catch (error) {
        console.error(`[SERVER ERROR] POST /api/task/${req.params.taskId}/members:`, error);
        res.status(500).json({ error: error.message });
    }
});
// --- КОНЕЦ НОВОГО БЛОКА ---



// --- НАЧАЛО НОВОГО БЛОКА ---
router.get('/details/all-connections', async (req, res) => {
    try {
        const [
            allProjectMembers,
            allTaskMembers,
            allProjectStages
        ] = await Promise.all([
            googleSheetsService.getAllProjectMembers(),
            googleSheetsService.getAllTaskMembers(),
            googleSheetsService.getAllProjectStages()
        ]);

        res.status(200).json({
            projectMembers: allProjectMembers,
            taskMembers: allTaskMembers,
            projectStages: allProjectStages
        });

    } catch (error) {
        console.error('[SERVER ERROR] in /api/details/all-connections:', error);
        res.status(500).json({ error: error.message });
    }
});
// --- КОНЕЦ НОВОГО БЛОКА ---

module.exports = router;