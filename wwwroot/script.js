let usersList = [];
let tasksList = [];
let currentEditTaskId = null;

async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        if (!response.ok) {
            throw new Error('Failed to load users: ' + response.statusText);
        }
        usersList = await response.json();
        console.log('Users response:', usersList);
        usersList.forEach(user => console.log('User:', user));
        const userSelect = document.getElementById('userSelect');
        const editUserSelect = document.getElementById('editUserSelect');
        userSelect.innerHTML = '<option value="">Select User</option>';
        editUserSelect.innerHTML = '<option value="">Select User</option>';
        if (usersList.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No users available";
            option.disabled = true;
            userSelect.appendChild(option);
            editUserSelect.appendChild(option.cloneNode(true));
        } else {
            usersList.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id || user.Id;
                option.textContent = user.name || user.Name || 'Unnamed User';
                userSelect.appendChild(option);
                editUserSelect.appendChild(option.cloneNode(true));
            });
        }
    } catch (error) {
        console.error('Error loading users:', error);
        alert('Error loading users: ' + error.message);
    }
}

async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        if (!response.ok) {
            throw new Error('Failed to load tasks: ' + response.statusText);
        }
        tasksList = await response.json();
        console.log('Tasks response:', tasksList);
        checkOverdueTasks();
        updateStatistics();
        renderTasks(tasksList);
    } catch (error) {
        console.error('Error loading tasks:', error);
        alert('Error loading tasks: ' + error.message);
    }
}

function renderTasks(tasks) {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    tasks.forEach(task => {
        const taskId = task.id || task.Id;
        if (!taskId) {
            console.error('Task ID is missing:', task);
            return;
        }
        const assignedUser = usersList.find(user => (user.id || user.Id) === (task.userId || task.UserId));
        const assignedUserName = assignedUser ? (assignedUser.name || assignedUser.Name || 'Unnamed User') : 'Unassigned';
        const li = document.createElement('li');
        li.className = task.isCompleted || task.IsCompleted ? 'completed' : '';
        const dueDate = new Date(task.dueDate || task.DueDate);
        const now = new Date();
        const timeDiff = dueDate - now;
        const daysDiff = timeDiff / (1000 * 3600 * 24);
        if (daysDiff < 2 && daysDiff >= 0 && !(task.isCompleted || task.IsCompleted)) {
            li.classList.add('urgent');
        }
        if (daysDiff < 0 && !(task.isCompleted || task.IsCompleted)) {
            li.classList.add('overdue');
        }
        li.innerHTML = `
            ${task.title || task.Title} (Due: ${task.dueDate || task.DueDate}, Assigned to: ${assignedUserName})
            <button class="edit" onclick="openEditModal(${taskId})">Edit</button>
            <button onclick="toggleComplete(${taskId}, ${task.isCompleted || task.IsCompleted})">${(task.isCompleted || task.IsCompleted) ? 'Undo' : 'Complete'}</button>
            <button onclick="deleteTask(${taskId})">Delete</button>
        `;
        taskList.appendChild(li);
    });
}

function checkOverdueTasks() {
    const now = new Date();
    const overdueTasks = tasksList.filter(task => {
        const dueDate = new Date(task.dueDate || task.DueDate);
        return dueDate < now && !(task.isCompleted || task.IsCompleted);
    });
    const notification = document.getElementById('overdueNotification');
    if (overdueTasks.length > 0) {
        notification.style.display = 'block';
    } else {
        notification.style.display = 'none';
    }
}

function updateStatistics() {
    const now = new Date();
    const completedTasks = tasksList.filter(task => task.isCompleted || task.IsCompleted).length;
    const overdueTasks = tasksList.filter(task => {
        const dueDate = new Date(task.dueDate || task.DueDate);
        return dueDate < now && !(task.isCompleted || task.IsCompleted);
    }).length;
    const activeTasks = tasksList.filter(task => {
        const dueDate = new Date(task.dueDate || task.DueDate);
        return dueDate >= now || task.isCompleted || task.IsCompleted;
    }).length - completedTasks;
    const totalTasks = tasksList.length;

    document.getElementById('totalTasks').textContent = totalTasks;
    document.getElementById('completedTasks').textContent = completedTasks;
    document.getElementById('overdueTasks').textContent = overdueTasks;
    document.getElementById('activeTasks').textContent = activeTasks;
}

