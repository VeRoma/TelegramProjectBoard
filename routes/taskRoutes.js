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

        const allUsers = await googleSheetsService.getAllUsers();
        const allProjects = await googleSheetsService.getAllProjects();
        const allTasks = await googleSheetsService.getTasks();
        const allMembers = await googleSheetsService.getAllMembers();
        const allStatuses = await googleSheetsService.getAllStatuses();

        const currentUser = allUsers.find(u => u.tgUserId == user.id);
        if (!currentUser) {
            return res.status(200).json({ status: 'unregistered' });
        }

        const { name: userName, role: userRole, userId: currentInternalUserId } = currentUser;
        
        let tasksToProcess = [];

        if (userRole === 'admin' || userRole === 'owner') {
            tasksToProcess = allTasks;
        } else {
            tasksToProcess = allTasks.filter(task => {
                const mainAssigneeId = task.get(TASK_COLUMNS.USER_ID);
                if (mainAssigneeId == currentInternalUserId) return true;

                const taskId = task.get(TASK_COLUMNS.TASK_ID);
                return allMembers.some(m => m.taskId === taskId && m.userId === currentInternalUserId);
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
                priority: priority,
                version: parseInt(task.get(TASK_COLUMNS.VERSION) || 0, 10)
            };
        });

        const groups = {};
        enrichedTasks.forEach(task => {
            const groupName = task.project;
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
            allStatuses: allStatuses
        });

    } catch (error) {
        console.error('Error in /api/appdata:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/updatepriorities', async (req, res) => {
    try {
        const { tasks } = req.body;

        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
            return res.status(400).json({ error: 'Invalid tasks data provided.' });
        }
        
        // Клиент уже присылает готовые данные (taskId, statusId, priority),
        // поэтому просто передаем их дальше.
        await googleSheetsService.updateTaskPrioritiesInSheet(tasks);

        res.status(200).json({ status: 'success', message: 'Priorities updated successfully.' });

    } catch (error) {
        console.error('Error in /api/updatepriorities:', error);
        res.status(500).json({ error: error.message });
    }
});

// Заглушки для будущего функционала
router.post('/updatetask', async (req, res) => res.status(501).json({ error: 'Not implemented yet' }));
router.post('/addtask', async (req, res) => res.status(501).json({ error: 'Not implemented yet' }));

module.exports = router;
