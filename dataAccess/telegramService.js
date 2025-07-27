// dataAccess/telegramService.js
const TelegramBot = require('node-telegram-bot-api');
// Импорт констант для использования предопределенных сообщений
const { TELEGRAM_MESSAGES } = require('../config/constants');

// Инициализация Telegram бота с токеном из .env
// polling: false - означает, что бот не будет постоянно опрашивать сервер Telegram,
// а будет ждать вебхуков (запросов от Telegram)
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

// Функция для отправки запроса на регистрацию владельцу бота
const sendRegistrationRequest = async (name, userId, ownerId) => {
    // Формируем сообщение, используя шаблон из констант
    const message = TELEGRAM_MESSAGES.REGISTRATION_REQUEST(name, userId);
    // Отправляем сообщение владельцу
    await bot.sendMessage(ownerId, message, { parse_mode: 'Markdown' }); // parse_mode для форматирования текста
};

// Функция для отправки уведомлений о новых задачах
const sendNewTaskNotification = async (userId, taskName, isHighPriority) => {
    // Выбираем шаблон сообщения в зависимости от приоритета задачи
    const message = isHighPriority ? TELEGRAM_MESSAGES.NEW_TASK_HIGH_PRIORITY(taskName) : TELEGRAM_MESSAGES.NEW_TASK(taskName);
    // Отправляем сообщение пользователю, перехватываем возможные ошибки отправки
    await bot.sendMessage(userId, message).catch(err => console.error(`Failed to send message to ${userId}:`, err));
};

// Экспортируем функции для использования в других модулях
module.exports = {
    sendRegistrationRequest,
    sendNewTaskNotification
};