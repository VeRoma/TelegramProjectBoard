// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const googleSheetsService = require('../dataAccess/googleSheetsService');
const telegramService = require('../dataAccess/telegramService');
const { ERROR_MESSAGES, USER_COLUMNS } = require('../config/constants');

router.use(googleSheetsService.loadSheetDataMiddleware);

router.post('/verifyuser', async (req, res) => {
    const { user } = req.body;
    if (!user || !user.id) {
        return res.status(400).json({ error: ERROR_MESSAGES.USER_OBJECT_REQUIRED });
    }
    try {
        // Ищем пользователя в листе 'Users' по его TGUserID
        const employee = await googleSheetsService.getEmployeeById(user.id);

        if (employee) {
            // await googleSheetsService.logUserAccess(user); // Пока закомментируем, чтобы не вызывать ошибку
            
            // `employee` - это уже готовый JS-объект
            res.status(200).json({ 
                status: 'authorized', 
                name: employee.name, 
                role: employee.role 
            });
        }  else {
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
        const owner = await googleSheetsService.getOwnerEmployee();
        
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