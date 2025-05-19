import { checkAuth } from './auth.js';
import { initRouter } from './router.js';

console.log('Ініціалізація додатка');

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const themeButton = document.getElementById('theme-toggle');
    if (themeButton) {
        themeButton.innerHTML = isDark ? '<i class="fas fa-sun"></i> Світла тема' : '<i class="fas fa-moon"></i> Темна тема';
        console.log('Тему змінено на:', isDark ? 'темну' : 'світлу');
    } else {
        console.error('Кнопка #theme-toggle не знайдена після перемикання теми');
    }
}

function addThemeButton() {
    const nav = document.getElementById('nav');
    if (!nav) {
        console.error('Елемент навігації #nav не знайдено в DOM');
        return;
    }

    // Видаляємо стару кнопку, якщо вона є
    const oldThemeButton = document.getElementById('theme-toggle');
    if (oldThemeButton) {
        oldThemeButton.remove();
        console.log('Стара кнопка #theme-toggle видалена');
    }

    // Додаємо нову кнопку
    const themeButton = document.createElement('button');
    themeButton.id = 'theme-toggle';
    themeButton.classList.add('action-btn');
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) {
        document.body.classList.add('dark');
    }
    themeButton.innerHTML = isDark ? '<i class="fas fa-sun"></i> Світла тема' : '<i class="fas fa-moon"></i> Темна тема';
    themeButton.addEventListener('click', toggleTheme);
    nav.appendChild(themeButton);
    console.log('Кнопка #theme-toggle додана до #nav');
}

async function init() {
    console.log('Запуск ініціалізації');
    let isAuthenticated = false;
    try {
        const auth = await checkAuth();
        console.log('authData:', auth);
        isAuthenticated = auth.isAuthenticated;
    } catch (err) {
        console.error('Помилка перевірки автентифікації:', err);
    }

    // Ініціалізація роутера
    console.log('Запуск initRouter з isAuthenticated:', isAuthenticated);
    initRouter(isAuthenticated);

    // Додаємо кнопку теми після ініціалізації роутера
    addThemeButton();
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM завантажено, виклик init');
    init();
});