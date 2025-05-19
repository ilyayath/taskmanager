const BASE_URL = 'https://localhost:7285/api';

let csrfToken = null;

async function getCsrfToken() {
    try {
        console.log('Fetching CSRF token from /account/getcsrftoken');
        const response = await fetch(`${BASE_URL}/account/getcsrftoken`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            credentials: 'include',
        });
        console.log('getcsrftoken response status:', response.status, 'headers:', [...response.headers.entries()]);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch CSRF token: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        csrfToken = data.token || '';
        console.log('CSRF token:', csrfToken);
        if (!csrfToken) {
            console.warn('CSRF token is empty; requests may fail');
        }
        return csrfToken;
    } catch (err) {
        console.error('Error fetching CSRF token:', err);
        csrfToken = '';
        return csrfToken;
    }
}

async function fetchWithCsrf(method, url, data = null) {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.remove('hidden');
    try {
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };
        if (['POST', 'PUT', 'DELETE'].includes(method)) {
            headers['X-CSRF-TOKEN'] = await getCsrfToken();
        }
        const options = { method, headers, credentials: 'include' };
        if (data) options.body = JSON.stringify(data);
        console.log(`API request: ${method} ${BASE_URL}${url}`, data ? `with body: ${JSON.stringify(data)}` : '');
        const response = await fetch(`${BASE_URL}${url}`, options);
        console.log(`API response status for ${url}:`, response.status, 'headers:', [...response.headers.entries()]);

        if (!response.ok) {
            let errorMessage = 'Request failed';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || JSON.stringify(errorData);
            } catch {
                errorMessage = await response.text() || errorMessage;
            }
            throw new Error(`API error: ${response.status} - ${errorMessage}`);
        }

        const text = await response.text();
        console.log(`Raw response body for ${url}:`, text);
        if (!text) {
            console.warn(`Empty response body for ${url}`);
            return {};
        }
        let jsonData;
        try {
            jsonData = JSON.parse(text);
        } catch (err) {
            console.error(`Failed to parse JSON for ${url}:`, err, 'Raw text:', text);
            throw new Error(`Invalid JSON response: ${err.message}`);
        }
        console.log(`Parsed API response for ${url}:`, jsonData);
        return jsonData;
    } catch (err) {
        console.error(`Error in fetchWithCsrf for ${url}:`, err);
        throw err;
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

export async function login(email, password) {
    const result = await fetchWithCsrf('POST', '/account/login', { email, password });
    console.log('Login result:', result);
    return result;
}

export async function logout() {
    const result = await fetchWithCsrf('POST', '/account/logout');
    console.log('Logout result:', result);
    return result;
}

export async function register(email, name, password, role) {
    const result = await fetchWithCsrf('POST', '/account/register', { email, name, password, role });
    console.log('Register result:', result);
    return result;
}

export async function checkAuth() {
    const result = await fetchWithCsrf('GET', '/account/checkauth');
    console.log('checkAuth result:', result);
    return result;
}

export async function getTasks(page = 1, pageSize = 10) {
    return fetchWithCsrf('GET', `/tasks?page=${page}&pageSize=${pageSize}`);
}

export async function getTask(id) {
    return fetchWithCsrf('GET', `/tasks/${id}`);
}

export async function createTask(task) {
    return fetchWithCsrf('POST', '/tasks', task);
}

export async function updateTask(id, task) {
    return fetchWithCsrf('PUT', `/tasks/${id}`, task);
}

export async function deleteTask(id) {
    return fetchWithCsrf('DELETE', `/tasks/${id}`);
}

export async function getUsers() {
    try {
        const data = await fetchWithCsrf('GET', '/users');
        console.log('getUsers raw response:', data);
        if (!Array.isArray(data)) {
            console.warn('getUsers: Response is not an array', data);
        }
        data.forEach(user => console.log('User:', user));
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.error('Помилка getUsers:', err);
        throw err;
    }
}

export async function getComments(taskId) {
    return fetchWithCsrf('GET', `/tasks/${taskId}/comments`);
}

export async function createComment(comment) {
    return fetchWithCsrf('POST', '/comments', comment);
}

export async function deleteComment(id) {
    return fetchWithCsrf('DELETE', `/comments/${id}`);
}

export async function getNotes(taskId) {
    return fetchWithCsrf('GET', `/tasks/${taskId}/notes`);
}

export async function createNote(note) {
    return fetchWithCsrf('POST', '/notes', note);
}

export async function updateNote(id, note) {
    return fetchWithCsrf('PUT', `/notes/${id}`, note);
}

export async function deleteNote(id) {
    return fetchWithCsrf('DELETE', `/notes/${id}`);
}

export async function getCategories() {
    const data = await fetchWithCsrf('GET', '/categories');
    console.log('getCategories data:', data);
    return Array.isArray(data) ? data.map(item => ({
        id: item.Id,
        name: item.Name,
        tasks: item.Tasks
    })) : [];
}

export async function createCategory(category) {
    return fetchWithCsrf('POST', '/categories', category);
}

export async function getTags() {
    const data = await fetchWithCsrf('GET', '/tags');
    console.log('getTags data:', data);
    return Array.isArray(data) ? data.map(item => ({
        id: item.Id,
        name: item.Name
    })) : [];
}

export async function createTag(tag) {
    return fetchWithCsrf('POST', '/tags', tag);
}