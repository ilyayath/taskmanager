import { getTasks, getTask, createTask, updateTask, deleteTask, getUsers, getCategories, getTags, createComment, createNote } from './api.js';
import { renderComments } from './comments.js';
import { renderNotes } from './notes.js';
import { navigate } from './router.js';
import { getCurrentUserRole } from './auth.js';

console.log('tasks.js завантажено, експорти включають renderTaskForm');

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// Функція для обчислення статистики
async function calculateTaskStats() {
    try {
        console.log('Обчислення статистики завдань');
        const role = getCurrentUserRole();
        const user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
        const userId = user?.id || null;
        console.log('Роль:', role, 'User ID:', userId);

        // Отримуємо всі завдання
        const response = await getTasks(1, 1000); // Великий pageSize для всіх завдань
        console.log('Відповідь getTasks для статистики:', response);

        if (!response || typeof response !== 'object' || !Array.isArray(response.tasks)) {
            throw new Error('Невалідна відповідь від API або tasks не є масивом');
        }

        let tasks = response.tasks;

        // Фільтрація для Worker
        if (role === 'Worker' && userId) {
            tasks = tasks.filter(t => t.userId === userId);
            console.log('Відфільтровано завдання для Worker:', tasks.length);
        }

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.isCompleted).length;
        const notCompletedTasks = totalTasks - completedTasks;
        const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;
        const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !t.isCompleted).length;

        const priorityStats = {
            High: tasks.filter(t => t.priority === 'High').length,
            Medium: tasks.filter(t => t.priority === 'Medium').length,
            Low: tasks.filter(t => t.priority === 'Low').length
        };

        console.log('Розраховано статистику:', { totalTasks, completedTasks, notCompletedTasks, completionRate, overdueTasks, priorityStats });

        return {
            totalTasks,
            completedTasks,
            notCompletedTasks,
            completionRate,
            overdueTasks,
            priorityStats
        };
    } catch (err) {
        console.error('Помилка обчислення статистики:', err);
        return null;
    }
}

