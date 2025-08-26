// public/js/ui/render.test.js

// Мокируем DOM-элементы
document.body.innerHTML = `
    <div id="app-header"></div>
    <div id="main-content"></div>
`;

// Импортируем нашу функцию
import { renderProjects } from './render.js';
// Импортируем store, чтобы "мокать" его функции
import * as store from '../store.js';

// Создаем "заглушку" для store
jest.mock('../store.js');

// Описываем набор тестов для renderProjects
describe('renderProjects sorting logic', () => {

    // Перед каждым тестом настраиваем мок для store.getAllStatuses
    beforeEach(() => {
        const mockStatuses = [
            { name: 'В работе',     icon: '🛠️', order: 1 },
            { name: 'К выполнению', icon: '📥', order: 2 },
            { name: 'На контроле',  icon: '🔍', order: 3 },
            { name: 'Отложено',     icon: '⏳', order: 4 },
            { name: 'Выполнено',    icon: '✔️', order: 5 }
        ];
        store.getAllStatuses.mockReturnValue(mockStatuses);
    });

    // Тест №1: Проверяем базовую сортировку по приоритету внутри одной группы
    test('должен правильно сортировать задачи по числовому приоритету', () => {
        const projects = [{
            name: 'Тестовый проект',
            tasks: [
                { taskId: 't2', name: 'Задача с P2', status: 'В работе', priority: 2 },
                { taskId: 't3', name: 'Задача с P13', status: 'В работе', priority: 13 },
                { taskId: 't1', name: 'Задача с P1', status: 'В работе', priority: 1 },
            ]
        }];

        renderProjects(projects, 'Admin', 'admin');

        const renderedTasks = document.querySelectorAll('.card .font-medium');
        const renderedTaskNames = Array.from(renderedTasks).map(el => el.textContent);
        
        // Проверяем, что порядок задач соответствует приоритету
        expect(renderedTaskNames).toEqual([
            'Задача с P1',
            'Задача с P2',
            'Задача с P13'
        ]);
    });

    // Тест №2: Проверяем сложную сортировку по статусу и приоритету
    test('должен сначала сортировать по порядку статуса, а затем по приоритету', () => {
        const projects = [{
            name: 'Тестовый проект',
            tasks: [
                { taskId: 't4', name: 'Задача "К выполнению" P2', status: 'К выполнению', priority: 2 },
                { taskId: 't2', name: 'Задача "В работе" P10', status: 'В работе', priority: 10 },
                { taskId: 't5', name: 'Задача "На контроле" P1', status: 'На контроле', priority: 1 },
                { taskId: 't1', name: 'Задача "В работе" P1', status: 'В работе', priority: 1 },
                { taskId: 't3', name: 'Задача "К выполнению" P1', status: 'К выполнению', priority: 1 },
            ]
        }];

        renderProjects(projects, 'Admin', 'admin');

        const renderedTasks = document.querySelectorAll('.card .font-medium');
        const renderedTaskNames = Array.from(renderedTasks).map(el => el.textContent);

        // Проверяем полный и точный порядок отсортированных задач
        expect(renderedTaskNames).toEqual([
            'Задача "В работе" P1',      // Статус "В работе" (order 1), priority 1
            'Задача "В работе" P10',     // Статус "В работе" (order 1), priority 10
            'Задача "К выполнению" P1',  // Статус "К выполнению" (order 2), priority 1
            'Задача "К выполнению" P2',  // Статус "К выполнению" (order 2), priority 2
            'Задача "На контроле" P1',   // Статус "На контроле" (order 3), priority 1
        ]);
    });
});
