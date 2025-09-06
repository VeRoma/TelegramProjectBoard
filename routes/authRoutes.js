// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const googleSheetsService = require('../dataAccess/googleSheetsService');
const telegramService = require('../dataAccess/telegramService');
const { ERROR_MESSAGES, USER_COLUMNS } = require('../config/constants');

router.use(googleSheetsService.loadSheetDataMiddleware);

router.post('/verifyuser', async (req, res) => {
    try {
        // Решение: Переименовываем 'user' из запроса в 'telegramUser'
        const { user: telegramUser } = req.body; 
        if (!telegramUser || !telegramUser.id) {
            return res.status(400).json({ error: ERROR_MESSAGES.USER_OBJECT_REQUIRED });
        }
        
        // Теперь ищем пользователя в нашей системе, используя telegramUser.id
        const existingUser = await googleSheetsService.getUserById(telegramUser.id);

        if (existingUser) {
            // Логируем доступ, используя данные из Telegram
            await googleSheetsService.logUserAccess(telegramUser);
            
            // Отвечаем клиенту данными из нашей системы
            res.status(200).json({ 
                status: 'authorized', 
                name: existingUser.name, 
                role: existingUser.role 
            });
        } else {
            res.status(200).json({ status: 'unregistered' });
        }
    } catch (error) {
        console.error('Error verifying user:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/requestregistration', async (req, res) => {
    const { name, userId } = req.body;
    try {
        const owner = await googleSheetsService.getOwnerUser();
        
        if (owner && owner.tgUserId) {
            await telegramService.sendRegistrationRequest(name, userId, owner.tgUserId);
            res.status(200).json({ status: 'request_sent' });
        } else {
            throw new Error(ERROR_MESSAGES.OWNER_NOT_FOUND);
        }
    } catch (error) {
        console.error('Error sending registration request:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;