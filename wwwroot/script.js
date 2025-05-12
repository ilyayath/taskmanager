// State management
const state = {
    tasks: [],
    users: [],
    categories: [],
    tags: [],
    currentUserRole: '',
    currentItemType: ''
};

// Cached DOM elements
const dom = {
    authProtected: document.querySelectorAll('.auth-protected'),
    taskList: document.getElementById('taskList'),
    completedTasksList: document.querySelector('#completedTasksZone ul'),
    globalError: document.getElementById('globalError'),
    globalSpinner: document.getElementById('globalSpinner'),
    taskTags: document.getElementById('taskTags'),
    editTaskTags: document.getElementById('editTaskTags'),
    taskFilter: document.getElementById('taskFilter'),
    userFilter: document.getElementById('userFilter'),
    categoryFilter: document.getElementById('categoryFilter'),
    tagFilter: document.getElementById('tagFilter'),
    taskSort: document.getElementById('taskSort'),
    taskSearch: document.getElementById('taskSearch'),
    taskSuccess: document.getElementById('taskSuccess'),
    taskSpinner: document.getElementById('taskSpinner'),
    overdueNotification: document.getElementById('overdueNotification'),
    authSection: document.getElementById('authSection'),
    addTaskForm: document.getElementById('addTaskForm'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    loginError: document.getElementById('loginError'),
    registerError: document.getElementById('registerError'),
    userSelect: document.getElementById('userSelect'),
    editUserSelect: document.getElementById('editUserSelect'),
    taskCategory: document.getElementById('taskCategory'),
    editTaskCategory: document.getElementById('editTaskCategory'),
    editModal: document.getElementById('editModal'),
    detailsModal: document.getElementById('detailsModal'),
    addItemModal: document.getElementById('addItemModal'),
    addItemName: document.getElementById('addItemName'),
    addItemModalTitle: document.getElementById('addItemModalTitle'),
    taskTitle: document.getElementById('taskTitle'),
    taskDesc: document.getElementById('taskDesc'),
    taskDueDate: document.getElementById('taskDueDate'),
    taskProgress: document.getElementById('taskProgress'),
    editTaskTitle: document.getElementById('editTaskTitle'),
    editTaskDesc: document.getElementById('editTaskDesc'),
    editTaskDueDate: document.getElementById('editTaskDueDate'),
    editTaskProgress: document.getElementById('editTaskProgress'),
    detailsTaskTitle: document.getElementById('detailsTaskTitle'),
    detailsTaskDesc: document.getElementById('detailsTaskDesc'),
    detailsTaskDueDate: document.getElementById('detailsTaskDueDate'),
    detailsTaskUser: document.getElementById('detailsTaskUser'),
    detailsTaskCategory: document.getElementById('detailsTaskCategory'),
    detailsTaskTags: document.getElementById('detailsTaskTags'),
    detailsTaskProgress: document.getElementById('detailsTaskProgress'),
    detailsTaskStatus: document.getElementById('detailsTaskStatus'),
    detailsTaskNotes: document.getElementById('detailsTaskNotes'),
    editFromDetailsBtn: document.getElementById('editFromDetailsBtn'),
    totalTasks: document.getElementById('totalTasks'),
    completedTasks: document.getElementById('completedTasks'),
    overdueTasks: document.getElementById('overdueTasks'),
    activeTasks: document.getElementById('activeTasks'),
    activeTasksZone: document.getElementById('activeTasksZone'),
    completedTasksZone: document.getElementById('completedTasksZone'),
    themeToggle: document.getElementById('themeToggle'),
    exportButton: document.getElementById('exportButton'),
    saveItemBtn: document.getElementById('saveItemBtn')
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    applyStoredTheme();
    await initializeApp();
    setupEventListeners();
});

// Theme management
function applyStoredTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        dom.themeToggle.textContent = 'Light Mode';
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    dom.themeToggle.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
}

// UI utilities
function showSpinner() {
    dom.globalSpinner.style.display = 'block';
}

function hideSpinner() {
    dom.globalSpinner.style.display = 'none';
}

function showError(message, context = 'General') {
    dom.globalError.textContent = message;
    dom.globalError.style.display = 'block';
    console.error(`${context}: ${message}`);
    setTimeout(() => dom.globalError.style.display = 'none', 5000);
}

function showFormError(formType, message) {
    const errorElement = formType === 'login' ? dom.loginError : dom.registerError;
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => errorElement.style.display = 'none', 5000);
}

