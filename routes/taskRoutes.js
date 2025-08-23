const express = require('express');
const router = express.Router();
const googleSheetsService = require('../dataAccess/googleSheetsService');
const { TASK_COLUMNS, USER_COLUMNS, PROJECT_COLUMNS, ERROR_MESSAGES } = require('../config/constants');

router.use(googleSheetsService.loadSheetDataMiddleware);

router.post('/appdata', async (req, res) => {
    try {
        console.log('\n--- [НАЧАЛО ЗАПРОСА /appdata] ---');
        const { user } = req.body;
        if (!user || !user.id) {
            return res.status(400).json({ error: ERROR_MESSAGES.USER_OBJECT_REQUIRED });
        }

        // --- Этап 1: Загрузка всех справочников ---
        const allUsers = await googleSheetsService.getAllUsers();
        const allProjects = await googleSheetsService.getAllProjects();
        const allTasks = await googleSheetsService.getTasks();
        const allMembers = await googleSheetsService.getAllMembers();
        const allStatuses = await googleSheetsService.getAllStatuses();

        console.log(`[СЕРВЕР] Шаг 1: Данные из таблиц загружены.`);
        console.log(`  - Пользователей найдено: ${allUsers.length}`);
        console.log(`  - Проектов найдено: ${allProjects.length}`);
        console.log(`  - Задач найдено: ${allTasks.length}`);
        console.log(`  - Участников (Members) найдено: ${allMembers.length}`);

        // --- Этап 2: Верификация пользователя ---
        const currentUser = allUsers.find(u => u.tgUserId == user.id);
        if (!currentUser) {
            console.log(`[СЕРВЕР] Шаг 2: Пользователь с TG ID ${user.id} НЕ НАЙДЕН. Отправка статуса 'unregistered'.`);
            return res.status(200).json({ status: 'unregistered' });
        }
        const { name: userName, role: userRole, userId: currentInternalUserId } = currentUser;
        console.log(`[СЕРВЕР] Шаг 2: Пользователь найден. Имя: "${userName}", Роль: "${userRole}", Внутренний ID: "${currentInternalUserId}"`);

        let tasksToProcess = [];

        // --- Этап 3: Фильтрация задач по роли ---
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
        console.log(`[СЕРВЕР] Шаг 3: После фильтрации по роли осталось задач: ${tasksToProcess.length}`);

        const validTasks = tasksToProcess.filter(row => row.get(TASK_COLUMNS.NAME));
        
        // --- Этап 4: "Обогащение" данных ---
        const enrichedTasks = validTasks.map(task => {
            const project = allProjects.find(p => p.projectId == task.get(TASK_COLUMNS.PROJECT_ID));
            const status = allStatuses.find(s => s.statusId == task.get(TASK_COLUMNS.STATUS_ID));
            
            const taskId = task.get(TASK_COLUMNS.TASK_ID);
            const memberUserIds = allMembers.filter(m => m.taskId === taskId).map(m => m.userId);
            const responsibleIds = new Set([task.get(TASK_COLUMNS.USER_ID), ...memberUserIds]);
            const responsibleNames = [...responsibleIds].map(id => allUsers.find(u => u.userId === id)?.name).filter(Boolean);

            return {
                name: task.get(TASK_COLUMNS.NAME),
                status: status ? status.name : 'Неизвестный статус',
                responsible: responsibleNames.join(', '),
                project: project ? project.projectName : 'Без проекта',
                priority: parseInt(task.get(TASK_COLUMNS.PRIORITY), 10) || 999,
                rowIndex: task.rowNumber,
            };
        });
        console.log(`[СЕРВЕР] Шаг 4: "Обогащено" задач: ${enrichedTasks.length}. Пример первой задачи:`, enrichedTasks[0]);

        // --- Этап 5: Группировка ---
        const groups = {};
        enrichedTasks.forEach(task => {
            const groupName = task.project;
            if (!groups[groupName]) {
                groups[groupName] = { name: groupName, tasks: [] };
            }
            groups[groupName].tasks.push(task);
        });
        console.log(`[СЕРВЕР] Шаг 5: Задачи сгруппированы в ${Object.keys(groups).length} групп(ы).`);

        // --- Этап 6: Отправка ответа ---
        const responsePayload = { 
            projects: Object.values(groups),
            allProjects: allProjects.map(p => p.projectName), 
            userName, 
            userRole,
            allEmployees: allUsers
        };
        console.log(`[СЕРВЕР] Шаг 6: Отправка ответа клиенту. Количество групп (проектов): ${responsePayload.projects.length}`);
        console.log('--- [КОНЕЦ ЗАПРОСА /appdata] ---\n');
        
        res.status(200).json(responsePayload);

    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА в /api/appdata:', error);
        res.status(500).json({ error: error.message });
    }
});

// "Заглушки" для функций, которые мы реализуем на следующих этапах
router.post('/updatetask', async (req, res) => res.status(501).json({ error: 'Not implemented yet' }));
router.post('/updatepriorities', async (req, res) => res.status(501).json({ error: 'Not implemented yet' }));
router.post('/addtask', async (req, res) => res.status(501).json({ error: 'Not implemented yet' }));

module.exports = router;