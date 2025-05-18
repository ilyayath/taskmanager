import { getNotes, updateNote, deleteNote } from './api.js';

export async function renderNotes(taskId) {
    const notesDiv = document.getElementById('notes');
    try {
        const notes = await getNotes(taskId);
        notesDiv.innerHTML = notes.length
            ? notes.map(n => `
          <div class="card">
            <h4>${n.title}</h4>
            <p>${n.content}</p>
            <p><small>Created: ${new Date(n.createdAt).toLocaleString()}</small></p>
            <p><small>Updated: ${new Date(n.updatedAt).toLocaleString()}</small></p>
            <button data-id="${n.id}" class="edit-note">Edit</button>
            <button data-id="${n.id}" class="delete-note">Delete</button>
          </div>
        `).join('')
            : '<p>No notes yet.</p>';

        notesDiv.querySelectorAll('.edit-note').forEach(button => {
            button.addEventListener('click', async () => {
                const note = notes.find(n => n.id == button.dataset.id);
                const title = prompt('Edit title:', note.title);
                const content = prompt('Edit content:', note.content);
                if (title && content) {
                    await updateNote(note.id, { id: note.id, taskId, title, content });
                    renderNotes(taskId);
                }
            });
        });

        notesDiv.querySelectorAll('.delete-note').forEach(button => {
            button.addEventListener('click', async () => {
                if (confirm('Delete note?')) {
                    await deleteNote(button.dataset.id);
                    renderNotes(taskId);
                }
            });
        });
    } catch (err) {
        notesDiv.innerHTML = `<p class="error">${err.message}</p>`;
    }
}