// API utilities
async function fetchCsrfToken() {
    try {
        const response = await fetch('/api/antiforgery/token', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch CSRF token');
        const { token } = await response.json();
        return token || document.querySelector('meta[name="csrf-token"]')?.content || '';
    } catch (error) {
        console.error('CSRF token fetch error:', error);
        return '';
    }
}

async function fetchWithCsrf(url, options = {}) {
    const csrfToken = await fetchCsrfToken();
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'X-CSRF-Token': csrfToken,
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    });
}

// Authentication
async function initializeApp() {
    showSpinner();
    try {
        await checkAuth();
    } catch (error) {
        showError('Initialization failed: ' + error.message, 'initializeApp');
    } finally {
        hideSpinner();
    }
}

async function checkAuth() {
    const response = await fetch('/api/account/checkauth', { credentials: 'include' });
    if (!response.ok) throw new Error('Authentication check failed');
    const data = await response.json();
    if (data.isAuthenticated) {
        dom.authSection.classList.add('authenticated');
        dom.authProtected.forEach(el => el.style.display = 'block');
        state.currentUserRole = data.role;
        if (data.role !== 'Manager') dom.addTaskForm.style.display = 'none';
        await Promise.all([loadUsers(), loadTasks(), loadCategories(), loadTags()]);
    } else {
        dom.authSection.classList.remove('authenticated');
        dom.authProtected.forEach(el => el.style.display = 'none');
    }
}

async function login() {
    const email = dom.loginForm.querySelector('#loginEmail')?.value.trim();
    const password = dom.loginForm.querySelector('#loginPassword')?.value;
    if (!email || !password) {
        showFormError('login', 'Email and password are required.');
        return;
    }

    try {
        const response = await fetchWithCsrf('/api/account/login', {
            method: 'POST',
            body: JSON.stringify({ Email: email, Password: password })
        });
        if (response.ok) {
            dom.loginForm.reset();
            await checkAuth();
        } else {
            const error = await response.text();
            showFormError('login', error || 'Login failed.');
        }
    } catch (error) {
        showFormError('login', 'Login error: ' + error.message);
    }
}

async function register() {
    const email = dom.registerForm.querySelector('#registerEmail')?.value.trim();
    const password = dom.registerForm.querySelector('#registerPassword')?.value;
    const confirmPassword = dom.registerForm.querySelector('#confirmPassword')?.value;
    if (!email || !password || !confirmPassword) {
        showFormError('register', 'All fields are required.');
        return;
    }
    if (password !== confirmPassword) {
        showFormError('register', 'Passwords do not match.');
        return;
    }

    try {
        const response = await fetchWithCsrf('/api/account/register', {
            method: 'POST',
            body: JSON.stringify({ Email: email, Password: password, ConfirmPassword: confirmPassword })
        });
        if (response.ok) {
            dom.registerForm.reset();
            showAuthForm('loginForm');
            await checkAuth();
        } else {
            const error = await response.text();
            showFormError('register', error.includes('email') ? 'Email already registered.' : error || 'Registration failed.');
        }
    } catch (error) {
        showFormError('register', 'Registration error: ' + error.message);
    }
}

async function logout() {
    try {
        const response = await fetchWithCsrf('/api/account/logout', { method: 'POST' });
        if (response.ok) {
            state.tasks = [];
            state.users = [];
            state.categories = [];
            state.tags = [];
            state.currentUserRole = '';
            await checkAuth();
        } else {
            showError('Logout failed.', 'logout');
        }
    } catch (error) {
        showError('Logout error: ' + error.message, 'logout');
    }
}

function showAuthForm(formId) {
    dom.loginForm.style.display = formId === 'loginForm' ? 'block' : 'none';
    dom.registerForm.style.display = formId === 'registerForm' ? 'block' : 'none';
}

