// State management
const state = {
    tasks: [],
    users: [],
    categories: [],
    tags: [],
    currentUserRole: '',
    currentItemType: '',
    currentUser: null
};
window.state = state;

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
    statsPanel: document.getElementById('statsPanel'),
    saveItemBtn: document.getElementById('saveItemBtn')
};

// Global Choices.js instances
let taskTagsInstance;
let editTaskTagsInstance;

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

function showError(message, context = '') {
    console.error(`${context ? context + ': ' : ''}${message}`);
    dom.globalError.textContent = message;
    dom.globalError.style.display = 'block';
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
        state.currentUser = { Id: parseInt(data.userId), Name: data.userName };
        if (data.role !== 'Manager') dom.addTaskForm.style.display = 'none';
        await Promise.all([loadUsers(), loadTasks(), loadCategories(), loadTags()]);
    } else {
        dom.authSection.classList.remove('authenticated');
        dom.authProtected.forEach(el => el.style.display = 'none');
    }
}

async function login() {
    const email = dom.loginForm.querySelector('#loginEmail').value.trim();
    const password = dom.loginForm.querySelector('#loginPassword').value;

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
            dom.loginForm.querySelector('#loginEmail').value = '';
            dom.loginForm.querySelector('#loginPassword').value = '';
            dom.loginError.style.display = 'none';
            await checkAuth();
        } else {
            const errorData = await response.json();
            showFormError('login', errorData.message || 'Login failed.');
        }
    } catch (error) {
        showFormError('login', 'Login error: ' + error.message);
    }
}

