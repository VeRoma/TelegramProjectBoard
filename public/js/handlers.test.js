// public/js/handlers.test.js

import { handleSaveActiveTask } from './handlers.js';
import * as api from './api.js';
import * as store from './store.js';
import * as uiUtils from './ui/utils.js';
import * as render from './ui/render.js';

// --- Создаем "заглушки" для всех внешних зависимостей ---
jest.mock('./api.js');
jest.mock('./store.js');
jest.mock('./ui/utils.js');
jest.mock('./ui/render.js');

// --- Имитируем объект Telegram Web App ---
beforeAll(() => {
    global.window = {
        Telegram: {
            WebApp: {
                // Используем jest.fn() для отслеживания вызовов
                showAlert: jest.fn(),
                HapticFeedback: {
                    notificationOccurred: jest.fn(),
                },
            },
        },
    };
});

// --- Описываем наш набор тестов ---
describe('handleSaveActiveTask', () => {    

    // Перед каждым тестом будем очищать все "заглушки" и готовить DOM
    beforeEach(() => {
        jest.clearAllMocks();
        
       
        const taskId = 'task-79';
        const initialTaskData = {
            taskId: taskId,
            name: 'Старое название',
            project: 'Старый Проект',
            responsible: 'Роман',
            status: 'К выполнению',
            message: 'Старое сообщение',
            version: 1
        };

        document.body.innerHTML = `
            <div id="main-content">
                <div class="card" data-task-id="${taskId}">
                    <div id="task-details-${taskId}" class="task-details edit-mode" data-version="1" data-task='${JSON.stringify(initialTaskData)}'>
                        <input type="text" class="task-name-edit" value="Новое название">
                        <textarea class="task-message-edit">Новое сообщение</textarea>
                        <p class="task-status-view">В работе</p>
                        <p class="task-project-view">Новый Проект</p>
                        <p class="task-responsible-view">Александра, Максим</p>
                    </div>
                </div>
            </div>
            <button id="fab-button"></button>
        `;
    });

    // --- НАШ ГЛАВНЫЙ ТЕСТ ---
    test('должна корректно считывать все измененные поля и отправлять их на сервер', async () => {
        // 1. ГОТОВИМ ДАННЫЕ (Arrange)
        const taskId = 'task-79';
        const mockTaskInStore = {
            taskId: taskId,
            name: 'Старое название',
            project: 'Старый Проект',
            responsible: 'Роман',
            status: 'К выполнению',
            message: 'Старое сообщение',
            version: 1
        };

        store.getAppData.mockReturnValue({ userName: 'Admin' });
        store.findTask.mockReturnValue({ task: mockTaskInStore });
        api.saveTask.mockResolvedValue({ status: 'success', newVersion: 2 });
        
        // 2. ВЫПОЛНЯЕМ ДЕЙСТВИЕ (Act)
        await handleSaveActiveTask();

        // 3. ПРОВЕРЯЕМ РЕЗУЛЬТАТ (Assert)

        // Убеждаемся, что функция сохранения была вызвана ровно один раз
        expect(api.saveTask).toHaveBeenCalledTimes(1);

        // Получаем данные, которые были отправлены в api.saveTask
        const sentPayload = api.saveTask.mock.calls[0][0];
        const sentTaskData = sentPayload.taskData;

        // Проверяем, что имя модификатора передано правильно
        expect(sentPayload.modifierName).toBe('Admin');

        // Проверяем каждое поле в отправленных данных
        expect(sentTaskData.taskId).toBe(taskId);
        expect(sentTaskData.name).toBe('Новое название');
        expect(sentTaskData.message).toBe('Новое сообщение');
        expect(sentTaskData.status).toBe('В работе');
        expect(sentTaskData.project).toBe('Новый Проект');
        expect(sentTaskData.responsible).toEqual(['Александра', 'Максим']);
        expect(sentTaskData.version).toBe(1); // Отправляем старую версию для проверки на сервере

        // Проверяем, что после успешного сохранения были вызваны UI-функции
        expect(uiUtils.showMessage).toHaveBeenCalledWith('Изменения сохранены', 'success');
        expect(uiUtils.exitEditMode).toHaveBeenCalled();
        expect(render.renderProjects).toHaveBeenCalled();
    });
});
