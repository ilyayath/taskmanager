import { renderLogin, renderRegister } from './auth.js';
import { renderTasks, renderTaskDetail } from './tasks.js';
import { checkAuth } from './api.js';

const routes = {
    '/': async () => {
        const auth = await checkAuth();
        if (auth.isAuthenticated) {
            renderTasks();
        } else {
            navigate('/login');
        }
    },
    '/login': renderLogin,
    '/register': renderRegister,
    '/task/:id': renderTaskDetail,
};

export function initRouter(isAuthenticated) {
    console.log('Initializing router with isAuthenticated:', isAuthenticated);
    updateNav(isAuthenticated);
    let lastPath = window.location.hash.slice(1) || '/';
    console.log('Initial navigation to:', lastPath);
    navigate(lastPath);
    window.removeEventListener('hashchange', handleHashChange);
    window.addEventListener('hashchange', handleHashChange);
}

function handleHashChange() {
    const path = window.location.hash.slice(1) || '/';
    console.log('Hashchange triggered, navigating to:', path);
    navigate(path);
}

export async function navigate(path) {
    console.log('Navigating to:', path);
    path = (path || '/').trim().replace(/\/+/g, '/');
    if (path === '') path = '/';
    console.log('Normalized path:', path);

    let route = Object.keys(routes).find(r => r === path);
    let param = null;

    if (!route) {
        const pathParts = path.split('/').filter(Boolean);
        const basePath = pathParts[0] || '';
        route = Object.keys(routes).find(r => {
            if (r.includes(':')) {
                const routeParts = r.split('/').filter(Boolean);
                return routeParts[0] === basePath && routeParts.length === pathParts.length;
            }
            return false;
        });

        if (route) {
            param = pathParts[1];
        }
    }

    if (!route) {
        console.error('Route not found:', path);
        document.getElementById('app').innerHTML = '<h2>404 Not Found</h2>';
        return;
    }

    console.log('Found route:', route, 'with param:', param);
    const handler = routes[route];
    if (typeof handler !== 'function') {
        console.error('Handler is not a function for route:', route, handler);
        document.getElementById('app').innerHTML = '<h2>Error: Invalid route handler</h2>';
        return;
    }

    await handler(param);
}

export function updateNav(isAuthenticated) {
    const nav = document.getElementById('nav');
    if (!nav) {
        console.error('Navigation element #nav not found in DOM');
        return;
    }
    console.log('Updating navigation, isAuthenticated:', isAuthenticated);
    nav.innerHTML = isAuthenticated
        ? `
      <a href="#/"><i class="fas fa-tasks"></i> Tasks</a>
      <button id="logout"><i class="fas fa-sign-out-alt"></i> Logout</button>
    `
        : `
      <a href="#/login"><i class="fas fa-sign-in-alt"></i> Login</a>
      <a href="#/register"><i class="fas fa-user-plus"></i> Register</a>
    `;
    console.log('Navigation HTML set to:', nav.innerHTML);

    if (isAuthenticated) {
        const logoutButton = document.getElementById('logout');
        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                await import('./auth.js').then(({ logout }) => logout());
            });
        } else {
            console.error('Logout button not found after rendering');
        }
    }
}