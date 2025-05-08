let tasksList = [];
let usersList = [];
let categoriesList = [];
let tagsList = [];
let currentUserRole = null;

const authProtectedElements = document.querySelectorAll('.auth-protected');
const taskListElement = document.getElementById('taskList');
const completedTasksListElement = document.querySelector('#completedTasksZone ul');

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupEventDelegation();
    setupDragAndDrop();
});

async function checkAuth() {
    showSpinner();
    try {
        const response = await fetch('/api/account/checkauth', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            if (data.isAuthenticated) {
                document.getElementById('authSection').classList.add('authenticated');
                authProtectedElements.forEach(el => el.style.display = 'block');
                currentUserRole = data.role;
                if (currentUserRole !== 'Manager') {
                    document.getElementById('addTaskForm').style.display = 'none';
                }
                await Promise.all([loadUsers(), loadTasks(), loadCategories(), loadTags()]);
            } else {
                authProtectedElements.forEach(el => el.style.display = 'none');
                document.getElementById('authSection').classList.remove('authenticated');
            }
        } else {
            throw new Error('Failed to check authentication');
        }
    } catch (error) {
        console.error('Check auth error:', error);
        showError('Error checking authentication: ' + error.message);
    } finally {
        hideSpinner();
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            console.log('Users data:', data); // Дебаг
            usersList = Array.isArray(data) ? data : [];
            const userSelect = document.getElementById('userSelect');
            const editUserSelect = document.getElementById('editUserSelect');
            const userFilter = document.getElementById('userFilter'); // Для фільтрації
            userSelect.innerHTML = '<option value="">Select User</option>';
            editUserSelect.innerHTML = '<option value="">Select User</option>';
            userFilter.innerHTML = '<option value="">All Users</option>'; // Для фільтра
            if (usersList.length === 0) {
                userSelect.innerHTML += '<option value="" disabled>No users available</option>';
                editUserSelect.innerHTML += '<option value="" disabled>No users available</option>';
                userFilter.innerHTML += '<option value="" disabled>No users available</option>';
            } else {
                usersList.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.Id; // Використовуємо Id замість id
                    option.textContent = user.Name; // Використовуємо Name замість name
                    userSelect.appendChild(option.cloneNode(true));
                    editUserSelect.appendChild(option.cloneNode(true));
                    userFilter.appendChild(option.cloneNode(true));
                });
            }
        } else {
            throw new Error('Failed to load users');
        }
    } catch (error) {
        console.error('Load users error:', error);
        showError('Error loading users: ' + error.message);
    }
}

async function loadTasks() {
    try {
        const response = await fetch('/api/tasks', { credentials: 'include' });
        if (response.ok) {
            tasksList = await response.json();
            console.log('Tasks data:', tasksList); // Дебаг
            renderTasks(tasksList);
            updateStatistics();
            checkOverdueTasks();
        } else {
            throw new Error('Failed to load tasks');
        }
    } catch (error) {
        console.error('Load tasks error:', error);
        showError('Error loading tasks: ' + error.message);
    }
}

async function loadCategories() {
    try {
        const response = await fetch('/api/categories', { credentials: 'include' });
        if (response.ok) {
            categoriesList = await response.json();
            const taskCategory = document.getElementById('taskCategory');
            const editTaskCategory = document.getElementById('editTaskCategory');
            const categoryFilter = document.getElementById('categoryFilter'); // Для фільтрації
            taskCategory.innerHTML = '<option value="">Select Category</option>';
            editTaskCategory.innerHTML = '<option value="">Select Category</option>';
            categoryFilter.innerHTML = '<option value="">All Categories</option>';
            if (categoriesList.length === 0) {
                taskCategory.innerHTML += '<option value="" disabled>No categories available</option>';
                editTaskCategory.innerHTML += '<option value="" disabled>No categories available</option>';
                categoryFilter.innerHTML += '<option value="" disabled>No categories available</option>';
            } else {
                categoriesList.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.Id;
                    option.textContent = category.Name;
                    taskCategory.appendChild(option.cloneNode(true));
                    editTaskCategory.appendChild(option.cloneNode(true));
                    categoryFilter.appendChild(option.cloneNode(true));
                });
            }
        } else {
            throw new Error('Failed to load categories');
        }
    } catch (error) {
        console.error('Load categories error:', error);
        showError('Error loading categories: ' + error.message);
    }
}

