// config/constants.js

// Объект с названиями листов Google Таблицы
module.exports = {
    // Названия листов в Google Таблице, соответствующие файлам AvigeyaProjectDataBase
    SHEET_NAMES: {
        TASKS: 'Tasks',
        PROJECTS: 'Projects',
        USERS: 'Users',
        MEMBERS: 'Members', // Участники конкретных задач
        PROJECT_MEMBERS: 'ProjectMembers', // Участники конкретных проектов
        STATUSES: 'Statuses',
        LOGS: 'ActivityLog',
    },

    // Новый список ролей с описанием их функционала
    EMPLOYEE_ROLES: {
        OWNER: 'owner',         // Владелец. Полный доступ ко всем данным и настройкам.
        ADMIN: 'admin',         // Администратор. Полный доступ ко всем проектам и задачам.
        DESIGNER: 'designer',   // Проектировщик/дизайнер. Видит свои задачи и может создавать новые для участников своих проектов.
        CONTRACTOR: 'contractor', // Подрядчик. Видит только те задачи, в которых он является исполнителем.
        PARTNER: 'partner',       // Партнер. Видит задачи в своих проектах, может создавать новые.
        CLIENT: 'client'          // Клиент. Имеет доступ только к просмотру задач в своих проектах.
    },

    // Названия колонок для листа "Tasks"
    TASK_COLUMNS: {
        TASK_ID: 'TaskID',
        NAME: 'Name', // В таблице Tasks это колонка "Name"
        STAGE_ID: 'StageID',
        PROJECT_ID: 'ProjectID',
        USER_ID: 'UserID', // Основной ответственный (куратор)
        STATUS_ID: 'StatusID',
        PRIORITY: 'Priority',
        AUTHOR_USER_ID: 'AuthorUserID',
        VERSION: 'Version',
        START_DATE: 'StartData',
        FINISH_DATE: 'FinishData',
        // Технические поля, которые мы используем
        MODIFIED_BY: 'ModifiedBy',
        MODIFIED_AT: 'ModifiedAt',
        GROUP_ID: 'GroupID', // Для связи задач с несколькими исполнителями
        ROW_INDEX: 'rowIndex' // Физический номер строки для быстрых обновлений
    },

    // Названия колонок для листа "Users"
    USER_COLUMNS: {
        USER_ID: 'UserID',
        NAME: 'Name',
        ROLE: 'Role',
        TG_USER_ID: 'TGUserID', 
    },

    // Названия колонок для листа "Projects"
    PROJECT_COLUMNS: {
        PROJECT_ID: 'ProjectID',
        PROJECT_NAME: 'Name'
    },
    
    // Названия колонок для листа "Members" (дополнительные участники задачи)
    MEMBER_COLUMNS: {
        MEMBER_ID: 'MemberID',
        TASK_ID: 'TaskID',
        USER_ID: 'UserID'
    },

    // Названия колонок для листа "Statuses"
    STATUS_COLUMNS: {
        STATUS_ID: 'StatusID',
        STATUS_NAME: 'StatusName'
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
        TASK_NOT_FOUND: 'Задача не найдена',
        INVALID_DATA_FORMAT: 'Неверный формат данных',
        UNKNOWN_SERVER_ERROR: 'Неизвестная ошибка сервера'
    }
};