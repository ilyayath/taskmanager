import { checkAuth } from './auth.js';
import { initRouter } from './router.js';

console.log('Ініціалізація додатка');

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const themeButton = document.getElementById('theme-toggle');
    if (themeButton) {
        themeButton.innerHTML = isDark ? '<i class="fas fa-sun"></i> Світла тема' : '<i class="fas fa-moon"></i> Темна тема';
    }
}

async function init() {
    try {
        const auth = await checkAuth();
        console.log('authData:', auth);
        if (!document.getElementById('nav')) {
            console.error('Елемент навігації #nav не знайдено в DOM');
            return;
        }
        // Ініціалізація теми
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark');
        }
        // Додавання кнопки перемикання теми
        const nav = document.getElementById('nav');
        const themeButton = document.createElement('button');
        themeButton.id = 'theme-toggle';
        themeButton.classList.add('action-btn');
        themeButton.innerHTML = document.body.classList.contains('dark')
            ? '<i class="fas fa-sun"></i> Світла тема'
            : '<i class="fas fa-moon"></i> Темна тема';
        themeButton.addEventListener('click', toggleTheme);
        nav.appendChild(themeButton);

        console.log('Запуск initRouter з isAuthenticated:', auth.isAuthenticated);
        initRouter(auth.isAuthenticated);
    } catch (err) {
        console.error('Помилка перевірки автентифікації:', err);
        initRouter(false);
    }
}

init();