import { getTasks, getTask, createTask, updateTask, deleteTask, getUsers, getCategories, getTags, createComment, createNote } from './api.js';
import { renderComments } from './comments.js';
import { renderNotes } from './notes.js';
import { navigate } from './router.js';
import { getCurrentUserRole } from './auth.js';

export async function renderTasks(page = 1) {
    const app = document.getElementById('app');
    const role = getCurrentUserRole();
    console.log('Rendering tasks, user role:', role);
    const pageSize = 10;

    let createTaskForm = '';
    if (role === 'Manager') {
        try {
            const users = await getUsers();
            createTaskForm = `
                <div class="create-task">
                    <h3>Create Task</h3>
                    <form id="create-task-form">
                        <div>
                            <label><i class="fas fa-heading"></i> Title</label>
                            <input type="text" id="task-title" required>
                        </div>
                        <div>
                            <label><i class="fas fa-user"></i> Assign to</label>
                            <select id="assigned-user" required>
                                <option value="">Select Worker</option>
                                ${users.filter(u => u.role === 'Worker').map(u => `<option value="${u.id}">${u.email}</option>`).join('')}
                            </select>
                        </div>
                        <button type="submit"><i class="fas fa-plus"></i> Create Task</button>
                    </form>
                </div>
            `;
        } catch (err) {
            console.error('Error fetching users for create form:', err);
            createTaskForm = '<p class="error">Failed to load users for task creation.</p>';
        }
    }

    app.innerHTML = `
        <div class="card">
            <h2>Tasks</h2>
            ${createTaskForm}
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Due Date</th>
                        <th>Priority</th>
                        <th>Progress</th>
                        <th>Assigned To</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="task-list"></tbody>
            </table>
            <div class="pagination">
                <button id="prev-page" disabled>Previous</button>
                <span id="page-info"></span>
                <button id="next-page">Next</button>
            </div>
        </div>
    `;

    async function loadTasks() {
        try {
            console.log('Fetching tasks for page:', page, 'pageSize:', pageSize);
            const response = await getTasks(page, pageSize);
            console.log('getTasks response:', response);

            if (!response || typeof response !== 'object') {
                throw new Error('Invalid response from API: response is not an object');
            }

            const { tasks = [], total = 0, page: currentPage = 1 } = response;
            console.log('Parsed tasks:', tasks, 'total:', total, 'currentPage:', currentPage);

            if (!Array.isArray(tasks)) {
                throw new Error('Tasks is not an array');
            }

            // Fetch user emails for assigned users
            const userIds = [...new Set(tasks.map(t => t.userId).filter(id => id))];
            let users = [];
            if (userIds.length > 0) {
                users = await getUsers();
                console.log('Fetched users:', users);
            }
            const userMap = Object.fromEntries(users.map(u => [u.id, u.email]));

            const tbody = document.getElementById('task-list');
            tbody.innerHTML = tasks.length > 0
                ? tasks.map(task => `
                    <tr>
                        <td><a href="#/task/${task.id}">${task.title || 'Untitled'}</a></td>
                        <td>${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</td>
                        <td>${task.priority || 'N/A'}</td>
                        <td>${task.progress != null ? task.progress + '%' : '0%'}</td>
                        <td>${task.userId ? userMap[task.userId] || 'Unknown' : 'Unassigned'}</td>
                        <td>
                            <button data-id="${task.id}" class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                            ${role === 'Manager' ? `
                                <button data-id="${task.id}" class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('')
                : '<tr><td colspan="6">No tasks available</td></tr>';

            document.getElementById('page-info').textContent = `Page ${currentPage} of ${Math.ceil(total / pageSize) || 1}`;
            document.getElementById('prev-page').disabled = currentPage <= 1;
            document.getElementById('next-page').disabled = currentPage >= Math.ceil(total / pageSize);
        } catch (err) {
            console.error('Error loading tasks:', err);
            app.innerHTML += `<p class="error">Failed to load tasks: ${err.message}. Please check the server or try logging in again.</p>`;
            if (err.message.includes('401') || err.message.includes('403')) {
                navigate('/login');
            }
        }
    }

    await loadTasks();

    if (role === 'Manager') {
        document.getElementById('create-task-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('task-title').value.trim();
            const userId = parseInt(document.getElementById('assigned-user').value) || null;
            try {
                await createTask({ title, userId, progress: 0, isCompleted: false });
                await loadTasks();
            } catch (err) {
                console.error('Error creating task:', err);
                document.getElementById('task-list').innerHTML += `<p class="error">Error creating task: ${err.message}</p>`;
            }
        });
    }

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
        if (e.target.closest('.edit-btn')) {
            const id = e.target.closest('.edit-btn').dataset.id;
            renderTaskForm(id);
        } else if (e.target.closest('.delete-btn')) {
            if (confirm('Are you sure you want to delete this task?')) {
                const id = e.target.closest('.delete-btn').dataset.id;
                try {
                    await deleteTask(id);
                    await loadTasks();
                } catch (err) {
                    console.error('Error deleting task:', err);
                    document.getElementById('task-list').innerHTML += `<p class="error">Error deleting task: ${err.message}</p>`;
                }
            }
        }
    });
}

