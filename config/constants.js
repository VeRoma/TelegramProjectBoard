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
        OWNER: 'owner',       // Роль владельца
        USER: 'user',         // Роль обычного пользователя
        ADMIN: 'admin'        // Роль администратора
    },
    // Названия колонок в листах Google Таблицы
    TASK_COLUMNS: {
        NAME: 'Наименование',
        STATUS: 'Статус',
        RESPONSIBLE: 'Ответственный',
        MESSAGE: 'Сообщение исполнителю',
        PROJECT: 'Проект',
        PRIORITY: 'Приоритет',
        VERSION: 'Версия',
        ROW_INDEX: 'rowIndex',
        USER_ID: 'UserID',
        EMPLOYEE_NAME: 'Имя',
        EMPLOYEE_PHONE: 'Номер телефона',
        EMPLOYEE_ROLE: 'Role',
        TIMESTAMP: 'Timestamp',
        USERNAME: 'Username',
        FIRST_NAME: 'FirstName',
        LAST_NAME: 'LastName',
        // --- НОВЫЕ КОЛОНКИ ---
        MODIFIED_BY: 'Кем изменено',
        MODIFIED_AT: 'Когда изменено'
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