export async function renderTasks(page = 1, filter = 'not-completed', priorityFilter = '', userFilter = '', sortBy = 'dueDate') {
    const app = document.getElementById('app');
    if (!app) {
        console.error('Контейнер #app не знайдено в DOM');
        return;
    }

    const role = getCurrentUserRole();
    console.log('Відображення завдань, роль користувача:', role, 'localStorage:', localStorage.getItem('user'));

    if (!role) {
        console.warn('Роль не визначена, перенаправлення на логін');
        navigate('/login');
        return;
    }

    // Отримуємо статистику
    console.log('Виклик calculateTaskStats для статистики');
    const stats = await calculateTaskStats();
    let statsHtml = '';
    if (stats) {
        statsHtml = `
            <div class="stats">
                <h3>Статистика завдань</h3>
                <p><strong>Всього завдань:</strong> ${stats.totalTasks}</p>
                <p><strong>Виконано:</strong> ${stats.completedTasks}</p>
                <p><strong>Не виконано:</strong> ${stats.notCompletedTasks}</p>
                <p><strong>Прострочені:</strong> ${stats.overdueTasks}</p>
                <p><strong>Відсоток виконання:</strong> ${stats.completionRate}%</p>
                <p><strong>Пріоритети:</strong></p>
                <ul>
                    <li>Високий: ${stats.priorityStats.High}</li>
                    <li>Середній: ${stats.priorityStats.Medium}</li>
                    <li>Низький: ${stats.priorityStats.Low}</li>
                </ul>
                <canvas id="task-stats-chart" style="max-width: 300px; margin: 20px auto;"></canvas>
            </div>
        `;
    } else {
        statsHtml = `<p class="error">Не вдалося завантажити статистику. Перевірте API або консоль для деталей.</p>`;
    }

    const pageSize = 10;
    let createTaskForm = '';
    let createTaskButton = '';
    let users = [];
    let userMap = {};

    if (role === 'Manager') {
        try {
            users = await getUsers();
            console.log('Users fetched for createTaskForm:', users.map(u => ({ id: u.id, email: u.email, name: u.name })));
            const availableWorkers = users;
            console.log('Available workers:', availableWorkers);

            users.forEach(u => {
                userMap[u.id] = u.email || u.name || `Користувач ${u.id}`;
            });

            createTaskButton = `
                <button id="toggle-create-task" class="action-btn primary-btn">
                    <i class="fas fa-plus"></i> Створити Завдання
                </button>
            `;

            createTaskForm = availableWorkers.length > 0 ? `
                <div id="create-task-form-container" style="display: none;">
                    <h3>Створити Нове Завдання</h3>
                    <form id="create-task-form" class="create-task">
                        <div>
                            <label><i class="fas fa-heading"></i> Назва</label>
                            <input type="text" id="task-title" required placeholder="Введіть назву завдання">
                        </div>
                        <div>
                            <label><i class="fas fa-user"></i> Призначити Виконавцю</label>
                            <select id="assigned-user">
                                <option value="">Без виконавця</option>
                                ${availableWorkers.map(u => {
                const displayText = u.email || u.name || `Користувач ${u.id}`;
                console.log('Rendering user option:', { id: u.id, email: u.email, name: u.name, displayText });
                return `<option value="${u.id}">${escapeHtml(displayText)}</option>`;
            }).join('')}
                            </select>
                        </div>
                        <div>
                            <label><i class="fas fa-calendar-alt"></i> Термін Виконання</label>
                            <input type="date" id="task-due-date" required>
                        </div>
                        <div>
                            <label><i class="fas fa-exclamation-circle"></i> Пріоритет</label>
                            <select id="task-priority" required>
                                <option value="High">Високий</option>
                                <option value="Medium" selected>Середній</option>
                                <option value="Low">Низький</option>
                            </select>
                        </div>
                        <button type="submit" class="action-btn primary-btn" id="create-task-btn">
                            <i class="fas fa-plus"></i> Створити
                        </button>
                        <p class="error" id="create-task-error"></p>
                        <div class="loader hidden" id="create-task-loader">
                            <div class="spinner"></div>
                        </div>
                    </form>
                </div>
            ` : `
                <div id="create-task-form-container" style="display: none;">
                    <p class="error">Немає доступних користувачів для призначення. Перевірте базу даних.</p>
                </div>
            `;
        } catch (err) {
            console.error('Помилка завантаження користувачів для форми:', err);
            createTaskForm = `
                <div id="create-task-form-container" style="display: none;">
                    <p class="error">Не вдалося завантажити дані для форми: ${err.message}</p>
                </div>
            `;
        }
    }

    const overdueNotice = stats && stats.overdueTasks > 0 ? `
        <div class="overdue-notice">
            <p><strong>Увага!</strong> У вас ${stats.overdueTasks} прострочених завдань.</p>
        </div>
    ` : '';

    const filterForm = `
        <div class="filter-form">
            <select id="filter-priority">
                <option value="">Усі пріоритети</option>
                <option value="High" ${priorityFilter === 'High' ? 'selected' : ''}>Високий</option>
                <option value="Medium" ${priorityFilter === 'Medium' ? 'selected' : ''}>Середній</option>
                <option value="Low" ${priorityFilter === 'Low' ? 'selected' : ''}>Низький</option>
            </select>
            <select id="filter-user">
                <option value="">Усі виконавці</option>
                ${users.map(u => `
                    <option value="${u.id}" ${userFilter === u.id.toString() ? 'selected' : ''}>${escapeHtml(u.email || u.name || `Користувач ${u.id}`)}</option>
                `).join('')}
            </select>
            <select id="sort-by">
                <option value="dueDate" ${sortBy === 'dueDate' ? 'selected' : ''}>За терміном</option>
                <option value="priority" ${sortBy === 'priority' ? 'selected' : ''}>За пріоритетом</option>
            </select>
            <button id="apply-filter" class="action-btn"><i class="fas fa-filter"></i> Фільтрувати</button>
        </div>
    `;

    app.innerHTML = `
        <div class="card">
            <h2>Завдання</h2>
            ${overdueNotice}
            ${filterForm}
            ${statsHtml}
            <div class="task-tabs">
                <button class="tab-btn ${filter === 'not-completed' ? 'active' : ''}" data-filter="not-completed">Не Виконані</button>
                <button class="tab-btn ${filter === 'completed' ? 'active' : ''}" data-filter="completed">Виконані</button>
            </div>
            ${createTaskButton}
            ${createTaskForm}
            <table class="task-table">
                <thead>
                    <tr>
                        <th>Назва</th>
                        <th>Термін</th>
                        <th>Пріоритет</th>
                        <th>Прогрес</th>
                        <th>Виконавець</th>
                        <th>Дії</th>
                    </tr>
                </thead>
                <tbody id="task-list"></tbody>
            </table>
            <div class="pagination">
                <button id="prev-page" disabled><i class="fas fa-chevron-left"></i> Попередня</button>
                <span id="page-info"></span>
                <button id="next-page"><i class="fas fa-chevron-right"></i> Наступна</button>
            </div>
            <p class="error" id="task-error"></p>
        </div>
    `;

    async function loadTasks() {
        try {
            console.log('Завантаження завдань для сторінки:', page, 'розмір сторінки:', pageSize);
            const response = await getTasks(page, pageSize);
            console.log('Відповідь getTasks:', response);

            if (!response || typeof response !== 'object') {
                throw new Error('Невалідна відповідь від API');
            }

            let { tasks = [], total = 0, page: currentPage = 1 } = response;
            if (!Array.isArray(tasks)) {
                throw new Error('Завдання не є масивом');
            }

            // Фільтрація за статусом
            tasks = tasks.filter(task => filter === 'completed' ? task.isCompleted : !task.isCompleted);

            // Фільтрація за пріоритетом
            if (priorityFilter) {
                tasks = tasks.filter(task => task.priority === priorityFilter);
            }

            // Фільтрація за виконавцем
            if (userFilter) {
                tasks = tasks.filter(task => task.userId === parseInt(userFilter));
            }

            // Сортування
            if (sortBy === 'dueDate') {
                tasks.sort((a, b) => new Date(a.dueDate || '9999-12-31') - new Date(b.dueDate || '9999-12-31'));
            } else if (sortBy === 'priority') {
                const priorityOrder = { High: 1, Medium: 2, Low: 3 };
                tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
            }

            const userIds = [...new Set(tasks.map(t => t.userId).filter(id => id))];
            if (userIds.length > 0 && Object.keys(userMap).length === 0) {
                users = await getUsers();
                console.log('Завантажені користувачі:', users);
                userMap = Object.fromEntries(users.map(u => [u.id, u.email || u.name || `Користувач ${u.id}`]));
            }

            const tbody = document.getElementById('task-list');
            const now = new Date();
            tbody.innerHTML = tasks.length > 0
                ? tasks.map(task => {
                    const isOverdue = task.dueDate && new Date(task.dueDate) < now && !task.isCompleted;
                    return `
                        <tr class="${isOverdue ? 'overdue' : ''}">
                            <td><a href="#/task/${task.id}">${escapeHtml(task.title) || 'Без назви'}</a></td>
                            <td>${task.dueDate ? new Date(task.dueDate).toLocaleDateString('uk-UA') : 'Н/Д'}</td>
                            <td>${escapeHtml(task.priority) || 'Н/Д'}</td>
                            <td>${task.progress != null ? task.progress + '%' : '0%'}</td>
                            <td>${task.userId ? escapeHtml(userMap[task.userId]) || 'Невідомий' : 'Не призначено'}</td>
                            <td>
                                <button data-id="${task.id}" class="action-btn details-btn" title="Деталі"><i class="fas fa-info-circle"></i></button>
                                <button data-id="${task.id}" class="action-btn edit-btn" title="Редагувати"><i class="fas fa-edit"></i></button>
                                <button data-id="${task.id}" class="action-btn done-btn ${task.isCompleted ? 'disabled' : ''}" title="Виконано"><i class="fas fa-check"></i></button>
                                ${role === 'Manager' ? `
                                    <button data-id="${task.id}" class="action-btn delete-btn" title="Видалити"><i class="fas fa-trash"></i></button>
                                ` : ''}
                            </td>
                        </tr>
                    `;
                }).join('')
                : '<tr><td colspan="6">Завдання відсутні</td></tr>';

            document.getElementById('page-info').textContent = `Сторінка ${currentPage} з ${Math.ceil(total / pageSize) || 1}`;
            document.getElementById('prev-page').disabled = currentPage <= 1;
            document.getElementById('next-page').disabled = currentPage >= Math.ceil(total / pageSize);

            // Оновлення діаграми
            try {
                const ctx = document.getElementById('task-stats-chart').getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Всього', 'Виконані', 'Не виконані', 'Прострочені'],
                        datasets: [{
                            label: 'Статистика завдань',
                            data: [stats.totalTasks, stats.completedTasks, stats.notCompletedTasks, stats.overdueTasks],
                            backgroundColor: [
                                'rgba(0, 123, 255, 0.5)',
                                'rgba(40, 167, 69, 0.5)',
                                'rgba(255, 206, 86, 0.5)',
                                'rgba(220, 53, 69, 0.5)'
                            ],
                            borderColor: [
                                'rgba(0, 123, 255, 1)',
                                'rgba(40, 167, 69, 1)',
                                'rgba(255, 206, 86, 1)',
                                'rgba(220, 53, 69, 1)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Кількість завдань',
                                    color: document.body.classList.contains('dark') ? '#e0e0e0' : '#333333'
                                },
                                ticks: {
                                    color: document.body.classList.contains('dark') ? '#e0e0e0' : '#333333'
                                }
                            },
                            x: {
                                ticks: {
                                    color: document.body.classList.contains('dark') ? '#e0e0e0' : '#333333'
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                labels: {
                                    color: document.body.classList.contains('dark') ? '#e0e0e0' : '#333333'
                                }
                            }
                        }
                    }
                });
            } catch (err) {
                console.error('Помилка створення діаграми:', err);
            }
        } catch (err) {
            console.error('Помилка завантаження завдань:', err);
            document.getElementById('task-error').textContent = `Не вдалося завантажити завдання: ${err.message}`;
            if (err.message.includes('401') || err.message.includes('403')) {
                navigate('/login');
            }
        }
    }

    await loadTasks();

    const toggleButton = document.getElementById('toggle-create-task');
    const formContainer = document.getElementById('create-task-form-container');
    const form = document.getElementById('create-task-form');
    const errorElement = document.getElementById('create-task-error');
    const submitButton = document.getElementById('create-task-btn');
    const loader = document.getElementById('create-task-loader');

    if (toggleButton && formContainer) {
        toggleButton.addEventListener('click', () => {
            formContainer.style.display = formContainer.style.display === 'none' ? 'block' : 'none';
            if (errorElement) errorElement.textContent = '';
            console.log('Форма переключена, display:', formContainer.style.display);
        });
    }

    if (form && submitButton && errorElement && loader) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorElement.textContent = '';

            const title = document.getElementById('task-title').value.trim();
            const userId = role === 'Manager' ? document.getElementById('assigned-user')?.value : null;
            const dueDate = document.getElementById('task-due-date').value;
            const priority = document.getElementById('task-priority').value;

            if (!title) {
                errorElement.textContent = 'Введіть назву завдання';
                return;
            }
            if (!dueDate) {
                errorElement.textContent = 'Вкажіть термін виконання';
                return;
            }
            if (!priority) {
                errorElement.textContent = 'Оберіть пріоритет';
                return;
            }

            const taskData = {
                title,
                userId: userId || null,
                dueDate: new Date(dueDate).toISOString(),
                priority,
                progress: 0,
                isCompleted: false
            };

            try {
                console.log('Відправка завдання:', taskData);
                submitButton.disabled = true;
                loader.classList.remove('hidden');
                await createTask(taskData);
                form.reset();
                formContainer.style.display = 'none';
                await loadTasks();
            } catch (err) {
                console.error('Помилка створення завдання:', err);
                errorElement.textContent = `Помилка: ${err.message}`;
                if (err.message.includes('401') || err.message.includes('403')) {
                    navigate('/login');
                }
            } finally {
                submitButton.disabled = false;
                loader.classList.add('hidden');
            }
        });
    }

    document.getElementById('apply-filter')?.addEventListener('click', () => {
        const priority = document.getElementById('filter-priority').value;
        const userId = document.getElementById('filter-user').value;
        const sort = document.getElementById('sort-by').value;
        renderTasks(page, filter, priority, userId, sort);
    });

    document.getElementById('prev-page').addEventListener('click', () => {
        if (page > 1) {
            page--;
            loadTasks();
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        page++;
        loadTasks();
    });

    document.getElementById('task-list').addEventListener('click', async (e) => {
        if (e.target.closest('.details-btn')) {
            const id = e.target.closest('.details-btn').dataset.id;
            navigate(`/task/${id}`);
        } else if (e.target.closest('.edit-btn')) {
            const id = e.target.closest('.edit-btn').dataset.id;
            navigate(`/task/edit/${id}`);
        } else if (e.target.closest('.done-btn')) {
            const id = parseInt(e.target.closest('.done-btn').dataset.id);
            try {
                await markTaskDone(id);
                await loadTasks();
            } catch (err) {
                console.error('Помилка позначення завдання:', err);
                document.getElementById('task-error').textContent = `Помилка: ${err.message}`;
            }
        } else if (e.target.closest('.delete-btn')) {
            if (confirm('Ви впевнені, що хочете видалити завдання?')) {
                const id = e.target.closest('.delete-btn').dataset.id;
                try {
                    await deleteTask(id);
                    await loadTasks();
                } catch (err) {
                    console.error('Помилка видалення завдання:', err);
                    document.getElementById('task-error').textContent = `Помилка: ${err.message}`;
                }
            }
        }
    });

    document.querySelectorAll('.task-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const newFilter = btn.dataset.filter;
            renderTasks(1, newFilter, priorityFilter, userFilter, sortBy);
        });
    });
}