async function addUser() {
    const name = document.getElementById('userName').value.trim();
    if (!name) {
        alert('User name is required.');
        return;
    }
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Name: name })
        });
        if (response.ok) {
            loadUsers();
            document.getElementById('userName').value = '';
        } else {
            const error = await response.json();
            alert('Error: ' + JSON.stringify(error));
        }
    } catch (error) {
        console.error('Error adding user:', error);
        alert('Error adding user: ' + error.message);
    }
}

async function addTask() {
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDesc').value.trim();
    const dueDate = document.getElementById('taskDueDate').value;
    const userId = document.getElementById('userSelect').value;

    if (!title || title === "") {
        alert('Title is required and cannot be empty.');
        return;
    }
    if (!dueDate || dueDate === "") {
        alert('Due Date is required.');
        return;
    }
    const dateObj = new Date(dueDate);
    if (isNaN(dateObj.getTime())) {
        alert('Due Date must be a valid date (e.g., YYYY-MM-DD).');
        return;
    }

    let parsedUserId = null;
    if (userId && userId !== "") {
        parsedUserId = parseInt(userId);
        if (isNaN(parsedUserId)) {
            alert('Invalid User ID.');
            return;
        }
    }

    const taskData = {
        Title: title,
        Description: description,
        DueDate: dateObj.toISOString().split('T')[0],
        IsCompleted: false,
        UserId: parsedUserId
    };
    console.log('Task data being sent:', taskData);

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        if (response.ok) {
            loadTasks();
            document.getElementById('taskTitle').value = '';
            document.getElementById('taskDesc').value = '';
            document.getElementById('taskDueDate').value = '';
        } else {
            const error = await response.json();
            console.log('Error details:', error);
            alert('Error: ' + JSON.stringify(error, null, 2));
        }
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Error adding task: ' + error.message);
    }
}

async function toggleComplete(id, isCompleted) {
    if (!id || isNaN(parseInt(id))) {
        console.error('Invalid task ID:', id);
        alert('Invalid task ID. Please try again.');
        return;
    }
    const response = await fetch(`/api/tasks/${id}`);
    if (!response.ok) {
        throw new Error('Failed to fetch task: ' + response.statusText);
    }
    const taskData = await response.json();
    const description = taskData.description || taskData.Description || "";
    try {
        const task = {
            Id: id,
            IsCompleted: !isCompleted,
            Title: "Placeholder",
            DueDate: "2025-01-01",
            Description: description
        };
        console.log('Task data being sent for PUT:', task);
        const putResponse = await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        });
        if (putResponse.ok) loadTasks();
        else {
            const error = await putResponse.json();
            console.log('Error details:', error);
            alert('Error: ' + JSON.stringify(error));
        }
    } catch (error) {
        console.error('Error toggling task completion:', error);
        alert('Error toggling task completion: ' + error.message);
    }
}

