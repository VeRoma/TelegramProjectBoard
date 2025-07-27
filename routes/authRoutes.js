// routes/authRoutes.js
const express = require('express');
const router = express.Router(); // Создаем новый роутер Express
// Импортируем сервисы для работы с Google Таблицами и Telegram
const googleSheetsService = require('../dataAccess/googleSheetsService');
const telegramService = require('../dataAccess/telegramService');
// Импортируем константы для сообщений об ошибках и названий колонок/ролей
const { ERROR_MESSAGES, TASK_COLUMNS, EMPLOYEE_ROLES } = require('../config/constants');

// Применяем middleware для загрузки данных о листах Google Таблицы ко всем маршрутам в этом роутере
router.use(googleSheetsService.loadSheetDataMiddleware);

// Маршрут для верификации пользователя
router.post('/verifyuser', async (req, res) => {
    const { user } = req.body; // Получаем объект пользователя из тела запроса (от Telegram WebApp)
    // Проверяем наличие объекта пользователя и его ID
    if (!user || !user.id) {
        return res.status(400).json({ error: ERROR_MESSAGES.USER_OBJECT_REQUIRED });
    }
    try {
        // Ищем пользователя в листе сотрудников по его UserID
        const userRow = await googleSheetsService.getEmployeeById(user.id);

        if (userRow) {
            // Если пользователь найден, логируем его доступ
            await googleSheetsService.logUserAccess(user);
            // Возвращаем статус 'authorized' и данные пользователя
            res.status(200).json({ status: 'authorized', name: userRow.get(TASK_COLUMNS.EMPLOYEE_NAME), role: userRow.get(TASK_COLUMNS.EMPLOYEE_ROLE) });
        }  else {
            // Если пользователь не найден, возвращаем статус 'unregistered'
            res.status(200).json({ status: 'unregistered' });
        }
    } catch (error) {
        console.error('Error verifying user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Маршрут для запроса на регистрацию
router.post('/requestregistration', async (req, res) => {
    const { name, userId } = req.body; // Получаем имя и UserID нового пользователя
    try {
        // Ищем владельца (owner) в листе сотрудников, чтобы отправить ему запрос
        const owner = await googleSheetsService.getOwnerEmployee();

        // Проверяем, найден ли владелец и есть ли у него UserID
        if (owner && owner.get(TASK_COLUMNS.USER_ID)) {
            const ownerId = owner.get(TASK_COLUMNS.USER_ID);
            // Отправляем запрос владельцу через Telegram
            await telegramService.sendRegistrationRequest(name, userId, ownerId);
            res.status(200).json({ status: 'request_sent' }); // Возвращаем успешный статус
        } else {
            // Если владелец не найден или у него нет UserID, выбрасываем ошибку
            throw new Error(ERROR_MESSAGES.OWNER_NOT_FOUND);
        }
    } catch (error) {
        console.error('Error sending registration request:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; // Экспортируем роутер для использования в server.js