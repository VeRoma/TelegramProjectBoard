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
    if (req.body && Object.keys(req.body).length) {
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
        req.sheets = {
            tasks: doc.sheetsByTitle['Задачи'],
            statuses: doc.sheetsByTitle['Статусы'],
            employees: doc.sheetsByTitle['Сотрудники'],
            logs: doc.sheetsByTitle['Logs']
        };

        if (!req.sheets.tasks || !req.sheets.statuses || !req.sheets.employees || !req.sheets.logs) {
            console.error('Один или несколько обязательных листов не найдены в таблице.');
            return res.status(500).json({ error: 'Ошибка конфигурации сервера: не найдены необходимые листы в таблице.' });
        }
        next();
    } catch (error) {
        console.error('Ошибка при загрузке информации из Google Sheets:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера при доступе к Google Sheets' });
    }
};

app.post('/api/verifyuser', loadSheetData, async (req, res) => {
    const { user } = req.body;
    if (!user || !user.id) {
        return res.status(400).json({ error: 'User object is required' });
    }
    try {
        const { employees: employeeSheet, logs: logSheet } = req.sheets;
        const rows = await employeeSheet.getRows();
        const userRow = rows.find(row => row.get('UserID') == user.id);

        if (userRow) {
            if (logSheet) {
                await logSheet.addRow({
                    Timestamp: new Date().toISOString(),
                    UserID: user.id,
                    Username: user.username || '',
                    FirstName: user.first_name || '',
                    LastName: user.last_name || ''
                });
            }
            res.status(200).json({ status: 'authorized', name: userRow.get('Имя'), role: userRow.get('Role') });
        }  else {
            res.status(200).json({ status: 'unregistered' });
        }
    } catch (error) {
        console.error('Ошибка верификации пользователя:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/requestregistration', loadSheetData, async (req, res) => {
    const { name, userId } = req.body;
    try {
        const rows = await req.sheets.employees.getRows();
        const owner = rows.find(row => row.get('Role') === 'owner');

        if (owner && owner.get('UserID')) {
            const ownerId = owner.get('UserID');
            const message = `❗️ Запрос на регистрацию ❗️\n\nИмя: ${name}\nUserID:\n\`${userId}\`\n\nПожалуйста, добавьте этого пользователя в систему.`;
            
            await bot.sendMessage(ownerId, message, { parse_mode: 'Markdown' });
            res.status(200).json({ status: 'request_sent' });
        } else {
            throw new Error('Владелец (owner) с UserID не найден в таблице.');
        }
    } catch (error) {
        console.error('Ошибка отправки запроса на регистрацию:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/appdata', loadSheetData, async (req, res) => {
    try {
        const { tasks: tasksSheet, employees: employeesSheet } = req.sheets;
        const { user } = req.body;

        if (!user || !user.id) {
            return res.status(400).json({ error: 'User info is required' });
        }

        const employeeRows = await employeesSheet.getRows();
        const currentUserRecord = employeeRows.find(row => row.get('UserID') == user.id);

        if (!currentUserRecord) {
            return res.status(401).json({ error: 'Unauthorized: User not found in employees sheet' });
        }

        const userName = currentUserRecord.get('Имя');
        const userRole = currentUserRecord.get('Role');

        let projects = {};
        const allTasksRows = await tasksSheet.getRows();
        const validTasksRows = allTasksRows.filter(row => row.get('Наименование'));

        const allProjects = [...new Set(validTasksRows.map(r => r.get('Проект')).filter(Boolean))];

        const allEmployees = employeeRows.map(row => ({
            name: row.get('Имя'),
            phoneNumber: row.get('Номер телефона'),
            userId: row.get('UserID'),
            role: row.get('Role')
        }));

        if (userRole === 'user') {
            if (doc.sheetsByTitle[userName]) {
                const userTasksSheet = doc.sheetsByTitle[userName];
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
        } else {
            validTasksRows.forEach((row) => {
                const projectName = row.get('Проект');
                if (!projectName) return;
                if (!projects[projectName]) {
                    projects[projectName] = { name: projectName, tasks: [] };
                }
                projects[projectName].tasks.push({
                    name: row.get('Наименование'), status: row.get('Статус'),
                    responsible: row.get('Ответственный'), message: row.get('Сообщение исполнителю'),
                    version: row.get('Версия') || 0, rowIndex: row.get('rowIndex'),
                    project: projectName,
                    приоритет: row.get('Приоритет') || 99
                });
            });
        }
        
        res.status(200).json({ projects: Object.values(projects), allProjects, userName, userRole, allEmployees });
    } catch (error) {
        console.error('Ошибка в /api/appdata:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/updatetask', loadSheetData, async (req, res) => {
    try {
        const taskData = req.body;
        const rows = await req.sheets.tasks.getRows();
        
        const rowToUpdate = rows.find(row => row.get('rowIndex') == taskData.rowIndex);
        if (!rowToUpdate) {
            return res.status(404).json({ error: 'Задача не найдена' });
        }

        const currentVersion = rowToUpdate.get('Версия') || 0;
        
        rowToUpdate.set('Наименование', taskData.name);
        rowToUpdate.set('Статус', taskData.status);
        rowToUpdate.set('Проект', taskData.project);

        if (Array.isArray(taskData.responsible)) {
            rowToUpdate.set('Ответственный', taskData.responsible.join(', '));
        } else {
            rowToUpdate.set('Ответственный', taskData.responsible);
        }

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
        await tasksSheet.loadCells();

        for (const task of updatedTasks) {
            const priorityCell = tasksSheet.getCellByA1(`I${task.rowIndex}`); 
            priorityCell.value = task.приоритет;
        }

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

        const newRow = await tasksSheet.addRow({
            Наименование: newTaskData.name,
            Проект: newTaskData.project,
            Статус: newTaskData.status,
            Ответственный: newTaskData.responsible,
            'Сообщение исполнителю': newTaskData.message,
            Приоритет: newTaskData.приоритет,
            Версия: 0,
        });

        const newRowIndex = newRow.rowNumber;
        newRow.set('rowIndex', newRowIndex);
        await newRow.save();

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

        res.status(200).json({ status: 'success', task: responseTask });
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