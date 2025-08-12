// public/js/handlers.test.js

// Импортируем тестируемую функцию
import { handleSaveActiveTask } from './handlers.js';
// Импортируем зависимости, которые нужно будет "замокать" (подменить)
import * as api from './api.js';
import * as store from './store.js';
import * as uiUtils from './ui/utils.js';

// --- Создаем "заглушки" для всех внешних зависимостей ---
jest.mock('./api.js');
jest.mock('./store.js');
jest.mock('./ui/utils.js');
jest.mock('./ui/render.js');

// --- НОВЫЙ БЛОК: Имитируем объект Telegram Web App ---
beforeAll(() => {
    global.window = {
        Telegram: {
            WebApp: {
                // Добавляем пустые функции-заглушки для методов, которые вызываются в коде
                showAlert: jest.fn(),
                HapticFeedback: {
                    notificationOccurred: jest.fn(),
                },
            },
        },
    };
});
// ----------------------------------------------------

// Описываем наш набор тестов
describe('handleSaveActiveTask', () => {

    // Перед каждым тестом будем очищать все "заглушки" и готовить DOM
    beforeEach(() => {
        jest.clearAllMocks();
        
        document.body.innerHTML = `
            <div id="main-content">
                <div id="task-details-79" class="task-details edit-mode" data-version="1" data-task='{"rowIndex":79,"name":"Тестовая задача","project":"Старый Проект","responsible":"Роман"}'>
                    <input type="hidden" class="task-row-index" value="79">
                    <input type="text" class="task-name-edit" value="Новое название">
                    <textarea class="task-message-edit">Новое сообщение</textarea>
                    <p class="task-status-view">В работе</p>
                    <p class="task-project-view">Новый Проект</p>
                    <p class="task-responsible-view">Александра, Максим</p>
                </div>
            </div>
            <button id="fab-button"></button>
        `;
    });

    // --- НАШ ГЛАВНЫЙ ТЕСТ ---
    test('должна считывать и сохранять измененные "Проект" и "Ответственный"', async () => {
        // 1. ГОТОВИМ ДАННЫЕ (Arrange)

        store.getAppData.mockReturnValue({
            userName: 'Admin',
            userRole: 'admin',
            projects: [{
                name: 'Старый Проект',
                tasks: [{
                    rowIndex: 79,
                    name: 'Тестовая задача',
                    project: 'Старый Проект',
                    responsible: 'Роман',
                    version: 1
                }]
            }]
        });

        store.findTask.mockReturnValue({
            task: {
                rowIndex: 79,
                name: 'Тестовая задача',
                project: 'Старый Проект',
                responsible: 'Роман',
                version: 1
            },
            project: { name: 'Старый Проект', tasks: [/* ... */] }
        });

        api.saveTask.mockResolvedValue({ status: 'success', newVersion: 2 });
        
        // 2. ВЫПОЛНЯЕМ ДЕЙСТВИЕ (Act)
        await handleSaveActiveTask();

        // 3. ПРОВЕРЯЕМ РЕЗУЛЬТАТ (Assert)
        expect(api.saveTask).toHaveBeenCalled();

        const sentData = api.saveTask.mock.calls[0][0].taskData;

        expect(sentData.project).toBe('Новый Проект');
        expect(sentData.responsible).toEqual(['Александра', 'Максим']);
    });
});