// Data loading
async function loadUsers() {
    const response = await fetch('/api/users', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load users');
    state.users = await response.json();
    renderSelectOptions(dom.userSelect, state.users, 'Name', 'Id', 'Select User');
    renderSelectOptions(dom.editUserSelect, state.users, 'Name', 'Id', 'Select User');
    renderSelectOptions(dom.userFilter, state.users, 'Name', 'Id', 'All Users');
}

async function loadTasks() {
    const response = await fetch('/api/tasks', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load tasks');
    state.tasks = await response.json();
    renderFilteredTasks();
    updateStatistics();
    checkOverdueTasks();
}

async function loadCategories() {
    const response = await fetch('/api/categories', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load categories');
    state.categories = await response.json();
    renderSelectOptions(dom.taskCategory, state.categories, 'Name', 'Id', 'Select Category');
    renderSelectOptions(dom.editTaskCategory, state.categories, 'Name', 'Id', 'Select Category');
    renderSelectOptions(dom.categoryFilter, state.categories, 'Name', 'Id', 'All Categories');
}

async function loadTags() {
    const response = await fetch('/api/tags', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load tags');
    state.tags = await response.json();
    renderTagSelect(dom.taskTags);
    renderTagSelect(dom.editTaskTags);
    renderSelectOptions(dom.tagFilter, state.tags, 'Name', 'Id', 'All Tags');
}

// Rendering utilities
function renderSelectOptions(select, items, labelKey, valueKey, defaultLabel) {
    select.innerHTML = `<option value="">${defaultLabel}</option>`;
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item[labelKey];
        select.appendChild(option);
    });
}

function renderTagSelect(select) {
    select.innerHTML = '<option value="" disabled>Select Tags</option>';
    state.tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag.Id;
        option.textContent = tag.Name;
        select.appendChild(option);
    });
}

function renderFilteredTasks() {
    const query = dom.taskSearch.value.toLowerCase();
    const userId = dom.userFilter.value;
    const categoryId = dom.categoryFilter.value;
    const tagId = dom.tagFilter.value;
    const sort = dom.taskSort.value;

    let filteredTasks = state.tasks.filter(task => {
        const matchesSearch = task.Title.toLowerCase().includes(query) || (task.Description?.toLowerCase().includes(query));
        const matchesUser = !userId || task.UserId === parseInt(userId);
        const matchesCategory = !categoryId || task.CategoryId === parseInt(categoryId);
        const matchesTag = !tagId || task.TagIds?.includes(parseInt(tagId));
        return matchesSearch && matchesUser && matchesCategory && matchesTag;
    });

    if (sort === 'dueDate') {
        filteredTasks.sort((a, b) => new Date(a.DueDate) - new Date(b.DueDate));
    } else if (sort === 'progress') {
        filteredTasks.sort((a, b) => a.Progress - b.Progress);
    }

    dom.taskList.innerHTML = '';
    dom.completedTasksList.innerHTML = '';
    const activeTasks = filteredTasks.filter(task => !task.IsCompleted);
    const completedTasks = filteredTasks.filter(task => task.IsCompleted);

    if (activeTasks.length === 0) dom.taskList.innerHTML = '<li>No active tasks found.</li>';
    else activeTasks.forEach(task => dom.taskList.appendChild(createTaskElement(task)));

    if (completedTasks.length === 0) dom.completedTasksList.innerHTML = '<li>No completed tasks found.</li>';
    else completedTasks.forEach(task => dom.completedTasksList.appendChild(createTaskElement(task)));
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
        if (dueDate < new Date(now.setDate(now.getDate() + 1))) li.classList.add('urgent');
    }

    const tagNames = (task.TagIds || []).map(id => state.tags.find(tag => tag.Id === id)?.Name).filter(Boolean);
    const tagsHtml = tagNames.map(name => `<span class="tag">${name}</span>`).join('');

    li.innerHTML = `
        <div>
            ${task.Title}<br>
            <span class="task-details">${formatDate(task.DueDate)}</span>
            ${tagsHtml}
            <div class="progress-bar"><div class="progress-fill" style="width: ${task.Progress}%"></div></div>
        </div>
        <div class="task-actions">
            <button class="edit-btn" data-task-id="${task.Id}" aria-label="Edit task">Edit</button>
            <button class="complete-btn" data-task-id="${task.Id}" aria-label="${task.IsCompleted ? 'Unmark as complete' : 'Mark as complete'}">${task.IsCompleted ? 'Unmark' : 'Complete'}</button>
            <button class="delete-btn" data-task-id="${task.Id}" aria-label="Delete task">Delete</button>
            <button class="details-btn" data-task-id="${task.Id}" aria-label="View task details">Details</button>
        </div>
    `;
    return li;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

// Task management
async function addTaskWithSpinner() {
    await addTask();
}

