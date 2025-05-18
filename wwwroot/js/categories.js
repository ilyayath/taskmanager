import { getCategories, createCategory } from './api.js';

export async function renderCategories() {
    const app = document.getElementById('app');
    app.innerHTML = `
    <div class="card">
      <h2>Categories</h2>
      <form id="category-form">
        <div>
          <label>Name</label>
          <input type="text" id="name" required>
        </div>
        <button type="submit">Add Category</button>
        <p class="error" id="error"></p>
      </form>
      <table>
        <thead>
          <tr>
            <th>Name</th>
          </tr>
        </thead>
        <tbody id="category-list"></tbody>
      </table>
    </div>
  `;

    try {
        const categories = await getCategories();
        document.getElementById('category-list').innerHTML = categories.map(c => `
      <tr>
        <td>${c.name}</td>
      </tr>
    `).join('');
    } catch (err) {
        document.getElementById('error').textContent = err.message;
    }

    document.getElementById('category-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        try {
            await createCategory({ name });
            renderCategories();
        } catch (err) {
            document.getElementById('error').textContent = err.message;
        }
    });
}