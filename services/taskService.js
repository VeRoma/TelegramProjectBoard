const googleSheetsService = require('../dataAccess/googleSheetsService');
const { TASK_COLUMNS } = require('../config/constants');

/**
 * @description Собирает, фильтрует и обогащает все данные, необходимые для инициализации клиентского приложения.
 * @param {object} user - Объект пользователя, полученный от Telegram.
 * @returns {object} - Структурированный объект с данными для фронтенда.
 */
const getAppDataForUser = async (user) => {
    // 1. Параллельно загружаем все необходимые данные из Google Sheets
    const [
        allUsers, 
        allStatuses, 
        allStages, 
        allProjects, 
        allTasks, 
        activeProjectStages, 
        allTaskMembers
    ] = await Promise.all([
        googleSheetsService.getAllUsers(),
        googleSheetsService.getAllStatuses(),
        googleSheetsService.getAllStages(),
        googleSheetsService.getAllProjects(),
        googleSheetsService.getTasks(),
        googleSheetsService.getActiveProjectStages(),
        googleSheetsService.getAllTaskMembers() // <-- Логика для новой фичи уже здесь
    ]);
    
    // 2. Находим текущего пользователя в системе
    const currentUser = allUsers.find(u => u.tgUserId == user.id);
    if (!currentUser) {
        // Если пользователь не найден, возвращаем специальный статус
        return { status: 'unregistered' };
    }

    const { name: userName, role: userRole, userId: currentInternalUserId } = currentUser;
    
    // 3. Группируем участников задач для быстрого доступа (оптимизация)
    const taskMembersByTaskId = allTaskMembers.reduce((acc, member) => {
        if (!acc[member.taskId]) {
            acc[member.taskId] = [];
        }
        acc[member.taskId].push(member);
        return acc;
    }, {});

    // 4. Фильтруем проекты и задачи в зависимости от роли пользователя
    let filteredProjects = allProjects;
    let filteredTasks = allTasks;

    // Обычные пользователи видят только те проекты, в которых они участвуют
    if (userRole !== 'admin' && userRole !== 'owner') {
        const userProjectIds = await googleSheetsService.getProjectIdsByUserId(currentInternalUserId);
        const userProjectIdsSet = new Set(userProjectIds);
        
        filteredProjects = allProjects.filter(p => userProjectIdsSet.has(p.projectId));
        filteredTasks = allTasks.filter(task => userProjectIdsSet.has(task.get(TASK_COLUMNS.PROJECT_ID)));
    }
    
    // 5. Обогащаем каждую задачу дополнительной информацией
    const enrichedTasks = filteredTasks
        .filter(row => row.get(TASK_COLUMNS.NAME)) // Убираем задачи без названия
        .map(task => {
            const taskId = task.get(TASK_COLUMNS.TASK_ID);
            const projectId = task.get(TASK_COLUMNS.PROJECT_ID);
            const statusId = task.get(TASK_COLUMNS.STATUS_ID);
            const mainAssigneeId = task.get(TASK_COLUMNS.USER_ID);

            // Находим связанные сущности (проект, статус, куратор)
            const project = allProjects.find(p => p.projectId == projectId);
            const status = allStatuses.find(s => s.statusId == statusId);
            const curator = allUsers.find(u => u.userId === mainAssigneeId);

            // Собираем финальный объект задачи для клиента
            return {
                taskId: taskId,
                name: task.get(TASK_COLUMNS.NAME),
                status: status ? status.name : 'Неизвестный статус',
                statusId: statusId,
                curator: curator ? curator.name : 'Не назначен',
                curatorId: mainAssigneeId,
                project: project ? project.projectName : 'Без проекта',
                projectId: projectId,
                priority: parseInt(task.get(TASK_COLUMNS.PRIORITY), 10) || 1,
                version: parseInt(task.get(TASK_COLUMNS.VERSION) || 0, 10),
                stageId: task.get(TASK_COLUMNS.STAGE_ID),
                authorId: task.get(TASK_COLUMNS.AUTHOR_USER_ID),
                members: taskMembersByTaskId[taskId] || [] // <-- Прикрепляем участников
            };
        });

    // 6. Группируем задачи по проектам для удобного отображения на клиенте
    const groups = {};
    enrichedTasks.forEach(task => {
        const groupName = task.project;
        if (!groups[groupName]) {
            groups[groupName] = { name: groupName, tasks: [] };
        }
        groups[groupName].tasks.push(task);
    });
    
    // 7. Возвращаем полный пакет данных
    return { 
        status: 'registered', // Добавляем статус для клиента
        projects: Object.values(groups),
        allProjects: allProjects, 
        userName, 
        userRole,
        currentUserId: currentInternalUserId,
        allUsers: allUsers,
        allStatuses: allStatuses,
        allStages: allStages,
        activeProjectStages: activeProjectStages
    };
};

module.exports = {
    getAppDataForUser,
};