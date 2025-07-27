// config/constants.js

// Объект с названиями листов Google Таблицы
module.exports = {
    SHEET_NAMES: {
        TASKS: 'Задачи',      // Название листа для задач
        STATUSES: 'Статусы',  // Название листа для статусов задач
        EMPLOYEES: 'Сотрудники', // Название листа для данных о сотрудниках
        LOGS: 'Logs'          // Название листа для логов доступа
    },
    // Роли сотрудников, используемые в приложении
    EMPLOYEE_ROLES: {
        OWNER: 'owner',     // Роль владельца (для получения запросов на регистрацию)
        USER: 'user',       // Роль обычного пользователя
        ADMIN: 'admin'      // Роль администратора
    },
    // Названия колонок в листах Google Таблицы, используются для доступа к данным
    TASK_COLUMNS: {
        NAME: 'Наименование',       // Название задачи
        STATUS: 'Статус',           // Статус задачи
        RESPONSIBLE: 'Ответственный', // Ответственный(ые) за задачу
        MESSAGE: 'Сообщение исполнителю', // Сообщение для исполнителя
        PROJECT: 'Проект',          // Проект, к которому относится задача
        PRIORITY: 'Приоритет',      // Приоритет задачи
        VERSION: 'Версия',          // Версия задачи (для оптимистической блокировки)
        ROW_INDEX: 'rowIndex',      // Индекс строки в таблице (используется для обновления)
        USER_ID: 'UserID',          // ID пользователя Telegram
        EMPLOYEE_NAME: 'Имя',       // Имя сотрудника
        EMPLOYEE_PHONE: 'Номер телефона', // Номер телефона сотрудника
        EMPLOYEE_ROLE: 'Role',      // Роль сотрудника
        TIMESTAMP: 'Timestamp',     // Метка времени (для логов)
        USERNAME: 'Username',       // Имя пользователя Telegram
        FIRST_NAME: 'FirstName',    // Имя в Telegram
        LAST_NAME: 'LastName'       // Фамилия в Telegram
    },
    // Шаблоны сообщений для Telegram бота
    TELEGRAM_MESSAGES: {
        REGISTRATION_REQUEST: (name, userId) => `❗️ Запрос на регистрацию ❗️\n\nИмя: ${name}\nUserID:\n\`${userId}\`\n\nПожалуйста, добавьте этого пользователя в систему.`,
        NEW_TASK_HIGH_PRIORITY: (taskName) => `❗️Вам назначена новая задача с наивысшим приоритетом: «${taskName}»`,
        NEW_TASK: (taskName) => `Вам назначена новая задача: «${taskName}»`
    },
    // Стандартные сообщения об ошибках для API ответов
    ERROR_MESSAGES: {
        ENV_VAR_MISSING: 'ОШИБКА: Одна или несколько переменных окружения не найдены в файле .env.',
        SHEET_MISSING: 'Один или несколько обязательных листов не найдены в таблице.',
        GOOGLE_SHEET_ACCESS_ERROR: 'Внутренняя ошибка сервера при доступе к Google Sheets',
        USER_OBJECT_REQUIRED: 'User object is required',
        UNAUTHORIZED_USER_NOT_FOUND: 'Unauthorized: User not found in employees sheet',
        OWNER_NOT_FOUND: 'Владелец (owner) с UserID не найден в таблице.',
        TASK_NOT_FOUND: 'Задача не найдена',
        INVALID_DATA_FORMAT: 'Неверный формат данных',
        UNKNOWN_SERVER_ERROR: 'Неизвестная ошибка сервера'
    }
};