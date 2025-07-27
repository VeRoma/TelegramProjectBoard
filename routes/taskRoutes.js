// routes/taskRoutes.js
const express = require('express');
const router = express.Router(); // Создаем новый роутер Express
// Импортируем сервисы для работы с Google Таблицами и Telegram
const googleSheetsService = require('../dataAccess/googleSheetsService');
const telegramService = require('../dataAccess/telegramService');
// Импортируем константы для названий листов, колонок, ролей и сообщений об ошибках
const { SHEET_NAMES, TASK_COLUMNS, EMPLOYEE_ROLES, ERROR_MESSAGES } = require('../config/constants');

// Применяем middleware для загрузки данных о листах Google Таблицы ко всем маршрутам в этом роутере
router.use(googleSheetsService.loadSheetDataMiddleware);

// Маршрут для получения всех данных приложения (проекты, задачи, сотрудники)
router.post('/appdata', async (req, res) => {
    try {
        const { user } = req.body; // Получаем объект пользователя из тела запроса

        // Проверяем наличие объекта пользователя и его ID
        if (!user || !user.id) {
            return res.status(400).json({ error: ERROR_MESSAGES.USER_OBJECT_REQUIRED });
        }

        // Получаем запись о текущем пользователе из листа сотрудников
        const currentUserRecord = await googleSheetsService.getEmployeeById(user.id);

        // Если пользователь не найден в листе сотрудников, отказываем в доступе
        if (!currentUserRecord) {
            return res.status(401).json({ error: ERROR_MESSAGES.UNAUTHORIZED_USER_NOT_FOUND });
        }

        const userName = currentUserRecord.get(TASK_COLUMNS.EMPLOYEE_NAME);
        const userRole = currentUserRecord.get(TASK_COLUMNS.EMPLOYEE_ROLE);

        let projects = {}; // Объект для хранения сгруппированных по проектам задач
        const allTasksRows = await googleSheetsService.getTasks(); // Получаем все задачи
        // Фильтруем задачи, оставляя только те, у которых есть наименование
        const validTasksRows = allTasksRows.filter(row => row.get(TASK_COLUMNS.NAME));

        // Собираем список всех уникальных проектов
        const allProjects = [...new Set(validTasksRows.map(r => r.get(TASK_COLUMNS.PROJECT)).filter(Boolean))];

        // Получаем список всех сотрудников для клиента
        const allEmployees = await googleSheetsService.getAllEmployees();

        // Логика формирования данных о проектах в зависимости от роли пользователя
        if (userRole === EMPLOYEE_ROLES.USER) {
            // Если роль "user", ищем персональный лист пользователя
            const userSheet = await googleSheetsService.getSheet(userName);
            if (userSheet) {
                // Получаем задачи из персонального листа пользователя
                const userTasksRows = (await userSheet.getRows()).filter(row => row.get(TASK_COLUMNS.NAME));
                projects[userName] = {
                    name: userName,
                    tasks: userTasksRows.map(row => ({
                        name: row.get(TASK_COLUMNS.NAME),
                        status: row.get(TASK_COLUMNS.STATUS),
                        responsible: row.get(TASK_COLUMNS.RESPONSIBLE),
                        message: row.get(TASK_COLUMNS.MESSAGE),
                        rowIndex: row.get(TASK_COLUMNS.ROW_INDEX),
                        version: row.get(TASK_COLUMNS.VERSION) || 0,
                        project: row.get(TASK_COLUMNS.PROJECT),
                        приоритет: row.get(TASK_COLUMNS.PRIORITY) || 99
                    }))
                };
            } else {
                console.warn(`Sheet "${userName}" for user ${user.id} not found.`);
            }
        } else {
            // Если роль не "user" (например, admin, owner), группируем все задачи по проектам
            validTasksRows.forEach((row) => {
                const projectName = row.get(TASK_COLUMNS.PROJECT);
                if (!projectName) return; // Пропускаем задачи без проекта
                if (!projects[projectName]) {
                    projects[projectName] = { name: projectName, tasks: [] };
                }
                projects[projectName].tasks.push({
                    name: row.get(TASK_COLUMNS.NAME),
                    status: row.get(TASK_COLUMNS.STATUS),
                    responsible: row.get(TASK_COLUMNS.RESPONSIBLE),
                    message: row.get(TASK_COLUMNS.MESSAGE),
                    version: row.get(TASK_COLUMNS.VERSION) || 0,
                    rowIndex: row.get(TASK_COLUMNS.ROW_INDEX),
                    project: projectName,
                    приоритет: row.get(TASK_COLUMNS.PRIORITY) || 99
                });
            });
        }
        
        // Отправляем собранные данные клиенту
        res.status(200).json({ projects: Object.values(projects), allProjects, userName, userRole, allEmployees });
    } catch (error) {
        console.error('Error in /api/appdata:', error);
        res.status(500).json({ error: error.message });
    }
});

