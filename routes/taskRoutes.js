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
        const allEmployees = await googleSheetsService.getAllEmployees();
        const allProjects = await googleSheetsService.getAllProjects();
        const allStatuses = await googleSheetsService.getAllStatuses();
        const allTasks = await googleSheetsService.getTasks();
        const allMembers = await googleSheetsService.getAllMembers();

        // Оптимизация: Преобразуем массивы в Map для быстрого доступа (O(1) вместо O(N))
        const employeesMap = new Map(allEmployees.map(e => [e.userId, e]));
        const projectsMap = new Map(allProjects.map(p => [p.projectId, p]));
        const statusesMap = new Map(allStatuses.map(s => [s.statusId, s]));

        // Группируем участников по задачам для эффективного поиска
        const membersByTaskMap = new Map();
        allMembers.forEach(member => {
            if (!membersByTaskMap.has(member.taskId)) {
                membersByTaskMap.set(member.taskId, []);
            }
            membersByTaskMap.get(member.taskId).push(member.userId);
        });
        const currentUser = allEmployees.find(u => u.tgUserId == user.id);
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
                if (task.get(TASK_COLUMNS.USER_ID) == currentInternalUserId) return true;

                const taskId = task.get(TASK_COLUMNS.TASK_ID);
                const additionalMemberIds = membersByTaskMap.get(taskId) || [];
                return additionalMemberIds.includes(currentInternalUserId);
            });
        }

        const validTasks = tasksToProcess.filter(row => row.get(TASK_COLUMNS.NAME));
        
        // 3. "Обогащаем" задачи реальными именами
        const enrichedTasks = validTasks.map(task => {
            const mainAssigneeId = task.get(TASK_COLUMNS.USER_ID);
            const projectId = task.get(TASK_COLUMNS.PROJECT_ID);
            const statusId = task.get(TASK_COLUMNS.STATUS_ID);
            const taskId = task.get(TASK_COLUMNS.TASK_ID);

            const project = projectsMap.get(projectId);
            const status = statusesMap.get(statusId);
            
            // Собираем всех ответственных
            const additionalMemberIds = membersByTaskMap.get(taskId) || [];
            const responsibleIds = new Set([mainAssigneeId, ...additionalMemberIds]);
            const responsibleNames = [...responsibleIds].map(id => employeesMap.get(id)?.name).filter(Boolean);

            return {
                name: task.get(TASK_COLUMNS.NAME),
                status: status ? status.statusName : 'Неизвестный статус',
                responsible: responsibleNames.join(', '),
                message: "Сообщение будет здесь", // TODO: Placeholder
                version: parseInt(task.get(TASK_COLUMNS.VERSION) || 0, 10),
                rowIndex: parseInt(task.get(TASK_COLUMNS.ROW_INDEX), 10),
                project: project?.projectName || 'Без проекта',
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
            allProjects: Object.keys(groups), // ИСПРАВЛЕНО: Отправляем только те проекты, в которых у пользователя есть задачи
            userName, 
            userRole,
            // Отправляем только нужные для клиента данные, уменьшая размер ответа
            allEmployees: allEmployees.map(e => ({ userId: e.userId, name: e.name }))
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