async function addTask() {
    dom.taskSpinner.style.display = 'inline-block';
    try {
        const taskData = validateTaskForm();
        if (!taskData) return;
        const response = await fetchWithCsrf('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
        if (!response.ok) throw new Error(await response.text());
        const newTask = await response.json();
        state.tasks.unshift(newTask);
        resetTaskForm();
        renderFilteredTasks();
        updateStatistics();
        dom.taskSuccess.style.display = 'block';
        setTimeout(() => dom.taskSuccess.style.display = 'none', 3000);
    } catch (error) {
        showError('Error adding task: ' + error.message, 'addTask');
    } finally {
        dom.taskSpinner.style.display = 'none';
    }
}

function validateTaskForm(isEdit = false) {
    const form = isEdit ? dom.editModal : dom.addTaskForm;
    const title = form.querySelector(isEdit ? '#editTaskTitle' : '#taskTitle').value.trim();
    const description = form.querySelector(isEdit ? '#editTaskDesc' : '#taskDesc').value.trim();
    const dueDate = form.querySelector(isEdit ? '#editTaskDueDate' : '#taskDueDate').value;
    const userId = form.querySelector(isEdit ? '#editUserSelect' : '#userSelect')?.value;
    const categoryId = form.querySelector(isEdit ? '#editTaskCategory' : '#taskCategory')?.value;
    const tags = form.querySelector(isEdit ? '#editTaskTags' : '#taskTags');
    const progress = parseInt(form.querySelector(isEdit ? '#editTaskProgress' : '#taskProgress').value) || 0;

    if (!title || !dueDate) {
        showError('Title and Due Date are required.', 'validateTaskForm');
        return null;
    }
    const dateObj = new Date(dueDate);
    if (isNaN(dateObj.getTime())) {
        showError('Invalid Due Date.', 'validateTaskForm');
        return null;
    }
    if (progress < 0 || progress > 100) {
        showError('Progress must be between 0 and 100.', 'validateTaskForm');
        return null;
    }

    return {
        Title: title,
        Description: description,
        DueDate: dateObj.toISOString(),
        IsCompleted: false,
        UserId: userId ? parseInt(userId) : null,
        CategoryId: categoryId ? parseInt(categoryId) : null,
        Notes: '',
        Progress: progress,
        TagIds: Array.from(tags.selectedOptions).map(opt => parseInt(opt.value)).filter(id => !isNaN(id))
    };
}

function resetTaskForm() {
    dom.taskTitle.value = '';
    dom.taskDesc.value = '';
    dom.taskDueDate.value = '';
    dom.taskCategory.value = '';
    dom.taskTags.selectedIndex = -1;
    dom.taskProgress.value = '0';
}

async function toggleTaskCompletion(taskId) {
    const task = state.tasks.find(t => t.Id === taskId);
    if (!task) {
        showError('Task not found.', 'toggleTaskCompletion');
        return;
    }

    const originalState = task.IsCompleted;
    task.IsCompleted = !task.IsCompleted;
    try {
        const response = await fetchWithCsrf(`/api/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(task)
        });
        if (!response.ok) throw new Error(await response.text());
        await loadTasks();
    } catch (error) {
        task.IsCompleted = originalState;
        showError('Error toggling task: ' + error.message, 'toggleTaskCompletion');
    }
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        const response = await fetchWithCsrf(`/api/tasks/${taskId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(await response.text());
        state.tasks = state.tasks.filter(t => t.Id !== taskId);
        renderFilteredTasks();
        updateStatistics();
    } catch (error) {
        showError('Error deleting task: ' + error.message, 'deleteTask');
    }
}

// Modal management
function openModal(modalId, taskId = null) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = 'flex';
    trapFocus(modalId);

    if (modalId === 'editModal' && taskId) {
        const task = state.tasks.find(t => t.Id === taskId);
        if (!task) {
            showError('Task not found.', 'openEditModal');
            closeModal(modalId);
            return;
        }
        dom.editTaskTitle.value = task.Title;
        dom.editTaskDesc.value = task.Description || '';
        dom.editTaskDueDate.value = new Date(task.DueDate).toISOString().split('T')[0];
        dom.editUserSelect.value = task.UserId || '';
        dom.editTaskCategory.value = task.CategoryId || '';
        dom.editTaskProgress.value = task.Progress;
        Array.from(dom.editTaskTags.options).forEach(opt => {
            opt.selected = task.TagIds?.includes(parseInt(opt.value));
        });
        modal.dataset.taskId = taskId;
    } else if (modalId === 'detailsModal' && taskId) {
        const task = state.tasks.find(t => t.Id === taskId);
        if (!task) {
            showError('Task not found.', 'openDetailsModal');
            closeModal(modalId);
            return;
        }
        dom.detailsTaskTitle.textContent = task.Title;
        dom.detailsTaskDesc.textContent = task.Description || 'No description';
        dom.detailsTaskDueDate.textContent = formatDate(task.DueDate);
        dom.detailsTaskUser.textContent = state.users.find(u => u.Id === task.UserId)?.Name || 'Unassigned';
        dom.detailsTaskCategory.textContent = state.categories.find(c => c.Id === task.CategoryId)?.Name || 'No category';
        dom.detailsTaskTags.textContent = task.TagIds?.map(id => state.tags.find(t => t.Id === id)?.Name).filter(Boolean).join(', ') || 'No tags';
        dom.detailsTaskProgress.textContent = `${task.Progress}%`;
        dom.detailsTaskStatus.textContent = task.IsCompleted ? 'Completed' : 'Active';
        dom.detailsTaskNotes.value = task.Notes || '';
        dom.detailsTaskNotes.dataset.taskId = taskId;
    } else if (modalId === 'addItemModal') {
        dom.addItemModalTitle.textContent = `Add ${state.currentItemType}`;
        dom.addItemName.focus();
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = 'none';
    if (modalId === 'addItemModal') {
        dom.addItemName.value = '';
        state.currentItemType = '';
    }
}

async function saveTaskChanges() {
    const taskId = parseInt(dom.editModal.dataset.taskId);
    const taskData = validateTaskForm(true);
    if (!taskData) return;

    const task = state.tasks.find(t => t.Id === taskId);
    if (!task) {
        showError('Task not found.', 'saveTaskChanges');
        return;
    }

    Object.assign(task, taskData);
    try {
        const response = await fetchWithCsrf(`/api/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(task)
        });
        if (!response.ok) throw new Error(await response.text());
        await loadTasks();
        closeModal('editModal');
    } catch (error) {
        showError('Error saving task: ' + error.message, 'saveTaskChanges');
    }
}

async function saveTaskNotes() {
    const taskId = parseInt(dom.detailsTaskNotes.dataset.taskId);
    const task = state.tasks.find(t => t.Id === taskId);
    if (!task) {
        showError('Task not found.', 'saveTaskNotes');
        return;
    }

    task.Notes = dom.detailsTaskNotes.value;
    try {
        const response = await fetchWithCsrf(`/api/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(task)
        });
        if (!response.ok) throw new Error(await response.text());
        await loadTasks();
        closeModal('detailsModal');
    } catch (error) {
        showError('Error saving notes: ' + error.message, 'saveTaskNotes');
    }
}

// Category and Tag management
function openAddItemModal(type) {
    state.currentItemType = type;
    openModal('addItemModal');
}

async function saveNewItem() {
    const name = dom.addItemName.value.trim();
    if (!name) {
        showError('Name is required.', 'saveNewItem');
        return;
    }

    const endpoint = state.currentItemType === 'Category' ? '/api/categories' : '/api/tags';
    // Include TaskTags to bypass backend validation error
    const payload = { Name: name, TaskTags: [] };
    try {
        dom.saveItemBtn.disabled = true; // Prevent multiple submissions
        const response = await fetchWithCsrf(endpoint, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.errors?.TaskTags?.[0] || errorData.title || 'Failed to add item';
            throw new Error(errorMessage);
        }
        await (state.currentItemType === 'Category' ? loadCategories() : loadTags());
        closeModal('addItemModal');
    } catch (error) {
        showError(`Error adding ${state.currentItemType.toLowerCase()}: ${error.message}`, 'saveNewItem');
    } finally {
        dom.saveItemBtn.disabled = false;
    }
}

// Filter management
function clearFilters() {
    dom.taskSearch.value = '';
    dom.userFilter.value = '';
    dom.categoryFilter.value = '';
    dom.tagFilter.value = '';
    dom.taskSort.value = '';
    renderFilteredTasks();
}

// Statistics and notifications
function updateStatistics() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.IsCompleted).length;
    const overdue = state.tasks.filter(t => !t.IsCompleted && new Date(t.DueDate) < new Date()).length;
    const active = total - completed;

    dom.totalTasks.textContent = total;
    dom.completedTasks.textContent = completed;
    dom.overdueTasks.textContent = overdue;
    dom.activeTasks.textContent = active;
}