async function renderTaskForm(id = null) {
    const app = document.getElementById('app');
    const role = getCurrentUserRole();
    let task = null;
    let categories = [];
    let tags = [];
    let users = [];

    try {
        if (id) {
            task = await getTask(id);
            console.log('Fetched task for edit:', task);
        }
        categories = await getCategories();
        tags = await getTags();
        if (role === 'Manager') {
            users = await getUsers();
        }
        console.log('Categories:', categories, 'Tags:', tags, 'Users:', users);

        if (!Array.isArray(categories)) {
            console.warn('Categories is not an array, setting to empty array:', categories);
            categories = [];
        }
        if (!Array.isArray(tags)) {
            console.warn('Tags is not an array, setting to empty array:', tags);
            tags = [];
        }
        if (!Array.isArray(users)) {
            console.warn('Users is not an array, setting to empty array:', users);
            users = [];
        }
    } catch (err) {
        console.error('Error fetching form data:', err);
        app.innerHTML = `<p class="error">Failed to load form: ${err.message}</p>`;
        return;
    }

    app.innerHTML = `
        <div class="card">
            <h2>${id ? 'Edit Task' : 'Create Task'}</h2>
            <form id="task-form" class="${id ? 'edit-task' : 'create-task'}">
                <div>
                    <label><i class="fas fa-heading"></i> Title</label>
                    <input type="text" id="title" value="${task?.title || ''}" required ${role === 'Worker' ? 'disabled' : ''}>
                </div>
                <div>
                    <label><i class="fas fa-align-left"></i> Description</label>
                    <textarea id="description" ${role === 'Worker' ? 'disabled' : ''}>${task?.description || ''}</textarea>
                </div>
                <div>
                    <label><i class="fas fa-calendar-alt"></i> Due Date</label>
                    <input type="date" id="dueDate" value="${task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}" required ${role === 'Worker' ? 'disabled' : ''}>
                </div>
                <div>
                    <label><i class="fas fa-exclamation-circle"></i> Priority</label>
                    <select id="priority" required ${role === 'Worker' ? 'disabled' : ''}>
                        <option value="High" ${task?.priority === 'High' ? 'selected' : ''}>High</option>
                        <option value="Medium" ${task?.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                        <option value="Low" ${task?.priority === 'Low' ? 'selected' : ''}>Low</option>
                    </select>
                </div>
                ${role === 'Manager' ? `
                    <div>
                        <label><i class="fas fa-user"></i> Assign to</label>
                        <select id="userId">
                            <option value="">Unassigned</option>
                            ${users.filter(u => u.role === 'Worker').map(u => `
                                <option value="${u.id}" ${task?.userId === u.id ? 'selected' : ''}>${u.email}</option>
                            `).join('')}
                        </select>
                    </div>
                ` : ''}
                <div>
                    <label><i class="fas fa-folder"></i> Category</label>
                    <select id="categoryId" ${role === 'Worker' ? 'disabled' : ''}>
                        <option value="">None</option>
                        ${categories.length > 0 ? categories.map(c => `<option value="${c.id}" ${task?.categoryId === c.id ? 'selected' : ''}>${c.name || 'Unnamed'}</option>`).join('') : '<option value="">No categories available</option>'}
                    </select>
                </div>
                <div>
                    <label><i class="fas fa-tags"></i> Tags</label>
                    <select id="tagIds" multiple ${role === 'Worker' ? 'disabled' : ''}>
                        ${tags.length > 0 ? tags.map(t => `<option value="${t.id}" ${task?.tagIds?.includes(t.id) ? 'selected' : ''}>${t.name || 'Unnamed'}</option>`).join('') : '<option value="">No tags available</option>'}
                    </select>
                </div>
                <div>
                    <label><i class="fas fa-chart-line"></i> Progress (%)</label>
                    <input type="number" id="progress" value="${task?.progress || 0}" min="0" max="100">
                </div>
                <div>
                    <label><i class="fas fa-sticky-note"></i> Notes</label>
                    <textarea id="notes">${task?.notes || ''}</textarea>
                </div>
                <div>
                    <label><i class="fas fa-check-circle"></i> Completed</label>
                    <input type="checkbox" id="isCompleted" ${task?.isCompleted ? 'checked' : ''}>
                </div>
                <button type="submit"><i class="fas fa-${id ? 'save' : 'plus'}"></i> ${id ? 'Update Task' : 'Create Task'}</button>
                <button type="button" id="cancel-form"><i class="fas fa-times"></i> Cancel</button>
                <p class="error" id="error"></p>
            </form>
        </div>
    `;

    document.getElementById('task-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const taskData = {
            title: document.getElementById('title').value.trim(),
            description: document.getElementById('description').value,
            dueDate: new Date(document.getElementById('dueDate').value).toISOString(),
            priority: document.getElementById('priority').value,
            userId: role === 'Manager' ? (parseInt(document.getElementById('userId')?.value) || null) : null,
            categoryId: document.getElementById('categoryId').value || null,
            tagIds: Array.from(document.getElementById('tagIds').selectedOptions).map(o => parseInt(o.value)),
            progress: parseInt(document.getElementById('progress').value),
            notes: document.getElementById('notes').value,
            isCompleted: document.getElementById('isCompleted').checked,
        };

        try {
            console.log('Submitting task:', taskData);
            if (id) {
                await updateTask(id, { ...taskData, id });
            } else {
                await createTask(taskData);
            }
            navigate('/');
        } catch (err) {
            console.error('Error submitting task:', err);
            document.getElementById('error').textContent = err.message;
        }
    });

    document.getElementById('cancel-form')?.addEventListener('click', () => navigate('/'));
}

