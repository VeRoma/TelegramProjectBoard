// Загрузка переменных окружения из .env файла
require('dotenv').config({ override: true });

const express = require('express'); // Импорт фреймворка Express
const path = require('path');      // Импорт модуля для работы с путями файлов

// Импорт маршрутов для аутентификации и задач
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');

// Импорт констант для сообщений об ошибках
const { ERROR_MESSAGES } = require('./config/constants');

const app = express(); // Создание экземпляра Express приложения

const PORT = process.env.PORT || 3000; // Определение порта, по умолчанию 3000

// Проверка наличия всех необходимых переменных окружения при запуске сервера
if (!process.env.SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.BOT_TOKEN) {
    console.error(ERROR_MESSAGES.ENV_VAR_MISSING);
    process.exit(1); // Завершение процесса, если переменные отсутствуют
}

// Middleware для парсинга JSON-тел запросов
app.use(express.json());
// Middleware для отдачи статических файлов (HTML, CSS, JS) из папки 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Middleware для общего логирования входящих запросов
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    // Если в запросе есть данные (тело запроса), выводим их
    if (req.body && Object.keys(req.body).length) {
        console.log('  Request data:', req.body);
    }
    next(); // Передача управления следующему middleware или обработчику
});

// Подключение маршрутов API
// Все маршруты, определенные в authRoutes и taskRoutes, будут доступны по префиксу '/api'
app.use('/api', authRoutes); // Маршруты для аутентификации
app.use('/api', taskRoutes); // Маршруты для работы с задачами

// --- НОВЫЙ БЛОК: ВОССТАНОВЛЕННЫЙ ЭНДПОИНТ ДЛЯ ЛОГОВ ---
/**
 * Маршрут для получения логов с клиентской стороны (из браузера).
 * Это полезно для отладки того, что происходит у пользователя.
 */
app.post('/api/log', (req, res) => {
    const { level = 'INFO', message, context } = req.body;
    console.log(`[CLIENT ${level}] ${message}`, context || '');
    // Отправляем статус 204 No Content, так как клиенту не нужен ответ
    res.sendStatus(204);
});
// ----------------------------------------------------

// Централизованный middleware для обработки ошибок
// Он будет перехватывать ошибки, выброшенные в обработчиках маршрутов или других middleware
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err); // Логируем необработанную ошибку
    // Отправляем ответ с статусом 500 и сообщением об ошибке
    res.status(500).json({ error: err.message || ERROR_MESSAGES.UNKNOWN_SERVER_ERROR });
});

// Запуск сервера на указанном порту
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});