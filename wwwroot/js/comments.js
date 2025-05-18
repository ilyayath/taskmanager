import { getComments, deleteComment } from './api.js';

export async function renderComments(taskId) {
    const commentsDiv = document.getElementById('comments');
    try {
        const comments = await getComments(taskId);
        commentsDiv.innerHTML = comments.length
            ? comments.map(c => `
          <div class="card">
            <p>${c.comment}</p>
            <p><small>${new Date(c.timestamp).toLocaleString()}</small></p>
            <button data-id="${c.id}" class="delete-comment">Delete</button>
          </div>
        `).join('')
            : '<p>No comments yet.</p>';

        commentsDiv.querySelectorAll('.delete-comment').forEach(button => {
            button.addEventListener('click', async () => {
                if (confirm('Delete comment?')) {
                    await deleteComment(button.dataset.id);
                    renderComments(taskId);
                }
            });
        });
    } catch (err) {
        commentsDiv.innerHTML = `<p class="error">${err.message}</p>`;
    }
}