async function register() {
    const email = dom.registerForm.querySelector('#registerEmail').value.trim();
    const name = dom.registerForm.querySelector('#registerName').value.trim();
    const password = dom.registerForm.querySelector('#registerPassword').value;
    const confirmPassword = dom.registerForm.querySelector('#registerConfirmPassword').value;
    const role = dom.registerForm.querySelector('#registerRole').value;

    try {
        if (!email || !name || !password || !confirmPassword || !role) {
            throw new Error('All fields are required');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Invalid email format');
        }
        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }
        if (!['Manager', 'Worker'].includes(role)) {
            throw new Error('Invalid role selected');
        }
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        const payload = { Email: email, Name: name, Password: password, ConfirmPassword: confirmPassword, Role: role };
        const response = await fetchWithCsrf('/api/account/register', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            dom.registerForm.querySelector('#registerEmail').value = '';
            dom.registerForm.querySelector('#registerName').value = '';
            dom.registerForm.querySelector('#registerPassword').value = '';
            dom.registerForm.querySelector('#registerConfirmPassword').value = '';
            dom.registerForm.querySelector('#registerRole').selectedIndex = 0;
            dom.registerError.style.display = 'none';
            dom.registerForm.style.display = 'none';
            showAuthForm('loginForm');
            alert('Registration successful! Please log in.');
        } else {
            const errorData = await response.json();
            showFormError('register', errorData.message || errorData.errors?.join(', ') || 'Registration failed');
        }
    } catch (error) {
        showFormError('register', error.message);
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
            state.currentUser = null;
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
    try {
        const response = await fetch('/api/users', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to load users');
        state.users = await response.json();
        renderSelectOptions(dom.userSelect, state.users, 'Name', 'Id', 'Select User');
        renderSelectOptions(dom.editUserSelect, state.users, 'Name', 'Id', 'Select User');
        renderSelectOptions(dom.userFilter, state.users, 'Name', 'Id', 'All Users');
    } catch (error) {
        showError('Error loading users: ' + error.message, 'loadUsers');
    }
}

async function loadTasks() {
    try {
        const response = await fetch('/api/tasks', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to load tasks');
        state.tasks = await response.json();
        renderFilteredTasks();
        updateStatistics();
        checkOverdueTasks();
    } catch (error) {
        showError('Error loading tasks: ' + error.message, 'loadTasks');
    }
}

async function loadCategories() {
    try {
        const response = await fetch('/api/categories', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to load categories');
        state.categories = await response.json();
        renderSelectOptions(dom.taskCategory, state.categories, 'Name', 'Id', 'Select Category');
        renderSelectOptions(dom.editTaskCategory, state.categories, 'Name', 'Id', 'Select Category');
        renderSelectOptions(dom.categoryFilter, state.categories, 'Name', 'Id', 'All Categories');
    } catch (error) {
        showError('Error loading categories: ' + error.message, 'loadCategories');
    }
}

async function loadTags() {
    try {
        const response = await fetchWithCsrf('/api/tags');
        if (!response.ok) throw new Error('Failed to load tags');
        state.tags = await response.json();
        renderSelectOptions(dom.taskTags, state.tags, 'Name', 'Id', 'Select Tags', true);
        renderSelectOptions(dom.editTaskTags, state.tags, 'Name', 'Id', 'Select Tags', true);
        renderSelectOptions(dom.tagFilter, [{ Id: '', Name: 'All Tags' }, ...state.tags], 'Name', 'Id', 'All Tags');

        // Initialize Choices.js to match native select styling
        if (taskTagsInstance) taskTagsInstance.destroy();
        taskTagsInstance = new Choices('#taskTags', {
            placeholderValue: 'Select Tags',
            allowHTML: false,
            removeItemButton: true,
            maxItemCount: 5,
            searchEnabled: true,
            classNames: {
                containerOuter: 'choices',
                containerInner: 'choices__inner',
                input: 'choices__input',
                inputCloned: 'choices__input--cloned',
                list: 'choices__list',
                listItems: 'choices__list--multiple',
                listSingle: 'choices__list--single',
                listDropdown: 'choices__list--dropdown',
                item: 'choices__item',
                itemSelectable: 'choices__item--selectable',
                itemDisabled: 'choices__item--disabled',
                itemChoice: 'choices__item--choice',
                placeholder: 'choices__placeholder',
                group: 'choices__group',
                groupHeading: 'choices__heading',
                button: 'choices__button'
            },
            itemSelectText: ''
        });

        if (editTaskTagsInstance) editTaskTagsInstance.destroy();
        editTaskTagsInstance = new Choices('#editTaskTags', {
            placeholderValue: 'Select Tags',
            allowHTML: false,
            removeItemButton: true,
            maxItemCount: 5,
            searchEnabled: true,
            classNames: {
                containerOuter: 'choices',
                containerInner: 'choices__inner',
                input: 'choices__input',
                inputCloned: 'choices__input--cloned',
                list: 'choices__list',
                listItems: 'choices__list--multiple',
                listSingle: 'choices__list--single',
                listDropdown: 'choices__list--dropdown',
                item: 'choices__item',
                itemSelectable: 'choices__item--selectable',
                itemDisabled: 'choices__item--disabled',
                itemChoice: 'choices__item--choice',
                placeholder: 'choices__placeholder',
                group: 'choices__group',
                groupHeading: 'choices__heading',
                button: 'choices__button'
            },
            itemSelectText: ''
        });
    } catch (error) {
        showError('Error loading tags: ' + error.message, 'loadTags');
    }
}

// Rendering utilities
function renderSelectOptions(select, items, labelKey, valueKey, defaultLabel, multiple = false) {
    select.innerHTML = `<option value="" disabled ${!multiple ? 'selected' : ''}>${defaultLabel}</option>`;
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item[labelKey];
        select.appendChild(option);
    });
    if (multiple) select.multiple = true;
}

function renderFilteredTasks() {
    const query = dom.taskSearch.value.toLowerCase();
    const status = dom.taskFilter.value;
    const userId = dom.userFilter.value;
    const categoryId = dom.categoryFilter.value;
    const tagId = dom.tagFilter.value ? parseInt(dom.tagFilter.value) : null;
    const sort = dom.taskSort.value;

    let filteredTasks = state.tasks.filter(task => {
        const matchesSearch = task.Title.toLowerCase().includes(query) || (task.Description?.toLowerCase().includes(query));
        const matchesStatus = status === 'all' || (status === 'completed' && task.IsCompleted) || (status === 'incomplete' && !task.IsCompleted);
        const matchesUser = !userId || task.UserId === parseInt(userId);
        const matchesCategory = !categoryId || task.CategoryId === parseInt(categoryId);
        const matchesTag = !tagId || task.TagIds?.includes(tagId);
        return matchesSearch && matchesStatus && matchesUser && matchesCategory && matchesTag;
    });

    if (sort === 'dueDateAsc') {
        filteredTasks.sort((a, b) => new Date(a.DueDate) - new Date(b.DueDate));
    } else if (sort === 'dueDateDesc') {
        filteredTasks.sort((a, b) => new Date(b.DueDate) - new Date(a.DueDate));
    } else if (sort === 'progressAsc') {
        filteredTasks.sort((a, b) => a.Progress - b.Progress);
    } else if (sort === 'progressDesc') {
        filteredTasks.sort((a, b) => b.Progress - a.Progress);
    }

    dom.taskList.innerHTML = '';
    dom.completedTasksList.innerHTML = '';
    const activeTasks = filteredTasks.filter(task => !task.IsCompleted);
    const completedTasks = filteredTasks.filter(task => task.IsCompleted);

    if (activeTasks.length === 0) dom.taskList.innerHTML = '<li>No active tasks.</li>';
    else activeTasks.forEach(task => dom.taskList.appendChild(createTaskElement(task)));

    if (completedTasks.length === 0) dom.completedTasksList.innerHTML = '<li>No completed tasks.</li>';
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
    dom.taskSpinner.style.display = 'inline-block';
    dom.addTaskForm.querySelector('button[aria-label="Add task"]').disabled = true;
    try {
        await addTask();
    } catch (error) {
        showError('Error adding task: ' + error.message, 'addTaskWithSpinner');
    } finally {
        dom.taskSpinner.style.display = 'none';
        dom.addTaskForm.querySelector('button[aria-label="Add task"]').disabled = false;
    }
}

async function addTask() {
    const taskData = validateTaskForm();
    if (!taskData) return;

    const response = await fetchWithCsrf('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add task');
    }

    await loadTasks();
    resetTaskForm();
}

