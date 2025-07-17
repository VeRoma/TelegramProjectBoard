require('dotenv').config({ override: true });
const express = require('express');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.BOT_TOKEN) {
    console.error('ОШИБКА: Одна или несколько переменных окружения не найдены в файле .env.');
    process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (Object.keys(req.body).length) {
        console.log('  Данные запроса:', req.body);
    }
    next();
});

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);
const bot = new TelegramBot(process.env.BOT_TOKEN);

const loadSheetData = async (req, res, next) => {
    try {
        await doc.loadInfo();
        // Теперь загружаем только обязательный лист "Задачи"
        req.sheets = {
            tasks: doc.sheetsByTitle['Задачи'],
        };

        if (!req.sheets.tasks) {
            console.error('Обязательный лист "Задачи" не найден в таблице.');
            return res.status(500).json({ error: 'Ошибка конфигурации сервера: не найден лист "Задачи".' });
        }
        next();
    } catch (error) {
        console.error('Ошибка при загрузке информации из Google Sheets:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера при доступе к Google Sheets' });
    }
};

// --- API Endpoints ---

// Эндпоинт теперь просто подтверждает, что пользователь пришел из Telegram
app.post('/api/verifyuser', (req, res) => {
    const { user } = req.body;
    if (!user || !user.id) {
        return res.status(400).json({ error: 'User object is required' });
    }
    // Просто возвращаем успешный статус. Вся логика теперь на фронте.
    res.status(200).json({ status: 'authorized' });
});


// Этот эндпоинт временно не будет работать корректно, т.к. список сотрудников на фронте.
app.post('/api/requestregistration', (req, res) => {
    console.warn("Вызов /api/requestregistration. Эта функция требует доработки.");
    res.status(501).json({ error: 'Функция временно не поддерживается' });
});


// Получение данных теперь возвращает только проекты/задачи