async function deleteTask(id) {
    if (!id || isNaN(parseInt(id))) {
        console.error('Invalid task ID:', id);
        alert('Invalid task ID. Please try again.');
        return;
    }
    try {
        const response = await fetch(`/api/tasks/${id}`, {
            method: 'DELETE'
        });
        if (response.ok) loadTasks();
        else {
            const error = await response.json();
            alert('Error: ' + JSON.stringify(error));
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Error deleting task: ' + error.message);
    }
}

function filterTasks() {
    const filter = document.getElementById('taskFilter').value;
    let filteredTasks = [...tasksList];
    if (filter === 'completed') {
        filteredTasks = tasksList.filter(task => task.isCompleted || task.IsCompleted);
    } else if (filter === 'incomplete') {
        filteredTasks = tasksList.filter(task => !(task.isCompleted || task.IsCompleted));
    }
    sortTasks(filteredTasks);
}

function sortTasks(filteredTasks = tasksList) {
    const sort = document.getElementById('taskSort').value;
    let sortedTasks = [...filteredTasks];
    if (sort === 'dueDateAsc') {
        sortedTasks.sort((a, b) => new Date(a.dueDate || a.DueDate) - new Date(b.dueDate || b.DueDate));
    } else if (sort === 'dueDateDesc') {
        sortedTasks.sort((a, b) => new Date(b.dueDate || b.DueDate) - new Date(a.dueDate || a.DueDate));
    }
    searchTasks(sortedTasks);
}

function clearFilters() {
    document.getElementById('taskFilter').value = 'all';
    document.getElementById('taskSort').value = 'default';
    document.getElementById('taskSearch').value = '';
    renderTasks(tasksList);
}

function searchTasks(tasks = tasksList) {
    const searchQuery = document.getElementById('taskSearch').value.trim().toLowerCase();
    let searchedTasks = tasks;
    if (searchQuery) {
        searchedTasks = tasks.filter(task =>
            (task.title || task.Title || '').toLowerCase().includes(searchQuery) ||
            (task.description || task.Description || '').toLowerCase().includes(searchQuery)
        );
    }
    renderTasks(searchedTasks);
}

async function openEditModal(id) {
    currentEditTaskId = id;
    const response = await fetch(`/api/tasks/${id}`);
    if (!response.ok) {
        throw new Error('Failed to fetch task: ' + response.statusText);
    }
    const task = await response.json();
    document.getElementById('editTaskTitle').value = task.title || task.Title || '';
    document.getElementById('editTaskDesc').value = task.description || task.Description || '';
    document.getElementById('editTaskDueDate').value = (task.dueDate || task.DueDate || '').split('T')[0];
    const userId = task.userId || task.UserId || '';
    document.getElementById('editUserSelect').value = userId;
    document.getElementById('editModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
    currentEditTaskId = null;
}

async function saveTaskChanges() {
    const title = document.getElementById('editTaskTitle').value.trim();
    const description = document.getElementById('editTaskDesc').value.trim();
    const dueDate = document.getElementById('editTaskDueDate').value;
    const userId = document.getElementById('editUserSelect').value;

    if (!title || title === "") {
        alert('Title is required and cannot be empty.');
        return;
    }
    if (!dueDate || dueDate === "") {
        alert('Due Date is required.');
        return;
    }
    const dateObj = new Date(dueDate);
    if (isNaN(dateObj.getTime())) {
        alert('Due Date must be a valid date (e.g., YYYY-MM-DD).');
        return;
    }

    let parsedUserId = null;
    if (userId && userId !== "") {
        parsedUserId = parseInt(userId);
        if (isNaN(parsedUserId)) {
            alert('Invalid User ID.');
            return;
        }
    }

    const taskData = {
        Id: currentEditTaskId,
        Title: title,
        Description: description,
        DueDate: dateObj.toISOString().split('T')[0],
        IsCompleted: tasksList.find(task => (task.id || task.Id) === currentEditTaskId).isCompleted || false,
        UserId: parsedUserId
    };

    try {
        const response = await fetch(`/api/tasks/${currentEditTaskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        if (response.ok) {
            closeModal();
            loadTasks();
        } else {
            const error = await response.json();
            console.log('Error details:', error);
            alert('Error: ' + JSON.stringify(error));
        }
    } catch (error) {
        console.error('Error updating task:', error);
        alert('Error updating task: ' + error.message);
    }
}

function exportToCSV() {
    const csv = [];
    csv.push(['Title', 'Description', 'Due Date', 'Assigned To', 'Completed']);
    tasksList.forEach(task => {
        const assignedUser = usersList.find(user => (user.id || user.Id) === (task.userId || task.UserId));
        const assignedUserName = assignedUser ? (assignedUser.name || assignedUser.Name || 'Unassigned') : 'Unassigned';
        csv.push([
            task.title || task.Title || '',
            task.description || task.Description || '',
            task.dueDate || task.DueDate || '',
            assignedUserName,
            (task.isCompleted || task.IsCompleted) ? 'Yes' : 'No'
        ]);
    });
    const csvContent = csv.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks_export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

loadTasks();
loadUsers();