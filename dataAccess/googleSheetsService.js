// dataAccess/googleSheetsService.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
// Импорт констант для использования названий листов и колонок
const { SHEET_NAMES, TASK_COLUMNS, EMPLOYEE_ROLES, ERROR_MESSAGES } = require('../config/constants');

// Инициализация аутентификации для доступа к Google Sheets API
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, // Email сервисного аккаунта из .env
  key: process.env.GOOGLE_PRIVATE_KEY,            // Приватный ключ из .env
  scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Область доступа: только таблицы
});
// Инициализация объекта Google Spreadsheet с ID вашей таблицы и аутентификацией
const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);

// Middleware для загрузки информации о листах таблицы перед обработкой запроса
// Это гарантирует, что все необходимые листы доступны в req.sheets
const loadSheetDataMiddleware = async (req, res, next) => {
    try {
        await doc.loadInfo(); // Загружает информацию обо всех листах в таблице
        // Сохраняем ссылки на листы в объекте req.sheets для удобного доступа в роутах
        req.sheets = {
            tasks: doc.sheetsByTitle[SHEET_NAMES.TASKS],
            statuses: doc.sheetsByTitle[SHEET_NAMES.STATUSES],
            employees: doc.sheetsByTitle[SHEET_NAMES.EMPLOYEES],
            logs: doc.sheetsByTitle[SHEET_NAMES.LOGS]
        };

        // Проверяем наличие всех обязательных листов
        if (!req.sheets.tasks || !req.sheets.statuses || !req.sheets.employees || !req.sheets.logs) {
            console.error('One or more required sheets not found in the spreadsheet.');
            return res.status(500).json({ error: ERROR_MESSAGES.SHEET_MISSING });
        }
        next(); // Передаем управление следующему middleware или обработчику роута
    } catch (error) {
        console.error('Error loading Google Sheets info:', error);
        res.status(500).json({ error: ERROR_MESSAGES.GOOGLE_SHEET_ACCESS_ERROR });
    }
};

// Вспомогательная функция для получения строк из указанного листа
const getSheetRows = async (sheetTitle) => {
    await doc.loadInfo(); // Убедиться, что информация о листах загружена
    const sheet = doc.sheetsByTitle[sheetTitle];
    if (!sheet) {
        throw new Error(`Sheet "${sheetTitle}" not found.`);
    }
    return sheet.getRows(); // Возвращает все строки из листа
};

// Вспомогательная функция для получения объекта листа по названию
const getSheet = async (sheetTitle) => {
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[sheetTitle];
    if (!sheet) {
        throw new Error(`Sheet "${sheetTitle}" not found.`);
    }
    return sheet;
};

// *** Функции для работы с данными сотрудников ***

// Получить запись о сотруднике по его UserID
const getEmployeeById = async (userId) => {
    const employeesSheet = await getSheet(SHEET_NAMES.EMPLOYEES);
    const rows = await employeesSheet.getRows();
    return rows.find(row => row.get(TASK_COLUMNS.USER_ID) == userId);
};

// Получить запись о сотруднике с ролью 'owner'
const getOwnerEmployee = async () => {
    const employeesSheet = await getSheet(SHEET_NAMES.EMPLOYEES);
    const rows = await employeesSheet.getRows();
    return rows.find(row => row.get(TASK_COLUMNS.EMPLOYEE_ROLE) === EMPLOYEE_ROLES.OWNER);
};

// Получить список всех сотрудников
const getAllEmployees = async () => {
    const employeesSheet = await getSheet(SHEET_NAMES.EMPLOYEES);
    const rows = await employeesSheet.getRows();
    return rows.map(row => ({
        name: row.get(TASK_COLUMNS.EMPLOYEE_NAME),
        phoneNumber: row.get(TASK_COLUMNS.EMPLOYEES_PHONE),
        userId: row.get(TASK_COLUMNS.USER_ID),
        role: row.get(TASK_COLUMNS.EMPLOYEE_ROLE)
    }));
};

// *** Функции для работы с данными задач ***

// Получить все задачи из листа 'Задачи'
const getTasks = async () => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    const rows = await tasksSheet.getRows();
    // Фильтруем строки, чтобы исключить те, у которых нет наименования (пустые)
    return rows.filter(row => row.get(TASK_COLUMNS.NAME));
};

// Получить задачу по её rowIndex (используется для обновления)
const getTaskByRowIndex = async (rowIndex) => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    const rows = await tasksSheet.getRows();
    return rows.find(row => row.get(TASK_COLUMNS.ROW_INDEX) == rowIndex);
};

