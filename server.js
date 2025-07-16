require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Проверка переменных ---
if (!process.env.SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.BOT_TOKEN) {
    console.error('ОШИБКА: Одна или несколько переменных окружения не найдены в файле .env.');
    process.exit(1);
}

// --- Настройка ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);
const bot = new TelegramBot(process.env.BOT_TOKEN);

// --- Middleware для загрузки данных из Google Sheets ---
const loadSheetData = async (req, res, next) => {
    try {
        await doc.loadInfo();
        req.sheets = {
            tasks: doc.sheetsByTitle['Задачи'],
            statuses: doc.sheetsByTitle['Статусы'],
            employees: doc.sheetsByTitle['Сотрудники'],
            logs: doc.sheetsByTitle['Logs']
        };

        // Проверяем, что основные листы существуют
        if (!req.sheets.tasks || !req.sheets.statuses || !req.sheets.employees) {
            console.error('Один или несколько обязательных листов не найдены в таблице.');
            return res.status(500).json({ error: 'Ошибка конфигурации сервера: не найдены необходимые листы в таблице.' });
        }
        next(); // Переходим к следующему обработчику
    } catch (error) {
        console.error('Ошибка при загрузке информации из Google Sheets:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера при доступе к Google Sheets' });
    }
};

// --- API Endpoints ---

// Проверка пользователя и логирование
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
            // --- ЛОГИРОВАНИЕ ВХОДА ---
            try {
                if (logSheet) {
                    await logSheet.addRow({
                        Timestamp: new Date().toISOString(),
                        UserID: user.id,
                        Username: user.username || '',
                        FirstName: user.first_name || '',
                        LastName: user.last_name || ''
                    });
                } else {
                    console.warn('Внимание: Лист "Logs" для логирования не найден в таблице.');
                }
            } catch (logError) {
                console.error('Ошибка при записи в лог:', logError.message);
            }
            // --- КОНЕЦ ЛОГИРОВАНИЯ ---

            res.status(200).json({ status: 'authorized' });
        } else {
            res.status(200).json({ status: 'unregistered' });
        }
    } catch (error) {
        console.error('Ошибка верификации пользователя:', error);
        res.status(500).json({ error: error.message });
    }
});

// Запрос на регистрацию
app.post('/api/requestregistration', loadSheetData, async (req, res) => {
    const { name, userId } = req.body;
    try {
        const rows = await req.sheets.employees.getRows();
        const owner = rows.find(row => row.get('Role') === 'owner');

        if (owner && owner.get('UserID')) {
            const ownerId = owner.get('UserID');
            const message = `❗️ Запрос на регистрацию ❗️\n\nИмя: ${name}\nUserID:\n\`${userId}\`\n\nПожалуйста, добавьте этот UserID в таблицу для соответствующего сотрудника.`;
            
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


// Получение данных с учетом роли пользователя
app.post('/api/appdata', loadSheetData, async (req, res) => {
    try {
        const { tasks: tasksSheet, statuses: statusSheet, employees: employeeSheet } = req.sheets;

        const user = req.body.user; // Предполагается, что информация о пользователе передается с запросом
        if (!user || !user.id) {
            return res.status(400).json({ error: 'User object is required' });
        }

        const employeeRows = await employeeSheet.getRows();
        const currentUser = employeeRows.find(row => row.get('UserID') == user.id);

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        let projects = {};

        if (currentUser.get('Role') === 'user') {
            const userSheetName = currentUser.get('Лист'); //  Имя листа пользователя из таблицы Сотрудники
            if (userSheetName && doc.sheetsByTitle[userSheetName]) {
                const userTasksSheet = doc.sheetsByTitle[userSheetName];
                const userTasksRows = await userTasksSheet.getRows();
                projects[userSheetName] = { name: userSheetName, tasks: userTasksRows.map(row => ({
                    name: row.get('Наименование'), status: row.get('Статус'),
                    responsible: row.get('Ответственный'), message: row.get('Сообщение исполнителю')
                }))};
            } else {
                console.warn(`Лист "${userSheetName}" для пользователя ${user.id} не найден.`);
            }
        } else { // Для всех остальных ролей (owner и т.д.) - вся информация
            const tasksRows = await tasksSheet.getRows();
            tasksRows.forEach((row, index) => {
                const projectName = row.get('Проект');
                if (!projectName) return;
                if (!projects[projectName]) {
                    projects[projectName] = { name: projectName, tasks: [] };
                }
                projects[projectName].tasks.push({
                    name: row.get('Наименование'), status: row.get('Статус'),
                    responsible: row.get('Ответственный'), message: row.get('Сообщение исполнителю'),
                    rowIndex: index + 2
                });
            });
        }
        const statuses = (await statusSheet.getRows()).map(row => row.get('Статус'));
        const employees = (await employeeSheet.getRows()).map(row => row.get('Сотрудник'));

        res.status(200).json({ projects: Object.values(projects), statuses, employees });
    } catch (error) {
        console.error('Ошибка в /api/appdata:', error);
        res.status(500).json({ error: error.message });
    }
});

// Обновление задачи
app.post('/api/updatetask', loadSheetData, async (req, res) => {
  try {
    const taskData = req.body;
    const rows = await req.sheets.tasks.getRows();
    
    const rowToUpdate = rows[taskData.rowIndex - 2]; 
    if (rowToUpdate) {
      rowToUpdate.set('Наименование', taskData.name);
      rowToUpdate.set('Статус', taskData.status);
      rowToUpdate.set('Ответственный', taskData.responsible.join(', '));
      rowToUpdate.set('Сообщение исполнителю', taskData.message);
      await rowToUpdate.save();
      res.status(200).json({ status: 'success' });
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (error) {
    console.error('!!! ОШИБКА в /api/updatetask:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
