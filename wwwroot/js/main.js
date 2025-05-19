import { checkAuth } from './auth.js';
import { initRouter } from './router.js';

console.log('Ініціалізація додатка');
async function init() {
    try {
        const auth = await checkAuth();
        console.log('authData:', auth);
        if (!document.getElementById('nav')) {
            console.error('Елемент навігації #nav не знайдено в DOM');
            return;
        }
        console.log('Запуск initRouter з isAuthenticated:', auth.isAuthenticated);
        initRouter(auth.isAuthenticated);
    } catch (err) {
        console.error('Помилка перевірки автентифікації:', err);
        initRouter(false);
    }
}

init();