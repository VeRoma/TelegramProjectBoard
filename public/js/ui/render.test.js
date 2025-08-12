// public/js/ui/render.test.js

// Мокируем (создаем заглушки) для DOM-элементов, так как в тестовой среде их нет
document.body.innerHTML = `
    <div id="app-header"></div>
    <div id="main-content"></div>
`;

// Импортируем нашу функцию и константы
import { renderProjects } from './render.js';
import { STATUSES } from '../data/statuses.js';

// Описываем набор тестов для renderProjects
describe('renderProjects sorting logic', () => {

    // Тест №1: Проверяем базовую сортировку по приоритету
    test('должен сортировать задачи по числовому приоритету', () => {
        const projects = [{
            name: 'Тестовый проект',
            tasks: [
                { name: 'Задача с P2', status: 'В работе', priority: 2 },
                { name: 'Задача с P13', status: 'В работе', priority: 13 },
                { name: 'Задача с P1', status: 'В работе', priority: 1 },
            ]
        }];

        // Вызываем нашу функцию
        renderProjects(projects, 'Admin', 'admin');

        // Проверяем результат
        const renderedTasks = document.querySelectorAll('.task-header .font-medium');
        expect(renderedTasks[0].textContent).toBe('Задача с P1');
        expect(renderedTasks[1].textContent).toBe('Задача с P2');
        expect(renderedTasks[2].textContent).toBe('Задача с P13');
    });

    // Тест №2: Проверяем сложную сортировку по статусу и приоритету
    test('должен сначала сортировать по статусу, затем по приоритету', () => {
        const projects = [{
            name: 'Тестовый проект',
            tasks: [
                { name: 'Задача "К выполнению" P2', status: 'К выполнению', priority: 2 },
                { name: 'Задача "В работе" P10', status: 'В работе', priority: 10 },
                { name: 'Задача "На контроле" P1', status: 'На контроле', priority: 1 },
                { name: 'Задача "В работе" P1', status: 'В работе', priority: 1 },
            ]
        }];

        renderProjects(projects, 'Admin', 'admin');

        const renderedTasks = document.querySelectorAll('.task-header .font-medium');
        // 'В работе' (order: 1) имеет высший приоритет
        expect(renderedTasks[0].textContent).toBe('Задача "В работе" P1');
        expect(renderedTasks[1].textContent).toBe('Задача "В работе" P10');
        // 'К выполнению' (order: 2) идет дальше
        expect(renderedTasks[2].textContent).toBe('Задача "К выполнению" P2');
        // 'На контроле' (order: 3) в конце
        expect(renderedTasks[3].textContent).toBe('Задача "На контроле" P1');
    });
});