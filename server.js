// Загружаем переменные окружения из файла .env
require('dotenv').config();

const express = require('express');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware для обработки JSON и статических файлов
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Проверка наличия переменных окружения при старте
if (!process.env.SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error('ОШИБКА: Одна или несколько переменных окружения не найдены в файле .env.');
    process.exit(1);
}

// Настройка доступа к Google Sheets
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);

// --- API Endpoints ---

// Получение всех данных
app.post('/api/appdata', async (req, res) => {
  try {
    await doc.loadInfo();
    const tasksSheet = doc.sheetsByTitle['Задачи'];
    const statusSheet = doc.sheetsByTitle['Статусы'];
    const employeeSheet = doc.sheetsByTitle['Сотрудники'];

    if (!tasksSheet || !statusSheet || !employeeSheet) {
        throw new Error('Один или несколько листов ("Задачи", "Статусы", "Сотрудники") не найдены в таблице.');
    }

    const tasksRows = await tasksSheet.getRows();
    const statuses = (await statusSheet.getRows()).map(row => row.get('Статус'));
    const employees = (await employeeSheet.getRows()).map(row => row.get('Сотрудник'));

    const projects = {};
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

    res.status(200).json({
      projects: Object.values(projects),
      statuses,
      employees
    });
  } catch (error) {
    console.error('!!! ОШИБКА в /api/appdata:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обновление задачи
app.post('/api/updatetask', async (req, res) => {
    // ... (код без изменений)
});

// --- НОВЫЙ МАРШРУТ ДЛЯ ЛОГИРОВАНИЯ ---
app.post('/api/logvisit', async (req, res) => {
    try {
        const userData = req.body;
        if (!userData || !userData.id) {
            // Не логируем, если нет данных пользователя
            return res.status(200).json({ status: 'skipped', message: 'No user data to log.' });
        }

        await doc.loadInfo();
        const logsSheet = doc.sheetsByTitle['Логи'];
        if (!logsSheet) {
            console.error('Лист "Логи" для записи статистики не найден.');
            return res.status(500).json({ error: 'Log sheet not found.' });
        }

        // Добавляем новую строку в лог
        await logsSheet.addRow({
            Timestamp: new Date().toISOString(),
            UserID: userData.id,
            Username: userData.username || '',
            FirstName: userData.first_name || '',
            LastName: userData.last_name || ''
        });

        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('!!! ОШИБКА в /api/logvisit:', error);
        res.status(500).json({ error: error.message });
    }
});


app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
