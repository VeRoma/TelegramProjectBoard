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

// --- Проверка наличия переменных окружения при старте ---
if (!process.env.SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error('ОШИБКА: Одна или несколько переменных окружения (SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY) не найдены в файле .env. Проверьте файл и перезапустите сервер.');
    process.exit(1); // Завершаем работу, если нет ключей
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
  console.log('--- --- ---');
  console.log(`[${new Date().toISOString()}] Получен запрос на /api/appdata`);
  try {
    console.log('Шаг 1: Загрузка информации о таблице (doc.loadInfo)...');
    await doc.loadInfo();
    console.log('Шаг 1: УСПЕШНО. Информация о таблице загружена.');

    console.log('Шаг 2: Получение листов...');
    const tasksSheet = doc.sheetsByTitle['Задачи'];
    if (!tasksSheet) throw new Error('Не удалось найти лист "Задачи"');
    
    const statusSheet = doc.sheetsByTitle['Статусы'];
    if (!statusSheet) throw new Error('Не удалось найти лист "Статусы"');

    const employeeSheet = doc.sheetsByTitle['Сотрудники'];
    if (!employeeSheet) throw new Error('Не удалось найти лист "Сотрудники"');
    console.log('Шаг 2: УСПЕШНО. Все листы найдены.');

    console.log('Шаг 3: Чтение строк с листов...');
    const tasksRows = await tasksSheet.getRows();
    console.log(`- Прочитано ${tasksRows.length} строк с листа "Задачи"`);

    const statuses = (await statusSheet.getRows()).map(row => row.get('Статус'));
    console.log(`- Прочитано ${statuses.length} статусов`);

    const employees = (await employeeSheet.getRows()).map(row => row.get('Сотрудник'));
    console.log(`- Прочитано ${employees.length} сотрудников`);
    console.log('Шаг 3: УСПЕШНО. Все строки прочитаны.');

    console.log('Шаг 4: Группировка задач по проектам...');
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
    console.log('Шаг 4: УСПЕШНО. Проекты сгруппированы.');

    console.log('Шаг 5: Отправка успешного ответа клиенту.');
    res.status(200).json({
      projects: Object.values(projects),
      statuses,
      employees
    });

  } catch (error) {
    // --- ВАЖНО: ЛОГИРОВАНИЕ ПОЛНОЙ ОШИБКИ ---
    console.error('!!! ПРОИЗОШЛА ОШИБКА !!!');
    console.error('Текст ошибки:', error.message);
    console.error('Полный объект ошибки:', error); // Выводим всю информацию об ошибке
    res.status(500).json({ error: error.message });
  }
});

// Обновление задачи
app.post('/api/updatetask', async (req, res) => {
  // ... (здесь логика обновления, пока без изменений)
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
