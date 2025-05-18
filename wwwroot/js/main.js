import { checkAuth } from './api.js';
import { initRouter } from './router.js';

console.log('Initializing app');
async function init() {
    try {
        const auth = await checkAuth();
        console.log('isAuthenticated:', auth);
        if (!document.getElementById('nav')) {
            console.error('Navigation element #nav not found in DOM');
            return;
        }
        initRouter(auth.isAuthenticated);
    } catch (err) {
        console.error('Error checking auth:', err);
        initRouter(false);
    }
}

init();