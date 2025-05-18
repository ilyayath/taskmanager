import { navigate, initRouter } from './router.js';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from './api.js';

let currentUserRole = null;

export function getCurrentUserRole() {
    return currentUserRole;
}

export async function renderLogin() {
    const app = document.getElementById('app');
    app.innerHTML = `
    <div class="card">
      <h2>Login</h2>
      <form id="login-form">
        <label><i class="fas fa-envelope"></i> Email</label>
        <input type="email" id="email" required>
        <label><i class="fas fa-lock"></i> Password</label>
        <input type="password" id="password" required>
        <button type="submit"><i class="fas fa-sign-in-alt"></i> Login</button>
        <p>Not registered? <a href="#/register">Create an account</a></p>
      </form>
    </div>
  `;
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            await login(email, password);
        } catch (err) {
            console.error('Login error:', err);
            document.getElementById('app').innerHTML += '<p class="error">Login failed: ' + err.message + '</p>';
        }
    });
}

export async function renderRegister() {
    const app = document.getElementById('app');
    app.innerHTML = `
    <div class="card">
      <h2>Register</h2>
      <form id="register-form">
        <label><i class="fas fa-envelope"></i> Email</label>
        <input type="email" id="email" required>
        <label><i class="fas fa-user"></i> Name</label>
        <input type="text" id="name" required>
        <label><i class="fas fa-lock"></i> Password</label>
        <input type="password" id="password" required>
        <label><i class="fas fa-user-tag"></i> Role</label>
        <select id="role" required>
          <option value="Worker">Worker</option>
          <option value="Manager">Manager</option>
        </select>
        <button type="submit"><i class="fas fa-user-plus"></i> Register</button>
        <p>Already have an account? <a href="#/login">Login</a></p>
      </form>
    </div>
  `;
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const name = document.getElementById('name').value.trim();
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;
        console.log('Register attempt:', { email, name, password, role });
        try {
            await register(email, name, password, role);
            navigate('/login');
        } catch (err) {
            console.error('Register error:', err);
            document.getElementById('app').innerHTML += '<p class="error">Registration failed: ' + err.message + '</p>';
        }
    });
}

export async function login(email, password) {
    try {
        const result = await apiLogin(email, password);
        console.log('Login successful, result:', result);
        currentUserRole = result.role;
        initRouter(true);
        navigate('/');
    } catch (err) {
        console.error('Login failed:', err);
        currentUserRole = null;
        initRouter(false);
        throw err;
    }
}

export async function logout() {
    try {
        const result = await apiLogout();
        console.log('Logout successful, result:', result);
        currentUserRole = null;
        initRouter(false);
        navigate('/login');
    } catch (err) {
        console.error('Logout failed:', err);
        currentUserRole = null;
        initRouter(false);
        throw err;
    }
}

export async function register(email, name, password, role) {
    const result = await apiRegister(email, name, password, role);
    console.log('Register successful, result:', result);
}