import { navigate, initRouter } from './router.js';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from './api.js';

let currentUserRole = null;

export async function checkAuth() {
    try {
        const response = await fetch('/api/account/checkauth', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        console.log('checkAuth response status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('checkAuth data:', data);
        if (!data || typeof data.role !== 'string') {
            console.warn('Невалідні дані checkAuth:', data);
            throw new Error('Невалідна відповідь checkAuth: роль відсутня або не є рядком');
        }
        currentUserRole = data.role;
        localStorage.setItem('user', JSON.stringify({ role: currentUserRole }));
        console.log('Роль збережена в localStorage:', localStorage.getItem('user'));
        return data;
    } catch (err) {
        console.error('Помилка checkAuth:', err);
        currentUserRole = null;
        localStorage.removeItem('user');
        return null;
    }
}

export function getCurrentUserRole() {
    if (currentUserRole) {
        console.log('getCurrentUserRole повертає кешовану роль:', currentUserRole);
        return currentUserRole;
    }
    const userRaw = localStorage.getItem('user');
    console.log('localStorage.user:', userRaw);
    if (userRaw) {
        try {
            const user = JSON.parse(userRaw);
            console.log('Розпарсені дані user:', user);
            currentUserRole = user?.role || null;
            console.log('getCurrentUserRole повертає роль:', currentUserRole);
            return currentUserRole;
        } catch (err) {
            console.error('Помилка парсингу localStorage:', err);
            localStorage.removeItem('user');
            return null;
        }
    }
    console.log('localStorage.user відсутній');
    return null;
}

export function clearUserRole() {
    currentUserRole = null;
    localStorage.removeItem('user');
    console.log('Роль користувача очищена');
}

export async function login(email, password) {
    try {
        const result = await apiLogin(email, password);
        console.log('Login result:', result);
        if (!result.role || !result.userId) {
            throw new Error('Role or userId not received from server');
        }
        currentUserRole = result.role;
        localStorage.setItem('user', JSON.stringify({ id: result.userId, role: currentUserRole }));
        console.log('Stored user after login:', localStorage.getItem('user'));
        initRouter(true);
        navigate('/');
        return result;
    } catch (err) {
        console.error('Login failed:', err);
        currentUserRole = null;
        localStorage.removeItem('user');
        initRouter(false);
        throw err;
    }
}

export async function logout() {
    try {
        const result = await apiLogout();
        console.log('Logout successful, result:', result);
        clearUserRole();
        initRouter(false);
        navigate('/login');
        return result;
    } catch (err) {
        console.error('Logout failed:', err);
        clearUserRole();
        throw err;
    }
}

export async function renderLogin() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="card">
            <h2>Вхід</h2>
            <form id="login-form">
                <label><i class="fas fa-envelope"></i> Електронна пошта</label>
                <input type="email" id="email" required placeholder="Введіть email">
                <label><i class="fas fa-lock"></i> Пароль</label>
                <input type="password" id="password" required placeholder="Введіть пароль">
                <button type="submit" class="action-btn primary-btn"><i class="fas fa-sign-in-alt"></i> Увійти</button>
                <p>Немає облікового запису? <a href="#/register">Зареєструватися</a></p>
                <p class="error" id="login-error"></p>
            </form>
        </div>
    `;
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const errorElement = document.getElementById('login-error');
        errorElement.textContent = '';
        try {
            await login(email, password);
        } catch (err) {
            console.error('Login error:', err);
            errorElement.textContent = `Помилка входу: ${err.message}`;
        }
    });
}

export async function renderRegister() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="card">
            <h2>Реєстрація</h2>
            <form id="register-form">
                <label><i class="fas fa-envelope"></i> Електронна пошта</label>
                <input type="email" id="email" required placeholder="Введіть email">
                <label><i class="fas fa-user"></i> Ім’я</label>
                <input type="text" id="name" required placeholder="Введіть ім’я">
                <label><i class="fas fa-lock"></i> Пароль</label>
                <input type="password" id="password" required placeholder="Введіть пароль">
                <label><i class="fas fa-user-tag"></i> Роль</label>
                <select id="role" required>
                    <option value="Worker">Виконавець</option>
                    <option value="Manager">Менеджер</option>
                </select>
                <button type="submit" class="action-btn primary-btn"><i class="fas fa-user-plus"></i> Зареєструватися</button>
                <p>Вже маєте обліковий запис? <a href="#/login">Увійти</a></p>
                <p class="error" id="register-error"></p>
            </form>
        </div>
    `;
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const name = document.getElementById('name').value.trim();
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;
        const errorElement = document.getElementById('register-error');
        errorElement.textContent = '';
        console.log('Register attempt:', { email, name, password, role });
        try {
            await register(email, name, password, role);
            navigate('/login');
        } catch (err) {
            console.error('Register error:', err);
            errorElement.textContent = `Помилка реєстрації: ${err.message}`;
        }
    });
}

export async function register(email, name, password, role) {
    try {
        const result = await apiRegister(email, name, password, role);
        console.log('Register successful, result:', result);
        return result;
    } catch (err) {
        console.error('Register failed:', err);
        throw err;
    }
}