function validateTaskForm(isEdit = false) {
    const form = isEdit ? dom.editModal : dom.addTaskForm;
    const title = form.querySelector(isEdit ? '#editTaskTitle' : '#taskTitle').value.trim();
    const description = form.querySelector(isEdit ? '#editTaskDesc' : '#taskDesc').value.trim();
    const dueDate = form.querySelector(isEdit ? '#editTaskDueDate' : '#taskDueDate').value;
    const userId = form.querySelector(isEdit ? '#editUserSelect' : '#userSelect')?.value;
    const categoryId = form.querySelector(isEdit ? '#editTaskCategory' : '#taskCategory')?.value;
    const tags = isEdit ? editTaskTagsInstance.getValue(true).map(item => parseInt(item)) : taskTagsInstance.getValue(true).map(item => parseInt(item));
    const progress = parseInt(form.querySelector(isEdit ? '#editTaskProgress' : '#taskProgress').value) || 0;

    if (!title || !dueDate) {
        showError('Title and due date are required.', 'validateTaskForm');
        return null;
    }
    const dateObj = new Date(dueDate);
    if (isNaN(dateObj.getTime())) {
        showError('Invalid due date.', 'validateTaskForm');
        return null;
    }
    if (progress < 0 || progress > 100) {
        showError('Progress must be between 0 and 100.', 'validateTaskForm');
        return null;
    }
    if (userId && !state.users.some(u => u.Id === parseInt(userId))) {
        showError('Invalid user selected.', 'validateTaskForm');
        return null;
    }
    if (categoryId && !state.categories.some(c => c.Id === parseInt(categoryId))) {
        showError('Invalid category selected.', 'validateTaskForm');
        return null;
    }
    if (tags.length > 0 && !tags.every(tag => state.tags.some(t => t.Id === tag))) {
        showError('Invalid tag selected.', 'validateTaskForm');
        return null;
    }
    if (userId && parseInt(userId) === state.currentUser?.Id) {
        showError('Cannot assign task to yourself.', 'validateTaskForm');
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
        TagIds: tags
    };
}