function checkOverdueTasks() {
    dom.overdueNotification.style.display = state.tasks.some(t => !t.IsCompleted && new Date(t.DueDate) < new Date()) ? 'block' : 'none';
}

// Drag-and-drop
function setupDragAndDrop() {
    [dom.activeTasksZone, dom.completedTasksZone].forEach(zone => {
        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', async e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const taskId = parseInt(e.dataTransfer.getData('text/plain'));
            const isCompleted = zone.id === 'completedTasksZone';
            const task = state.tasks.find(t => t.Id === taskId);
            if (task && task.IsCompleted !== isCompleted) {
                task.IsCompleted = isCompleted;
                await toggleTaskCompletion(taskId);
            }
        });
    });

    document.addEventListener('dragstart', e => {
        if (e.target.tagName === 'LI') {
            e.dataTransfer.setData('text/plain', e.target.id.replace('task-', ''));
            e.target.classList.add('dragging');
        }
    });

    document.addEventListener('dragend', e => {
        if (e.target.tagName === 'LI') e.target.classList.remove('dragging');
    });
}

// Export to CSV
function exportToCSV() {
    const headers = ['Title', 'Description', 'Due Date', 'User', 'Category', 'Tags', 'Progress', 'Status', 'Notes'];
    const rows = state.tasks.map(task => [
        `"${task.Title.replace(/"/g, '""')}"`,
        `"${(task.Description || '').replace(/"/g, '""')}"`,
        formatDate(task.DueDate),
        state.users.find(u => u.Id === task.UserId)?.Name || 'Unassigned',
        state.categories.find(c => c.Id === task.CategoryId)?.Name || 'No category',
        task.TagIds?.map(id => state.tags.find(t => t.Id === id)?.Name).filter(Boolean).join(', ') || 'No tags',
        task.Progress,
        task.IsCompleted ? 'Completed' : 'Active',
        `"${(task.Notes || '').replace(/"/g, '""')}"`
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// Accessibility
function trapFocus(modalId) {
    const modal = document.getElementById(modalId);
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    modal.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        } else if (e.key === 'Escape') {
            closeModal(modalId);
        }
    });

    first.focus();
}