// Обновить данные задачи в таблице
const updateTaskInSheet = async (taskData) => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    const rows = await tasksSheet.getRows();
    const rowToUpdate = rows.find(row => row.get(TASK_COLUMNS.ROW_INDEX) == taskData.rowIndex);

    if (!rowToUpdate) {
        throw new Error(ERROR_MESSAGES.TASK_NOT_FOUND);
    }
    
    // Оптимистическая блокировка: проверяем, не изменилась ли задача другим пользователем
    const currentVersion = rowToUpdate.get(TASK_COLUMNS.VERSION) || 0;
    if (taskData.version && taskData.version !== currentVersion) {
        throw new Error('Данные задачи были изменены другим пользователем. Обновите страницу и повторите попытку.');
    }

    // Обновляем поля задачи
    rowToUpdate.set(TASK_COLUMNS.NAME, taskData.name);
    rowToUpdate.set(TASK_COLUMNS.STATUS, taskData.status);
    rowToUpdate.set(TASK_COLUMNS.PROJECT, taskData.project);
    // Ответственные могут быть массивом, преобразуем в строку через запятую
    rowToUpdate.set(TASK_COLUMNS.RESPONSIBLE, Array.isArray(taskData.responsible) ? taskData.responsible.join(', ') : taskData.responsible);
    rowToUpdate.set(TASK_COLUMNS.MESSAGE, taskData.message);
    rowToUpdate.set(TASK_COLUMNS.VERSION, currentVersion + 1); // Увеличиваем версию

    await rowToUpdate.save(); // Сохраняем изменения
    return currentVersion + 1; // Возвращаем новую версию
};

// Добавить новую задачу в таблицу
const addTaskToSheet = async (newTaskData) => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    // Добавляем новую строку с данными задачи
    const newRow = await tasksSheet.addRow({
        [TASK_COLUMNS.NAME]: newTaskData.name,
        [TASK_COLUMNS.PROJECT]: newTaskData.project,
        [TASK_COLUMNS.STATUS]: newTaskData.status,
        [TASK_COLUMNS.RESPONSIBLE]: newTaskData.responsible,
        [TASK_COLUMNS.MESSAGE]: newTaskData.message,
        [TASK_COLUMNS.PRIORITY]: newTaskData.приоритет,
        [TASK_COLUMNS.VERSION]: 0, // Начальная версия новой задачи
    });
    const newRowIndex = newRow.rowNumber;
    newRow.set(TASK_COLUMNS.ROW_INDEX, newRowIndex); // Сохраняем rowIndex в самой строке
    await newRow.save();
    return newRow;
};

// Обновить приоритеты задач в таблице
const updateTaskPrioritiesInSheet = async (updatedTasks) => {
    const tasksSheet = await getSheet(SHEET_NAMES.TASKS);
    await tasksSheet.loadCells(); // Загружаем все ячейки для эффективного обновления

    for (const task of updatedTasks) {
        // Получаем ячейку приоритета по A1 нотации (например, 'I' + rowIndex)
        const priorityCell = tasksSheet.getCellByA1(`I${task.rowIndex}`); // !!! Предполагается, что 'I' - это колонка "Приоритет"
        priorityCell.value = task.приоритет;
    }
    await tasksSheet.saveUpdatedCells(); // Сохраняем все обновленные ячейки
};

// Записать лог доступа пользователя
const logUserAccess = async (user) => {
    const logSheet = await getSheet(SHEET_NAMES.LOGS);
    await logSheet.addRow({
        [TASK_COLUMNS.TIMESTAMP]: new Date().toISOString(),
        [TASK_COLUMNS.USER_ID]: user.id,
        [TASK_COLUMNS.USERNAME]: user.username || '',
        [TASK_COLUMNS.FIRST_NAME]: user.first_name || '',
        [TASK_COLUMNS.LAST_NAME]: user.last_name || ''
    });
};

// Экспортируем функции и middleware для использования в других модулях
module.exports = {
    loadSheetDataMiddleware, // Middleware для загрузки данных листов
    getSheetRows,            // Получить все строки из листа
    getSheet,                // Получить объект листа
    getEmployeeById,         // Получить сотрудника по ID
    getOwnerEmployee,        // Получить владельца
    getAllEmployees,         // Получить всех сотрудников
    getTasks,                // Получить все задачи
    getTaskByRowIndex,       // Получить задачу по rowIndex
    updateTaskInSheet,       // Обновить задачу
    addTaskToSheet,          // Добавить задачу
    updateTaskPrioritiesInSheet, // Обновить приоритеты
    logUserAccess,           // Записать лог доступа
    doc                      // Экспортируем doc для прямого доступа к листам (например, для листов пользователей)
};