async function loadTags() {
    try {
        const response = await fetch('/api/tags', { credentials: 'include' });
        if (response.ok) {
            tagsList = await response.json();
            console.log('Tags data:', tagsList); // Дебаг
            renderTagCheckboxes('taskTagsContainer');
            renderTagCheckboxes('editTaskTagsContainer');
            const tagFilter = document.getElementById('tagFilter');
            tagFilter.innerHTML = '<option value="">All Tags</option>';
            tagsList.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag.Id;
                option.textContent = tag.Name;
                tagFilter.appendChild(option);
            });
        } else {
            throw new Error('Failed to load tags: ' + response.statusText);
        }
    } catch (error) {
        console.error('Load tags error:', error);
        showError('Error loading tags: ' + error.message);
    }
}

function renderTagCheckboxes(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if (tagsList.length === 0) {
        container.innerHTML = '<span>No tags available</span>';
    } else {
        tagsList.forEach(tag => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = tag.Id;
            checkbox.name = 'tag';
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${tag.Name}`));
            container.appendChild(label);
        });
    }
}

async function addTaskWithSpinner() {
    const taskSpinner = document.getElementById('taskSpinner');
    taskSpinner.style.display = 'inline-block';
    try {
        await addTask();
        document.getElementById('taskSuccess').style.display = 'block';
        setTimeout(() => document.getElementById('taskSuccess').style.display = 'none', 3000);
    } catch (error) {
        showError('Error adding task: ' + error.message);
    } finally {
        taskSpinner.style.display = 'none';
    }
}

async function addTask() {
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDesc').value.trim();
    const dueDate = document.getElementById('taskDueDate').value;
    const userId = document.getElementById('userSelect').value;
    const categoryId = document.getElementById('taskCategory').value;
    const tagIds = Array.from(document.querySelectorAll('#taskTagsContainer input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
    const progress = parseInt(document.getElementById('taskProgress').value) || 0;

    if (!title || !dueDate) {
        showError('Title and Due Date are required.');
        return;
    }

    const dateObj = new Date(dueDate);
    if (isNaN(dateObj.getTime())) {
        showError('Due Date must be a valid date.');
        return;
    }

    if (progress < 0 || progress > 100) {
        showError('Progress must be between 0 and 100.');
        return;
    }

    const taskData = {
        Title: title,
        Description: description,
        DueDate: dateObj.toISOString(),
        IsCompleted: false,
        UserId: userId ? parseInt(userId) : null,
        CategoryId: categoryId ? parseInt(categoryId) : null,
        Notes: '',
        Progress: progress,
        TagIds: tagIds
    };

    try {
        const response = await fetchWithCsrf('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData),
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            tasksList.unshift(data);
            renderTasks(tasksList);
            document.getElementById('taskTitle').value = '';
            document.getElementById('taskDesc').value = '';
            document.getElementById('taskDueDate').value = '';
            document.getElementById('taskCategory').value = '';
            document.querySelectorAll('#taskTagsContainer input[type="checkbox"]').forEach(cb => cb.checked = false);
            document.getElementById('taskProgress').value = '0';
            updateStatistics();
        } else {
            const errorText = await response.text();
            showError(`Error adding task: ${response.status} - ${errorText}`);
        }
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

async function toggleTaskCompletion(taskId) {
    if (taskId == null || isNaN(taskId)) {
        showError('Invalid task ID for completion toggle.');
        return;
    }

    const task = tasksList.find(t => t.Id === taskId);
    if (!task) {
        showError('Task not found.');
        return;
    }

    task.IsCompleted = !task.IsCompleted;
    try {
        const response = await fetchWithCsrf(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task),
            credentials: 'include'
        });
        if (response.ok) {
            await loadTasks();
        } else {
            showError('Error toggling task completion: ' + await response.text());
        }
    } catch (error) {
        console.error('Fetch error:', error);
        showError('Error toggling task completion: ' + error.message);
    }
}

function renderTasks(tasks) {
    taskListElement.innerHTML = '';
    completedTasksListElement.innerHTML = '';
    const activeTasks = tasks.filter(task => !task.IsCompleted);
    const completedTasks = tasks.filter(task => task.IsCompleted);

    if (activeTasks.length === 0) {
        taskListElement.innerHTML = '<li>No active tasks found.</li>';
    } else {
        activeTasks.forEach(task => {
            const li = createTaskElement(task);
            taskListElement.appendChild(li);
        });
    }

    if (completedTasks.length === 0) {
        completedTasksListElement.innerHTML = '<li>No completed tasks found.</li>';
    } else {
        completedTasks.forEach(task => {
            const li = createTaskElement(task);
            completedTasksListElement.appendChild(li);
        });
    }
}

function createTaskElement(task) {
    const li = document.createElement('li');
    li.draggable = true;
    li.id = `task-${task.Id}`;
    li.className = task.IsCompleted ? 'completed' : '';
    if (!task.IsCompleted) {
        const dueDate = new Date(task.DueDate);
        const now = new Date();
        if (dueDate < now) li.classList.add('overdue');
        if (dueDate < now.setDate(now.getDate() + 1)) li.classList.add('urgent');
    }

    const tagNames = (task.TagIds || []).map(tagId => tagsList.find(tag => tag.Id === tagId)?.Name).filter(Boolean);
    const tagsHtml = tagNames.map(name => `<span class="tag">${name}</span>`).join('');

    li.innerHTML = `
        <div>
            ${task.Title}<br>
            <span class="task-details">${formatDate(task.DueDate)}</span>
            ${tagsHtml}
            <div class="progress-bar"><div class="progress-fill" style="width: ${task.Progress}%"></div></div>
        </div>
        <div class="task-actions">
            <button class="edit-btn" data-task-id="${task.Id}">Edit</button>
            <button class="complete-btn" data-task-id="${task.Id}">${task.IsCompleted ? 'Unmark' : 'Complete'}</button>
            <button class="delete-btn" data-task-id="${task.Id}">Delete</button>
            <button class="details-btn" data-task-id="${task.Id}">Details</button>
        </div>
    `;

    li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', task.Id);
        li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    return li;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function updateStatistics() {
    const totalTasks = tasksList.length;
    const completedTasks = tasksList.filter(task => task.IsCompleted).length;
    const overdueTasks = tasksList.filter(task => !task.IsCompleted && new Date(task.DueDate) < new Date()).length;
    const activeTasks = totalTasks - completedTasks;

    document.getElementById('totalTasks').textContent = totalTasks;
    document.getElementById('completedTasks').textContent = completedTasks;
    document.getElementById('overdueTasks').textContent = overdueTasks;
    document.getElementById('activeTasks').textContent = activeTasks;
}

function checkOverdueTasks() {
    const hasOverdue = tasksList.some(task => !task.IsCompleted && new Date(task.DueDate) < new Date());
    document.getElementById('overdueNotification').style.display = hasOverdue ? 'block' : 'none';
}

async function deleteTask(taskId) {
    if (taskId == null || isNaN(taskId)) {
        showError('Invalid task ID for deletion.');
        return;
    }

    try {
        const response = await fetchWithCsrf(`/api/tasks/${taskId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (response.ok) {
            tasksList = tasksList.filter(task => task.Id !== taskId);
            renderTasks(tasksList);
            updateStatistics();
        } else {
            showError('Error deleting task: ' + await response.text());
        }
    } catch (error) {
        showError('Error deleting task: ' + error.message);
    }
}

function setupEventDelegation() {
    document.addEventListener('click', async (e) => {
        const taskId = e.target.getAttribute('data-task-id');
        if (!taskId) return;

        if (e.target.classList.contains('edit-btn')) {
            openEditModal(parseInt(taskId));
        } else if (e.target.classList.contains('complete-btn')) {
            await toggleTaskCompletion(parseInt(taskId));
        } else if (e.target.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to delete this task?')) {
                await deleteTask(parseInt(taskId));
            }
        } else if (e.target.classList.contains('details-btn')) {
            showTaskDetails(parseInt(taskId));
        }
    });

    // Переконаємося, що exportButton існує
    const exportButton = document.getElementById('exportButton');
    if (exportButton) {
        exportButton.addEventListener('click', exportToCSV);
    } else {
        console.error('Export button not found in DOM');
    }

    // Прив’язка подій для модальних вікон
    const saveTaskBtn = document.getElementById('saveTaskBtn');
    const saveNotesBtn = document.getElementById('saveNotesBtn');
    if (saveTaskBtn) {
        saveTaskBtn.addEventListener('click', saveTaskChanges);
    } else {
        console.error('Save task button not found in DOM');
    }
    if (saveNotesBtn) {
        saveNotesBtn.addEventListener('click', saveTaskNotes);
    } else {
        console.error('Save notes button not found in DOM');
    }
}

function openEditModal(taskId) {
    const task = tasksList.find(t => t.Id === taskId);
    if (!task) {
        showError('Task not found.');
        return;
    }

    document.getElementById('editTaskTitle').value = task.Title;
    document.getElementById('editTaskDesc').value = task.Description || '';
    document.getElementById('editTaskDueDate').value = new Date(task.DueDate).toISOString().split('T')[0];
    document.getElementById('editUserSelect').value = task.UserId || '';
    document.getElementById('editTaskCategory').value = task.CategoryId || '';
    document.getElementById('editTaskProgress').value = task.Progress;
    const editTagCheckboxes = document.querySelectorAll('#editTaskTagsContainer input[type="checkbox"]');
    editTagCheckboxes.forEach(cb => cb.checked = (task.TagIds || []).includes(parseInt(cb.value)));

    document.getElementById('editModal').dataset.taskId = taskId;
    document.getElementById('editModal').style.display = 'flex';
}

async function saveTaskChanges() {
    const taskId = parseInt(document.getElementById('editModal').dataset.taskId);
    const task = tasksList.find(t => t.Id === taskId);
    if (!task) {
        showError('Task not found.');
        return;
    }

    const title = document.getElementById('editTaskTitle').value.trim();
    const description = document.getElementById('editTaskDesc').value.trim();
    const dueDate = document.getElementById('editTaskDueDate').value;
    const userId = document.getElementById('editUserSelect').value;
    const categoryId = document.getElementById('editTaskCategory').value;
    const tagIds = Array.from(document.querySelectorAll('#editTaskTagsContainer input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
    const progress = parseInt(document.getElementById('editTaskProgress').value) || 0;

    if (!title || !dueDate) {
        showError('Title and Due Date are required.');
        return;
    }

    const dateObj = new Date(dueDate);
    if (isNaN(dateObj.getTime())) {
        showError('Due Date must be a valid date.');
        return;
    }

    if (progress < 0 || progress > 100) {
        showError('Progress must be between 0 and 100.');
        return;
    }

    task.Title = title;
    task.Description = description;
    task.DueDate = dateObj.toISOString();
    task.UserId = userId ? parseInt(userId) : null;
    task.CategoryId = categoryId ? parseInt(categoryId) : null;
    task.Progress = progress;
    task.TagIds = tagIds;

    try {
        const response = await fetchWithCsrf(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task),
            credentials: 'include'
        });
        if (response.ok) {
            await loadTasks();
            closeModal('editModal');
        } else {
            showError('Error saving task changes: ' + await response.text());
        }
    } catch (error) {
        console.error('Save task changes error:', error);
        showError('Error saving task changes: ' + error.message);
    }
}

function showTaskDetails(taskId) {
    const task = tasksList.find(t => t.Id === taskId);
    if (!task) {
        showError('Task not found.');
        return;
    }

    document.getElementById('detailsTaskTitle').textContent = task.Title;
    document.getElementById('detailsTaskDesc').textContent = task.Description || 'No description';
    document.getElementById('detailsTaskDueDate').textContent = formatDate(task.DueDate);
    document.getElementById('detailsTaskUser').textContent = usersList.find(u => u.Id === task.UserId)?.Name || 'Unassigned';
    document.getElementById('detailsTaskCategory').textContent = categoriesList.find(c => c.Id === task.CategoryId)?.Name || 'No category';
    document.getElementById('detailsTaskTags').textContent = (task.TagIds || []).map(tagId => tagsList.find(tag => tag.Id === tagId)?.Name).filter(Boolean).join(', ') || 'No tags';
    document.getElementById('detailsTaskProgress').textContent = `${task.Progress}%`;
    document.getElementById('detailsTaskStatus').textContent = task.IsCompleted ? 'Completed' : 'Active';
    document.getElementById('detailsTaskNotes').value = task.Notes || '';
    document.getElementById('detailsTaskNotes').dataset.taskId = taskId;

    document.getElementById('detailsModal').style.display = 'flex';
    const editFromDetailsBtn = document.getElementById('editFromDetailsBtn');
    if (editFromDetailsBtn) {
        editFromDetailsBtn.onclick = () => openEditModal(taskId);
    }
}

async function saveTaskNotes() {
    const taskId = parseInt(document.getElementById('detailsTaskNotes').dataset.taskId);
    const task = tasksList.find(t => t.Id === taskId);
    if (!task) {
        showError('Task not found.');
        return;
    }

    task.Notes = document.getElementById('detailsTaskNotes').value;
    try {
        const response = await fetchWithCsrf(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task),
            credentials: 'include'
        });
        if (response.ok) {
            await loadTasks();
            closeModal('detailsModal');
        } else {
            showError('Error saving task notes: ' + await response.text());
        }
    } catch (error) {
        console.error('Save task notes error:', error);
        showError('Error saving task notes: ' + error.message);
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function searchTasks() {
    const query = document.getElementById('taskSearch').value.toLowerCase();
    const filteredTasks = tasksList.filter(task =>
        task.Title.toLowerCase().includes(query) ||
        (task.Description && task.Description.toLowerCase().includes(query))
    );
    renderTasks(filteredTasks);
}

function filterTasks() {
    const taskFilter = document.getElementById('taskFilter').value;
    const userFilter = document.getElementById('userFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;
    const tagFilter = document.getElementById('tagFilter').value;

    let filteredTasks = [...tasksList];

    if (taskFilter === 'completed') {
        filteredTasks = filteredTasks.filter(task => task.IsCompleted);
    } else if (taskFilter === 'incomplete') {
        filteredTasks = filteredTasks.filter(task => !task.IsCompleted);
    }

    if (userFilter) {
        filteredTasks = filteredTasks.filter(task => task.UserId === parseInt(userFilter));
    }

    if (categoryFilter) {
        filteredTasks = filteredTasks.filter(task => task.CategoryId === parseInt(categoryFilter));
    }

    if (tagFilter) {
        filteredTasks = filteredTasks.filter(task => (task.TagIds || []).includes(parseInt(tagFilter)));
    }

    renderTasks(filteredTasks);
}

function sortTasks() {
    const sortOption = document.getElementById('taskSort').value;
    let sortedTasks = [...tasksList];

    if (sortOption === 'dueDateAsc') {
        sortedTasks.sort((a, b) => new Date(a.DueDate) - new Date(b.DueDate));
    } else if (sortOption === 'dueDateDesc') {
        sortedTasks.sort((a, b) => new Date(b.DueDate) - new Date(a.DueDate));
    } else if (sortOption === 'progressAsc') {
        sortedTasks.sort((a, b) => a.Progress - b.Progress);
    } else if (sortOption === 'progressDesc') {
        sortedTasks.sort((a, b) => b.Progress - a.Progress);
    }

    renderTasks(sortedTasks);
}

function clearFilters() {
    document.getElementById('taskFilter').value = 'all';
    document.getElementById('userFilter').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('tagFilter').value = '';
    document.getElementById('taskSort').value = 'default';
    document.getElementById('taskSearch').value = '';
    renderTasks(tasksList);
}

function exportToCSV() {
    const headers = ['ID', 'Title', 'Description', 'Due Date', 'Completed', 'Assigned To', 'Category', 'Tags', 'Progress', 'Notes'];
    const rows = tasksList.map(task => [
        task.Id,
        `"${task.Title.replace(/"/g, '""')}"`,
        `"${(task.Description || '').replace(/"/g, '""')}"`,
        formatDate(task.DueDate),
        task.IsCompleted ? 'Yes' : 'No',
        usersList.find(u => u.Id === task.UserId)?.Name || 'Unassigned',
        categoriesList.find(c => c.Id === task.CategoryId)?.Name || 'No category',
        (task.TagIds || []).map(tagId => tagsList.find(tag => tag.Id === tagId)?.Name).filter(Boolean).join(', ') || 'No tags',
        task.Progress,
        `"${(task.Notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'tasks_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!email || !password) {
        showLoginError('Email and password are required.');
        return;
    }

    const loginData = { Email: email, Password: password };

    try {
        const response = await fetchWithCsrf('/api/account/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginData),
            credentials: 'include'
        });
        if (response.ok) {
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
            await checkAuth();
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            showLoginError('Login failed: ' + (errorData.errors ? JSON.stringify(errorData.errors) : errorData.error));
        }
    } catch (error) {
        console.error('Login error:', error);
        showLoginError('Error during login: ' + error.message);
    }
}

async function register() {
    const email = document.getElementById('registerEmail').value;
    const name = document.getElementById('registerName').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const role = document.getElementById('registerRole').value;

    if (!email || !name || !password || !confirmPassword || !role) {
        showRegisterError('All fields are required.');
        return;
    }

    if (password !== confirmPassword) {
        showRegisterError('Passwords do not match.');
        return;
    }

    try {
        const response = await fetchWithCsrf('/api/account/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name, password, role }),
            credentials: 'include'
        });
        if (response.ok) {
            document.getElementById('registerForm').style.display = 'none';
            await checkAuth();
        } else {
            const errorText = await response.text();
            showRegisterError('Registration failed: ' + errorText);
        }
    } catch (error) {
        showRegisterError('Error during registration: ' + error.message);
    }
}

async function logout() {
    try {
        const response = await fetchWithCsrf('/api/account/logout', {
            method: 'POST',
            credentials: 'include'
        });
        if (response.ok) {
            await checkAuth();
        } else {
            showError('Error during logout');
        }
    } catch (error) {
        showError('Error during logout: ' + error.message);
    }
}

function showError(message) {
    const errorDiv = document.getElementById('globalError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function showRegisterError(message) {
    const errorDiv = document.getElementById('registerError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function showSpinner() {
    const spinner = document.getElementById('globalSpinner');
    if (spinner) spinner.style.display = 'block';
}

function hideSpinner() {
    const spinner = document.getElementById('globalSpinner');
    if (spinner) spinner.style.display = 'none';
}

async function fetchWithCsrf(url, options = {}) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    const headers = {
        ...options.headers,
        'X-CSRF-Token': csrfToken || ''
    };
    return fetch(url, { ...options, headers });
}

function setupDragAndDrop() {
    const activeZone = document.getElementById('activeTasksZone');
    const completedZone = document.getElementById('completedTasksZone');

    activeZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        activeZone.classList.add('dragover');
    });

    activeZone.addEventListener('dragleave', () => {
        activeZone.classList.remove('dragover');
    });

    activeZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        activeZone.classList.remove('dragover');
        const taskId = parseInt(e.dataTransfer.getData('text/plain'));
        const task = tasksList.find(t => t.Id === taskId);
        if (task && task.IsCompleted) {
            task.IsCompleted = false;
            await toggleTaskCompletion(taskId);
        }
    });

    completedZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        completedZone.classList.add('dragover');
    });

    completedZone.addEventListener('dragleave', () => {
        completedZone.classList.remove('dragover');
    });

    completedZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        completedZone.classList.remove('dragover');
        const taskId = parseInt(e.dataTransfer.getData('text/plain'));
        const task = tasksList.find(t => t.Id === taskId);
        if (task && !task.IsCompleted) {
            task.IsCompleted = true;
            await toggleTaskCompletion(taskId);
        }
    });
}

async function addCategory() {
    const categoryName = prompt('Enter new category name:');
    if (categoryName && categoryName.length >= 2) {
        try {
            const response = await fetchWithCsrf('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Name: categoryName }),
                credentials: 'include'
            });
            if (response.ok) {
                await loadCategories();
            } else {
                showError('Error adding category: ' + await response.text());
            }
        } catch (error) {
            showError('Error adding category: ' + error.message);
        }
    } else {
        showError('Category name must be at least 2 characters long.');
    }
}

async function addTag() {
    const tagName = prompt('Enter new tag name:');
    if (tagName && tagName.length >= 2) {
        try {
            const response = await fetchWithCsrf('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Name: tagName }),
                credentials: 'include'
            });
            if (response.ok) {
                await loadTags();
            } else {
                showError('Error adding tag: ' + await response.text());
            }
        } catch (error) {
            showError('Error adding tag: ' + error.message);
        }
    } else {
        showError('Tag name must be at least 2 characters long.');
    }
}