function resetTaskForm() {
    dom.taskTitle.value = '';
    dom.taskDesc.value = '';
    dom.taskDueDate.value = '';
    dom.userSelect.value = '';
    dom.taskCategory.value = '';
    taskTagsInstance.clearChoices();
    taskTagsInstance.setChoiceByValue([]);
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
        editTaskTagsInstance.setChoiceByValue(task.TagIds || []);
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
    if (modalId === 'editModal') {
        delete modal.dataset.taskId;
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
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save task');
        }
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
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save notes');
        }
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

    const existingItems = state.currentItemType === 'category' ? state.categories : state.tags;
    if (existingItems.some(item => item.Name.toLowerCase() === name.toLowerCase())) {
        showError(`${state.currentItemType} already exists.`, 'saveNewItem');
        return;
    }

    dom.saveItemBtn.disabled = true;
    const endpoint = state.currentItemType === 'category' ? '/api/categories' : '/api/tags';
    const payload = { Name: name, TaskTags: [] };
    try {
        const response = await fetchWithCsrf(endpoint, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to add item');
        }
        await (state.currentItemType === 'category' ? loadCategories() : loadTags());
        closeModal('addItemModal');
    } catch (error) {
        showError(`Error adding ${state.currentItemType.toLowerCase()}: ${error.message}`, 'saveNewItem');
    } finally {
        dom.saveItemBtn.disabled = false;
    }
}

// Filter management
function searchTasks() {
    renderFilteredTasks();
}

function filterTasks() {
    renderFilteredTasks();
}

function sortTasks() {
    renderFilteredTasks();
}

function clearFilters() {
    dom.taskSearch.value = '';
    dom.taskFilter.value = 'all';
    dom.userFilter.value = '';
    dom.categoryFilter.value = '';
    dom.tagFilter.value = '';
    dom.taskSort.value = 'default';
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
            zone.classList.add('dragover');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', async e => {
            e.preventDefault();
            zone.classList.remove('dragover');
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
    const headers = ['Id', 'Title', 'Description', 'Due Date', 'Assigned To', 'Category', 'Tags', 'Progress', 'Status'];
    const rows = state.tasks.map(task => [
        task.Id,
        `"${task.Title.replace(/"/g, '""')}"`,
        `"${task.Description ? task.Description.replace(/"/g, '""') : ''}"`,
        formatDate(task.DueDate),
        state.users.find(u => u.Id === task.UserId)?.Name || 'Unassigned',
        state.categories.find(c => c.Id === task.CategoryId)?.Name || 'No category',
        task.TagIds?.map(id => state.tags.find(t => t.Id === id)?.Name).filter(Boolean).join(', ') || 'No tags',
        task.Progress,
        task.IsCompleted ? 'Completed' : 'Active'
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'tasks.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

// Accessibility: Trap focus in modals
function trapFocus(modalId) {
    const modal = document.getElementById(modalId);
    const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    modal.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    });

    firstElement.focus();
}

// Event listeners
function setupEventListeners() {
    dom.themeToggle.addEventListener('click', toggleTheme);
    dom.taskList.addEventListener('click', e => {
        const taskId = parseInt(e.target.dataset.taskId);
        if (e.target.classList.contains('edit-btn')) openModal('editModal', taskId);
        else if (e.target.classList.contains('complete-btn')) toggleTaskCompletion(taskId);
        else if (e.target.classList.contains('delete-btn')) deleteTask(taskId);
        else if (e.target.classList.contains('details-btn')) openModal('detailsModal', taskId);
    });
    dom.completedTasksList.addEventListener('click', e => {
        const taskId = parseInt(e.target.dataset.taskId);
        if (e.target.classList.contains('edit-btn')) openModal('editModal', taskId);
        else if (e.target.classList.contains('complete-btn')) toggleTaskCompletion(taskId);
        else if (e.target.classList.contains('delete-btn')) deleteTask(taskId);
        else if (e.target.classList.contains('details-btn')) openModal('detailsModal', taskId);
    });
    dom.editFromDetailsBtn.addEventListener('click', () => {
        const taskId = parseInt(dom.detailsTaskNotes.dataset.taskId);
        closeModal('detailsModal');
        openModal('editModal', taskId);
    });
    dom.taskSearch.addEventListener('input', searchTasks);
    dom.taskFilter.addEventListener('change', filterTasks);
    dom.userFilter.addEventListener('change', filterTasks);
    dom.categoryFilter.addEventListener('change', filterTasks);
    dom.tagFilter.addEventListener('change', filterTasks);
    dom.taskSort.addEventListener('change', sortTasks);
    setupDragAndDrop();
}