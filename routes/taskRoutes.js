const express = require('express');
const router = express.Router();
const googleSheetsService = require('../dataAccess/googleSheetsService');
const { TASK_COLUMNS, USER_COLUMNS, PROJECT_COLUMNS, ERROR_MESSAGES } = require('../config/constants');

router.use(googleSheetsService.loadSheetDataMiddleware);

router.post('/appdata', async (req, res) => {
    try {
        const { user } = req.body;
        if (!user || !user.id) {
            return res.status(400).json({ error: ERROR_MESSAGES.USER_OBJECT_REQUIRED });
        }

        // 1. Загружаем все справочники один раз
        const allUsers = await googleSheetsService.getAllUsers();
        const allProjects = await googleSheetsService.getAllProjects();
        const allTasks = await googleSheetsService.getTasks();
        const allMembers = await googleSheetsService.getAllMembers();

        const currentUser = allUsers.find(u => u.tgUserId == user.id);
        if (!currentUser) {
            // Если пользователь не найден по TGUserID, возвращаем статус для регистрации
            // Важно вернуть 200 OK, чтобы клиент обработал статус, а не упал с ошибкой
            return res.status(200).json({ status: 'unregistered' });
        }

        const { name: userName, role: userRole, userId: currentInternalUserId } = currentUser;
        
        let tasksToProcess = [];

        // 2. Определяем, какие задачи нужно показать пользователю
        if (userRole === 'admin' || userRole === 'owner') {
            tasksToProcess = allTasks;
        } else {
            // Для остальных ролей находим все задачи, где они являются либо основным, либо дополнительным участником
            tasksToProcess = allTasks.filter(task => {
                const mainAssigneeId = task.get(TASK_COLUMNS.USER_ID);
                if (mainAssigneeId == currentInternalUserId) return true;

                const taskId = task.get(TASK_COLUMNS.TASK_ID);
                const additionalMembers = allMembers.filter(m => m.taskId === taskId);
                return additionalMembers.some(m => m.userId === currentInternalUserId);
            });
        }

        const validTasks = tasksToProcess.filter(row => row.get(TASK_COLUMNS.NAME));
        
        // 3. "Обогащаем" задачи реальными именами
        const enrichedTasks = validTasks.map(task => {
            const mainAssignee = allUsers.find(u => u.userId == task.get(TASK_COLUMNS.USER_ID));
            const project = allProjects.find(p => p.projectId == task.get(TASK_COLUMNS.PROJECT_ID));
            
            // Собираем всех ответственных
            const taskId = task.get(TASK_COLUMNS.TASK_ID);
            const memberIds = allMembers.filter(m => m.taskId === taskId).map(m => m.userId);
            const responsibleIds = new Set([task.get(TASK_COLUMNS.USER_ID), ...memberIds]);
            const responsibleNames = [...responsibleIds].map(id => allUsers.find(u => u.userId === id)?.name).filter(Boolean);

            return {
                name: task.get(TASK_COLUMNS.NAME),
                status: task.get(TASK_COLUMNS.STATUS_ID), // Используем StatusID, позже заменим на имя
                responsible: responsibleNames.join(', '),
                message: "Сообщение будет здесь", // Placeholder
                version: parseInt(task.get(TASK_COLUMNS.VERSION) || 0, 10),
                rowIndex: parseInt(task.get(TASK_COLUMNS.ROW_INDEX), 10),
                project: project ? project.projectName : 'Без проекта',
                priority: parseInt(task.get(TASK_COLUMNS.PRIORITY), 10) || 999,
                groupId: task.get(TASK_COLUMNS.GROUP_ID)
            };
        });

        // 4. Группируем "обогащенные" задачи по проектам
        const groups = {};
        enrichedTasks.forEach(task => {
            const groupName = task.project;
            if (!groups[groupName]) {
                groups[groupName] = { name: groupName, tasks: [] };
            }
            groups[groupName].tasks.push(task);
        });
        
        res.status(200).json({ 
            projects: Object.values(groups), // Для клиента это все еще "проекты"
            allProjects: allProjects.map(p => p.projectName), 
            userName, 
            userRole, 
            allEmployees: allUsers
        });

    } catch (error) {
        console.error('Error in /api/appdata:', error);
        res.status(500).json({ error: error.message });
    }
});

// "Заглушки" для функций, которые мы реализуем на следующих этапах
router.post('/updatetask', async (req, res) => res.status(501).json({ error: 'Not implemented yet' }));
router.post('/updatepriorities', async (req, res) => res.status(501).json({ error: 'Not implemented yet' }));
router.post('/addtask', async (req, res) => res.status(501).json({ error: 'Not implemented yet' }));

module.exports = router;