// Маршрут для обновления существующей задачи
router.post('/updatetask', async (req, res) => {
    try {
        const taskData = req.body; // Получаем данные задачи для обновления
        const newVersion = await googleSheetsService.updateTaskInSheet(taskData); // Обновляем задачу через сервис
        res.status(200).json({ status: 'success', newVersion }); // Возвращаем успешный статус и новую версию
    } catch (error) {
        console.error('Error in /api/updatetask:', error);
        // Специальная обработка для конфликта оптимистической блокировки
        if (error.message.includes('изменены другим пользователем')) {
            return res.status(409).json({ error: error.message }); // 409 Conflict (конфликт)
        }
        res.status(500).json({ error: error.message });
    }
});

// Маршрут для обновления приоритетов задач (после drag & drop)
router.post('/updatepriorities', async (req, res) => {
    try {
        const { tasks: updatedTasks } = req.body; // Получаем массив задач с обновленными приоритетами
        // Проверяем формат данных
        if (!updatedTasks || !Array.isArray(updatedTasks)) {
            return res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA_FORMAT });
        }
        await googleSheetsService.updateTaskPrioritiesInSheet(updatedTasks); // Обновляем приоритеты через сервис
        res.status(200).json({ status: 'success' }); // Возвращаем успешный статус
    }
    catch (error) {
        console.error('Error in /api/updatepriorities:', error);
        res.status(500).json({ error: error.message });
    }
});

// Маршрут для добавления новой задачи
router.post('/addtask', async (req, res) => {
    try {
        const newTaskData = req.body; // Получаем данные новой задачи
        const newRow = await googleSheetsService.addTaskToSheet(newTaskData); // Добавляем задачу через сервис

        // Если указаны ответственные пользователи и создатель, отправляем уведомления
        if (newTaskData.responsibleUserIds && newTaskData.creatorId) {
            newTaskData.responsibleUserIds.forEach(userId => {
                if (userId !== newTaskData.creatorId) { // Не отправляем уведомление создателю, если он ответственный
                    // Отправляем уведомление через Telegram сервис, учитывая приоритет
                    telegramService.sendNewTaskNotification(userId, newTaskData.name, newTaskData.приоритет === 1);
                }
            });
        }
        
        // Формируем ответную задачу для клиента
        const responseTask = {
            name: newRow.get(TASK_COLUMNS.NAME),
            project: newRow.get(TASK_COLUMNS.PROJECT),
            status: newRow.get(TASK_COLUMNS.STATUS),
            responsible: newRow.get(TASK_COLUMNS.RESPONSIBLE),
            message: newRow.get(TASK_COLUMNS.MESSAGE),
            приоритет: newRow.get(TASK_COLUMNS.PRIORITY),
            version: newRow.get(TASK_COLUMNS.VERSION),
            rowIndex: newRow.get(TASK_COLUMNS.ROW_INDEX)
        };

        res.status(200).json({ status: 'success', task: responseTask }); // Возвращаем успешный статус и данные новой задачи
    } catch (error) {
        console.error('Error in /api/addtask:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; // Экспортируем роутер для использования в server.js