app.post('/api/appdata', loadSheetData, async (req, res) => {
    try {
        const { tasks: tasksSheet } = req.sheets;
        const { user, userName, userRole } = req.body;

        if (!user || !user.id || !userName || !userRole) {
            return res.status(400).json({ error: 'User info is required' });
        }

        let projects = {};
        // Получаем все строки один раз
        const allTasksRows = await tasksSheet.getRows();
        // ▼▼▼ Фильтруем пустые задачи сразу ▼▼▼
        const validTasksRows = allTasksRows.filter(row => row.get('Наименование'));

        const allProjects = [...new Set(validTasksRows.map(r => r.get('Проект')).filter(Boolean))];

        if (userRole === 'user') {
            if (doc.sheetsByTitle[userName]) {
                const userTasksSheet = doc.sheetsByTitle[userName];
                // Получаем строки и сразу фильтруем их
                const userTasksRows = (await userTasksSheet.getRows()).filter(row => row.get('Наименование'));

                projects[userName] = {
                    name: userName,
                    tasks: userTasksRows.map(row => ({
                        name: row.get('Наименование'),
                        status: row.get('Статус'),
                        responsible: row.get('Ответственный'),
                        message: row.get('Сообщение исполнителю'),
                        rowIndex: row.get('rowIndex'),
                        version: row.get('Версия') || 0,
                        project: row.get('Проект'),
                        приоритет: row.get('Приоритет') || 99
                    }))
                };
            } else {
                console.warn(`Лист "${userName}" для пользователя ${user.id} не найден.`);
            }
        } else { // admin, owner, etc.
            // Используем уже отфильтрованный массив validTasksRows
            validTasksRows.forEach((row, index) => {
                const projectName = row.get('Проект');
                if (!projectName) return;
                if (!projects[projectName]) {
                    projects[projectName] = { name: projectName, tasks: [] };
                }
                projects[projectName].tasks.push({
                    name: row.get('Наименование'), status: row.get('Статус'),
                    responsible: row.get('Ответственный'), message: row.get('Сообщение исполнителю'),
                    version: row.get('Версия') || 0, rowIndex: row.get('rowIndex'), // Используем rowIndex из таблицы
                    project: projectName,
                    приоритет: row.get('Приоритет') || 99
                });
            });
        }
        
        res.status(200).json({ projects: Object.values(projects), allProjects });
    } catch (error) {
        console.error('Ошибка в /api/appdata:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/updatetask', loadSheetData, async (req, res) => {
    try {
        const taskData = req.body;
        const rows = await req.sheets.tasks.getRows();
        
        const rowToUpdate = rows[taskData.rowIndex - 2];
        if (!rowToUpdate) {
            return res.status(404).json({ error: 'Задача не найдена' });
        }

        const currentVersion = rowToUpdate.get('Версия') || 0;
        if (taskData.version !== currentVersion) {
            return res.status(409).json({ error: 'Данные были изменены другим пользователем. Пожалуйста, обновите страницу.' });
        }

        rowToUpdate.set('Наименование', taskData.name);
        rowToUpdate.set('Статус', taskData.status);
        rowToUpdate.set('Ответственный', taskData.responsible.join(', '));
        rowToUpdate.set('Сообщение исполнителю', taskData.message);
        rowToUpdate.set('Версия', currentVersion + 1);
        await rowToUpdate.save();
        res.status(200).json({ status: 'success', newVersion: currentVersion + 1 });
    } catch (error) {
        console.error('!!! ОШИБКА в /api/updatetask:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/updatepriorities', loadSheetData, async (req, res) => {
    try {
        const { tasks: updatedTasks } = req.body;
        if (!updatedTasks || !Array.isArray(updatedTasks)) {
            return res.status(400).json({ error: 'Неверный формат данных' });
        }

        const tasksSheet = req.sheets.tasks;
        await tasksSheet.loadCells(); // Загружаем все ячейки для быстрого доступа

        // Проходим по каждой задаче из запроса и обновляем ячейку с приоритетом
        for (const task of updatedTasks) {
            // Находим нужную ячейку. 'D' - это пример, замените на букву вашей колонки "Приоритет"
            // Если у вас нет такой колонки, её нужно создать.
            const priorityCell = tasksSheet.getCellByA1(`D${task.rowIndex}`); 
            priorityCell.value = task.приоритет;
        }

        // Сохраняем все измененные ячейки одним запросом
        await tasksSheet.saveUpdatedCells();
        
        res.status(200).json({ status: 'success' });

    } catch (error) {
        console.error('!!! ОШИБКА в /api/updatepriorities:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/addtask', loadSheetData, async (req, res) => {
    try {
        const newTaskData = req.body;
        const tasksSheet = req.sheets.tasks;

        // 1. Добавляем новую строку
        const newRow = await tasksSheet.addRow({
            Наименование: newTaskData.name,
            Проект: newTaskData.project,
            Статус: newTaskData.status,
            Ответственный: newTaskData.responsible,
            'Сообщение исполнителю': newTaskData.message,
            Приоритет: newTaskData.приоритет,
            Версия: 0,
        });

        // 2. Устанавливаем и сохраняем rowIndex
        const newRowIndex = newRow.rowNumber;
        newRow.set('rowIndex', newRowIndex);
        await newRow.save();

        // 3. Отправляем уведомления (этот блок без изменений)
        if (newTaskData.responsibleUserIds && newTaskData.creatorId) {
            newTaskData.responsibleUserIds.forEach(userId => {
                if (userId !== newTaskData.creatorId) {
                    const message = newTaskData.приоритет === 1 
                        ? `❗️Вам назначена новая задача с наивысшим приоритетом: «${newTaskData.name}»`
                        : `Вам назначена новая задача: «${newTaskData.name}»`;
                    bot.sendMessage(userId, message).catch(err => console.error(`Failed to send message to ${userId}:`, err));
                }
            });
        }
        
        // ▼▼▼ НАЧАЛО ИЗМЕНЕНИЯ ▼▼▼
        // 4. Формируем ответ с правильными ключами, которые ожидает фронтенд
        const responseTask = {
            name: newRow.get('Наименование'),
            project: newRow.get('Проект'),
            status: newRow.get('Статус'),
            responsible: newRow.get('Ответственный'),
            message: newRow.get('Сообщение исполнителю'),
            приоритет: newRow.get('Приоритет'),
            version: newRow.get('Версия'),
            rowIndex: newRow.get('rowIndex')
        };

        // 5. Отправляем правильно сформированный объект
        res.status(200).json({ status: 'success', task: responseTask });
        // ▲▲▲ КОНЕЦ ИЗМЕНЕНИЯ ▲▲▲

    } catch (error) {
        console.error('!!! ОШИБКА в /api/addtask:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/log', (req, res) => {
    const { level = 'INFO', message, context } = req.body;
    console.log(`[CLIENT ${level}] ${message}`, context || '');
    res.sendStatus(204);
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