async function markTaskDone(id) {
    const taskData = await getTask(id);
    await updateTask(id, { ...taskData, isCompleted: true, progress: 100 });
}

export async function renderTaskForm(taskId) {
    const app = document.getElementById('app');
    if (!app) {
        console.error('Контейнер #app не знайдено');
        return;
    }

    if (taskId && isNaN(parseInt(taskId))) {
        app.innerHTML = '<p class="error">Некоректний ID завдання</p>';
        return;
    }

    const role = getCurrentUserRole();
    if (!role) {
        navigate('/login');
        return;
    }

    let task = {};
    if (taskId) {
        try {
            task = await getTask(taskId);
            console.log('Завантажено завдання для редагування:', task);
        } catch (err) {
            console.error('Помилка завантаження завдання:', err);
            app.innerHTML = `<p class="error">Не вдалося завантажити завдання: ${err.message}</p>`;
            return;
        }
    }

    let users = [];
    let categories = [];
    let tags = [];
    if (role === 'Manager') {
        try {
            users = await getUsers();
            console.log('Завантажені користувачі для форми редагування:', users.map(u => ({ id: u.id, email: u.email, name: u.name })));
            categories = await getCategories();
            tags = await getTags();
        } catch (err) {
            console.error('Помилка завантаження даних для форми:', err);
            app.innerHTML = `<p class="error">Помилка: ${err.message}</p>`;
            return;
        }
    }

    const availableWorkers = users;
    console.log('Доступні виконавці:', availableWorkers.map(u => ({ id: u.id, email: u.email, name: u.name })));
    if (role === 'Manager' && availableWorkers.length === 0) {
        console.warn('Немає доступних користувачів для редагування.');
    }

    const isEdit = !!taskId;
    const today = new Date().toISOString().split('T')[0];

    app.innerHTML = `
        <div class="card">
            <h2>${isEdit ? 'Редагувати Завдання' : 'Створити Завдання'}</h2>
            <form id="task-form">
                <div>
                    <label><i class="fas fa-heading"></i> Назва</label>
                    <input type="text" id="title" value="${escapeHtml(task.title) || ''}" required ${role === 'Worker' && isEdit ? 'disabled' : ''} placeholder="Введіть назву">
                </div>
                ${role === 'Manager' && availableWorkers.length > 0 ? `
                    <div>
                        <label><i class="fas fa-user"></i> Призначити Виконавцю</label>
                        <select id="assigned-user">
                            <option value="">Без виконавця</option>
                            ${availableWorkers.map(u => {
        const displayText = u.email || u.name || `Користувач ${u.id}`;
        console.log('Rendering user option:', { id: u.id, email: u.email, name: u.name, displayText });
        return `<option value="${u.id}" ${task.userId === u.id ? 'selected' : ''}>${escapeHtml(displayText)}</option>`;
    }).join('')}
                        </select>
                    </div>
                ` : role === 'Manager' ? `
                    <div>
                        <p class="error">Немає доступних користувачів</p>
                    </div>
                ` : ''}
                <div>
                    <label><i class="fas fa-calendar-alt"></i> Термін Виконання</label>
                    <input type="date" id="dueDate" value="${task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : today}" required ${role === 'Worker' && isEdit ? 'disabled' : ''}>
                </div>
                <div>
                    <label><i class="fas fa-exclamation-circle"></i> Пріоритет</label>
                    <select id="priority" required ${role === 'Worker' && isEdit ? 'disabled' : ''}>
                        <option value="High" ${task.priority === 'High' ? 'selected' : ''}>Високий</option>
                        <option value="Medium" ${task.priority === 'Medium' ? 'selected' : ''}>Середній</option>
                        <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>Низький</option>
                    </select>
                </div>
                <div>
                    <label><i class="fas fa-tasks"></i> Прогрес (%)</label>
                    <input type="number" id="progress" min="0" max="100" value="${task.progress || 0}" required ${role === 'Manager' && isEdit ? 'disabled' : ''} placeholder="0-100">
                </div>
                ${role === 'Manager' ? `
                    <div>
                        <label><i class="fas fa-folder"></i> Категорія</label>
                        <select id="category">
                            <option value="" ${!task.categoryId ? 'selected' : ''}>Без категорії</option>
                            ${categories.map(c => `
                                <option value="${c.id}" ${task.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div>
                        <label><i class="fas fa-tags"></i> Теги</label>
                        <select id="tags" multiple>
                            ${tags.map(t => `
                                <option value="${t.id}" ${task.tagIds?.includes(t.id) ? 'selected' : ''}>${escapeHtml(t.name)}</option>
                            `).join('')}
                        </select>
                    </div>
                ` : ''}
                <button type="submit" class="action-btn primary-btn" id="save-task-btn">
                    <i class="fas fa-save"></i> Зберегти
                </button>
                <button type="button" class="action-btn" id="cancel-btn">
                    <i class="fas fa-times"></i> Скасувати
                </button>
                <p class="error" id="task-error"></p>
                <div class="loader hidden" id="task-loader">
                    <div class="spinner"></div>
                </div>
            </form>
        </div>
    `;

    const form = document.getElementById('task-form');
    const errorElement = document.getElementById('task-error');
    const submitButton = document.getElementById('save-task-btn');
    const cancelButton = document.getElementById('cancel-btn');
    const loader = document.getElementById('task-loader');

    if (form && submitButton && errorElement && cancelButton && loader) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorElement.textContent = '';

            const title = document.getElementById('title').value.trim();
            const userId = role === 'Manager' ? document.getElementById('assigned-user')?.value : task.userId;
            const dueDate = document.getElementById('dueDate').value;
            const priority = document.getElementById('priority').value;
            const progress = parseInt(document.getElementById('progress').value) || 0;
            const categoryId = role === 'Manager' ? document.getElementById('category')?.value : task.categoryId;
            const tagIds = role === 'Manager' ? Array.from(document.getElementById('tags')?.selectedOptions || []).map(o => parseInt(o.value)) : task.tagIds;

            if (!title) {
                errorElement.textContent = 'Введіть назву завдання';
                return;
            }
            if (!dueDate) {
                errorElement.textContent = 'Вкажіть термін виконання';
                return;
            }
            if (!priority) {
                errorElement.textContent = 'Оберіть пріоритет';
                return;
            }
            if (isNaN(progress) || progress < 0 || progress > 100) {
                errorElement.textContent = 'Прогрес має бути числом від 0 до 100';
                return;
            }

            const taskData = {
                id: parseInt(taskId) || 0,
                title,
                userId: userId || null,
                dueDate: new Date(dueDate).toISOString(),
                priority,
                progress,
                isCompleted: progress === 100,
                categoryId: categoryId ? parseInt(categoryId) : null,
                tagIds: tagIds || []
            };

            try {
                console.log('Відправка даних завдання:', taskData);
                submitButton.disabled = true;
                loader.classList.remove('hidden');
                if (isEdit) {
                    await updateTask(taskId, taskData);
                } else {
                    await createTask(taskData);
                }
                navigate('/');
            } catch (err) {
                console.error('Помилка збереження завдання:', err);
                errorElement.textContent = `Помилка: ${err.message}`;
                if (err.message.includes('401') || err.message.includes('403')) {
                    navigate('/login');
                }
            } finally {
                submitButton.disabled = false;
                loader.classList.add('hidden');
            }
        });

        cancelButton.addEventListener('click', () => {
            navigate('/');
        });
    }
}

export async function renderTaskDetail(taskId) {
    const app = document.getElementById('app');
    if (!app) {
        console.error('Контейнер #app не знайдено');
        return;
    }

    if (taskId && isNaN(parseInt(taskId))) {
        app.innerHTML = '<p class="error">Некоректний ID завдання</p>';
        return;
    }

    const role = getCurrentUserRole();
    if (!role) {
        navigate('/login');
        return;
    }

    let task;
    try {
        task = await getTask(taskId);
        console.log('Завантажено деталі завдання:', task);
    } catch (err) {
        console.error('Помилка завантаження деталей завдання:', err);
        app.innerHTML = `<p class="error">Не вдалося завантажити завдання: ${err.message}</p>`;
        return;
    }

    let userEmail = 'Не призначено';
    if (task.userId) {
        try {
            const users = await getUsers();
            const user = users.find(u => u.id === task.userId);
            userEmail = user ? escapeHtml(user.email) : 'Невідомий';
        } catch (err) {
            console.error('Помилка завантаження користувачів:', err);
        }
    }

    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.isCompleted;

    app.innerHTML = `
        <div class="card">
            <h2>${escapeHtml(task.title) || 'Без назви'}</h2>
            <p><strong>Виконавець:</strong> ${userEmail}</p>
            <p><strong>Термін:</strong> ${task.dueDate ? new Date(task.dueDate).toLocaleDateString('uk-UA') : 'Н/Д'}</p>
            <p><strong>Пріоритет:</strong> ${escapeHtml(task.priority) || 'Н/Д'}</p>
            <p><strong>Прогрес:</strong> ${task.progress != null ? task.progress + '%' : '0%'}</p>
            <p><strong>Статус:</strong> ${task.isCompleted ? 'Виконано' : 'Не виконано'}</p>
            ${isOverdue ? '<p class="error">Завдання прострочено!</p>' : ''}
            ${role === 'Manager' ? `
                <div>
                    <label><i class="fas fa-folder"></i> Категорія</label>
                    <p>${escapeHtml(task.category?.name) || 'Без категорії'}</p>
                </div>
                <div>
                    <label><i class="fas fa-tags"></i> Теги</label>
                    <p>${task.tags?.map(t => escapeHtml(t.name)).join(', ') || 'Без тегів'}</p>
                </div>
            ` : ''}
            <button class="action-btn primary-btn" id="edit-task-btn">
                <i class="fas fa-edit"></i> Редагувати
            </button>
            ${role === 'Manager' ? `
                <button class="action-btn delete-btn" id="delete-task-btn">
                    <i class="fas fa-trash"></i> Видалити
                </button>
            ` : ''}
            <h3>Коментарі</h3>
            <form id="comment-form">
                <textarea id="comment-text" placeholder="Додати коментар" required></textarea>
                <button type="submit" class="action-btn primary-btn">
                    <i class="fas fa-comment"></i> Додати
                </button>
                <p class="error" id="comment-error"></p>
            </form>
            <div id="comments"></div>
            <h3>Нотатки</h3>
            <form id="note-form">
                <input type="text" id="note-title" placeholder="Заголовок нотатки" required>
                <textarea id="note-content" placeholder="Текст нотатки" required></textarea>
                <button type="submit" class="action-btn primary-btn">
                    <i class="fas fa-sticky-note"></i> Додати
                </button>
                <p class="error" id="note-error"></p>
            </form>
            <div id="notes"></div>
        </div>
    `;

    await renderComments(taskId);
    await renderNotes(taskId);

    const commentForm = document.getElementById('comment-form');
    const commentError = document.getElementById('comment-error');
    if (commentForm && commentError) {
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const comment = document.getElementById('comment-text').value.trim();
            if (!comment) {
                commentError.textContent = 'Введіть коментар';
                return;
            }
            try {
                await createComment({ taskId: parseInt(taskId), comment });
                commentForm.reset();
                await renderComments(taskId);
            } catch (err) {
                console.error('Помилка додавання коментаря:', err);
                commentError.textContent = `Помилка: ${err.message}`;
            }
        });
    }

    const noteForm = document.getElementById('note-form');
    const noteError = document.getElementById('note-error');
    if (noteForm && noteError) {
        noteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('note-title').value.trim();
            const content = document.getElementById('note-content').value.trim();
            if (!title || !content) {
                noteError.textContent = 'Заповніть усі поля';
                return;
            }
            try {
                await createNote({ taskId: parseInt(taskId), title, content });
                noteForm.reset();
                await renderNotes(taskId);
            } catch (err) {
                console.error('Помилка додавання нотатки:', err);
                noteError.textContent = `Помилка: ${err.message}`;
            }
        });
    }

    document.getElementById('edit-task-btn')?.addEventListener('click', () => {
        navigate(`/task/edit/${taskId}`);
    });

    document.getElementById('delete-task-btn')?.addEventListener('click', async () => {
        if (confirm('Ви впевнені, що хочете видалити завдання?')) {
            try {
                await deleteTask(taskId);
                navigate('/');
            } catch (err) {
                console.error('Помилка видалення завдання:', err);
                app.innerHTML = `<p class="error">Помилка: ${err.message}</p>`;
            }
        }
    });
}