export async function renderTaskDetail(id) {
    const app = document.getElementById('app');
    const role = getCurrentUserRole();

    try {
        const task = await getTask(id);
        console.log('Fetched task for detail:', task);
        const categories = await getCategories();
        const tags = await getTags();
        const users = task.userId ? await getUsers() : [];
        const userMap = Object.fromEntries(users.map(u => [u.id, u.email]));
        console.log('Categories:', categories, 'Tags:', tags, 'Users:', users);

        if (!Array.isArray(categories)) {
            console.warn('Categories is not an array, setting to empty array:', categories);
            categories = [];
        }
        if (!Array.isArray(tags)) {
            console.warn('Tags is not an array, setting to empty array:', tags);
            tags = [];
        }

        app.innerHTML = `
            <div class="card">
                <h2>${task.title || 'Untitled'}</h2>
                <p><strong>Description:</strong> ${task.description || 'None'}</p>
                <p><strong>Due Date:</strong> ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</p>
                <p><strong>Priority:</strong> ${task.priority || 'N/A'}</p>
                <p><strong>Progress:</strong> ${task.progress != null ? task.progress + '%' : '0%'}</p>
                <p><strong>Assigned To:</strong> ${task.userId ? userMap[task.userId] || 'Unknown' : 'Unassigned'}</p>
                <p><strong>Category:</strong> ${task.categoryId ? categories.find(c => c.id === task.categoryId)?.name || 'Unknown' : 'None'}</p>
                <p><strong>Tags:</strong> ${task.tagIds?.length ? tags.filter(t => task.tagIds.includes(t.id)).map(t => t.name || 'Unnamed').join(', ') : 'None'}</p>
                <p><strong>Notes:</strong> ${task.notes || 'None'}</p>
                <p><strong>Completed:</strong> ${task.isCompleted ? 'Yes' : 'No'}</p>
                <button id="edit-task" class="action-btn edit-btn"><i class="fas fa-edit"></i> Edit Task</button>
                <h3>Comments</h3>
                <div id="comments"></div>
                <form id="comment-form">
                    <div>
                        <label><i class="fas fa-comment"></i> Comment</label>
                        <textarea id="comment" required></textarea>
                    </div>
                    <button type="submit"><i class="fas fa-comment-alt"></i> Add Comment</button>
                </form>
                <h3>Notes</h3>
                <div id="notes"></div>
                <form id="note-form">
                    <div>
                        <label><i class="fas fa-heading"></i> Title</label>
                        <input type="text" id="note-title" required>
                    </div>
                    <div>
                        <label><i class="fas fa-align-left"></i> Content</label>
                        <textarea id="note-content" required></textarea>
                    </div>
                    <button type="submit"><i class="fas fa-sticky-note"></i> Add Note</button>
                </form>
            </div>
        `;

        renderComments(id);
        renderNotes(id);

        document.getElementById('edit-task').addEventListener('click', () => renderTaskForm(id));

        document.getElementById('comment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const comment = document.getElementById('comment').value;
            try {
                await createComment({ taskId: parseInt(id), comment });
                renderComments(id);
                document.getElementById('comment').value = '';
            } catch (err) {
                console.error('Error adding comment:', err);
                app.innerHTML += `<p class="error">Failed to add comment: ${err.message}</p>`;
            }
        });

        document.getElementById('note-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const note = {
                taskId: parseInt(id),
                title: document.getElementById('note-title').value,
                content: document.getElementById('note-content').value,
            };
            try {
                await createNote(note);
                renderNotes(id);
                document.getElementById('note-title').value = '';
                document.getElementById('note-content').value = '';
            } catch (err) {
                console.error('Error adding note:', err);
                app.innerHTML += `<p class="error">Failed to add note: ${err.message}</p>`;
            }
        });
    } catch (err) {
        console.error('Error rendering task detail:', err);
        app.innerHTML = `<p class="error">Failed to load task details: ${err.message}</p>`;
        if (err.message.includes('401') || err.message.includes('403')) {
            navigate('/login');
        }
    }
}