// Event listeners
function setupEventListeners() {
    dom.themeToggle.addEventListener('click', toggleTheme);
    dom.exportButton.addEventListener('click', exportToCSV);
    dom.loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        await login();
    });
    dom.registerForm.addEventListener('submit', async e => {
        e.preventDefault();
        await register();
    });
    dom.addTaskForm.addEventListener('submit', async e => {
        e.preventDefault();
        await addTask();
    });
    document.getElementById('logoutButton')?.addEventListener('click', logout);
    document.getElementById('addCategory')?.addEventListener('click', () => openAddItemModal('Category'));
    document.getElementById('addTag')?.addEventListener('click', () => openAddItemModal('Tag'));
    document.getElementById('saveItemBtn')?.addEventListener('click', saveNewItem);
    document.getElementById('cancelItemBtn')?.addEventListener('click', () => closeModal('addItemModal'));
    document.getElementById('saveTaskBtn')?.addEventListener('click', saveTaskChanges);
    document.getElementById('cancelEditBtn')?.addEventListener('click', () => closeModal('editModal'));
    document.getElementById('saveNotesBtn')?.addEventListener('click', saveTaskNotes);
    document.getElementById('closeDetailsBtn')?.addEventListener('click', () => closeModal('detailsModal'));
    document.getElementById('clearFilters')?.addEventListener('click', clearFilters);
    dom.editFromDetailsBtn.addEventListener('click', () => {
        const taskId = parseInt(dom.detailsTaskNotes.dataset.taskId);
        closeModal('detailsModal');
        openModal('editModal', taskId);
    });

    let searchTimeout;
    dom.taskSearch.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(renderFilteredTasks, 300);
    });
    dom.taskSearch.addEventListener('keydown', e => {
        if (e.key === 'Enter') renderFilteredTasks();
    });
    [dom.userFilter, dom.categoryFilter, dom.tagFilter, dom.taskSort].forEach(el => {
        el.addEventListener('change', renderFilteredTasks);
    });

    [dom.taskList, dom.completedTasksList].forEach(list => {
        list.addEventListener('click', async e => {
            const taskId = parseInt(e.target.dataset.taskId);
            if (!taskId) return;
            if (e.target.classList.contains('edit-btn')) openModal('editModal', taskId);
            else if (e.target.classList.contains('complete-btn')) await toggleTaskCompletion(taskId);
            else if (e.target.classList.contains('delete-btn')) await deleteTask(taskId);
            else if (e.target.classList.contains('details-btn')) openModal('detailsModal', taskId);
        });
    });

    setupDragAndDrop();
}