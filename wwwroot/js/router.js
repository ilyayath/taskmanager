import { renderLogin, renderRegister, checkAuth, logout } from './auth.js';
import { renderTasks, renderTaskDetail, renderTaskForm } from './tasks.js';

// Дебагінг імпорту
console.log('Імпортовано з tasks.js:', { renderTasks, renderTaskDetail });

export async function navigate(path) {
    console.log('Навігація до:', path);
    const normalizedPath = path.split('?')[0].toLowerCase();
    console.log('Нормалізований шлях:', normalizedPath);

    let route = null;
    let param = null;

    if (normalizedPath === '/') {
        route = '/';
    } else if (normalizedPath.startsWith('/task/') && !normalizedPath.includes('/edit/')) {
        route = '/task/:id';
        param = normalizedPath.split('/')[2];
    } else if (normalizedPath === '/task/new') {
        route = '/task/new';
    } else if (normalizedPath.startsWith('/task/edit/')) {
        route = '/task/edit/:id';
        const parts = normalizedPath.split('/');
        param = parts.length > 3 && !isNaN(parseInt(parts[3])) ? parseInt(parts[3]) : null;
        if (!param) {
            console.error('Некоректний ID для редагування:', normalizedPath);
            document.getElementById('app').innerHTML = '<h1>404 - Некоректний ID завдання</h1>';
            return;
        }
    } else if (normalizedPath === '/login') {
        route = '/login';
    } else if (normalizedPath === '/register') {
        route = '/register';
    }

    console.log('Знайдено маршрут:', route, 'з параметром:', param);

    const app = document.getElementById('app');
    if (!app) {
        console.error('Контейнер app не знайдено');
        return;
    }

    try {
        const authData = await checkAuth();
        console.log('authData:', authData);
        updateNavigation(authData ? authData.isAuthenticated : false);

        if (!authData?.isAuthenticated && route !== '/login' && route !== '/register') {
            navigate('/login');
            return;
        }

        switch (route) {
            case '/':
                await renderTasks();
                break;
            case '/task/:id':
                await renderTaskDetail(param);
                break;
            case '/task/new':
                await renderTaskForm(null);
                break;
            case '/task/edit/:id':
                await renderTaskForm(param);
                break;
            case '/login':
                await renderLogin();
                break;
            case '/register':
                await renderRegister();
                break;
            default:
                app.innerHTML = '<h1>404 - Сторінка не знайдена</h1>';
        }
    } catch (err) {
        console.error('Помилка навігації:', err);
        app.innerHTML = `<p class="error">Помилка навігації: ${err.message}</p>`;
    }
}

function updateNavigation(isAuthenticated) {
    console.log('Оновлення навігації, isAuthenticated:', isAuthenticated);
    const nav = document.getElementById('nav');
    if (!nav) {
        console.error('Контейнер nav не знайдено');
        return;
    }

    nav.innerHTML = isAuthenticated
        ? `
            <a href="#/"><i class="fas fa-tasks"></i> Завдання</a>
            <button id="logout" class="action-btn"><i class="fas fa-sign-out-alt"></i> Вийти</button>
        `
        : `
            <a href="#/login"><i class="fas fa-sign-in-alt"></i> Вхід</a>
            <a href="#/register"><i class="fas fa-user-plus"></i> Реєстрація</a>
        `;
    console.log('HTML навігації встановлено:', nav.innerHTML);

    const logoutButton = document.getElementById('logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await logout();
            } catch (err) {
                console.error('Помилка виходу:', err);
            }
        });
    }
}

export function initRouter(isAuthenticated) {
    console.log('Ініціалізація роутера, isAuthenticated:', isAuthenticated);
    window.addEventListener('hashchange', () => navigate(window.location.hash.slice(1)));
    navigate(window.location.hash.slice(1) || '/');
}