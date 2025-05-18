using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManager.Data;
using TaskManager.Models;
using System.Security.Claims;
using System.Text.Json;
using Serilog;
using System.Linq;
using System.Threading.Tasks;

namespace TaskManager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [Produces("application/json")]
    public class NotesController : ControllerBase
    {
        private readonly TaskManagerContext _context;
        private readonly UserManager<User> _userManager;

        public NotesController(TaskManagerContext context, UserManager<User> userManager)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _userManager = userManager ?? throw new ArgumentNullException(nameof(userManager));
        }

        [HttpGet("/api/tasks/{taskId}/notes")]
        public async Task<ActionResult<IEnumerable<NoteDto>>> GetNotes(int taskId)
        {
            Log.Information("NotesController.GetNotes викликано для задачі ID: {TaskId}", taskId);
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    Log.Warning("Неавторизовано: ID користувача не знайдено");
                    return Unauthorized(new { error = "Неавторизовано: ID користувача не знайдено." });
                }

                var user = await _userManager.FindByIdAsync(userId);
                if (user == null)
                {
                    Log.Warning("Користувача не знайдено для ID: {UserId}", userId);
                    return Unauthorized(new { error = "Користувача не знайдено." });
                }

                var task = await _context.Tasks.FindAsync(taskId);
                if (task == null)
                {
                    Log.Information("Задачу з ID {TaskId} не знайдено", taskId);
                    return NotFound(new { error = "Задачу не знайдено." });
                }

                var isWorker = await _userManager.IsInRoleAsync(user, "Worker");
                if (isWorker && task.UserId != int.Parse(userId))
                {
                    Log.Warning("Заборонено: Працівник {UserId} намагався отримати нотатки задачі {TaskId}, яка йому не призначена", userId, taskId);
                    return Forbid();
                }

                var notes = await _context.Notes
                    .AsNoTracking()
                    .Where(n => n.TaskId == taskId)
                    .Select(n => new NoteDto
                    {
                        id = n.Id,
                        taskId = n.TaskId,
                        title = n.Title,
                        content = n.Content,
                        createdAt = n.CreatedAt,
                        updatedAt = n.UpdatedAt
                    })
                    .OrderBy(n => n.createdAt)
                    .ToListAsync();

                Log.Information("Знайдено {NoteCount} нотаток для задачі {TaskId}", notes.Count, taskId);
                return Ok(notes);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Помилка в GetNotes для задачі ID: {TaskId}", taskId);
                return StatusCode(500, new { error = "Виникла помилка під час отримання нотаток.", details = ex.Message });
            }
        }

        [HttpPost]
        public async Task<ActionResult<NoteDto>> CreateNote([FromBody] NoteDto noteDto)
        {
            Log.Information("NotesController.CreateNote викликано з даними: {NoteData}", JsonSerializer.Serialize(noteDto));
            try
            {
                if (noteDto == null)
                {
                    Log.Warning("Дані нотатки відсутні");
                    return BadRequest(new { error = "Дані нотатки є обов’язковими." });
                }

                if (string.IsNullOrWhiteSpace(noteDto.title) || string.IsNullOrWhiteSpace(noteDto.content))
                {
                    Log.Warning("Заголовок або вміст нотатки не можуть бути порожніми");
                    return BadRequest(new { error = "Заголовок і вміст нотатки є обов’язковими." });
                }

                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    Log.Warning("Неавторизовано: ID користувача не знайдено");
                    return Unauthorized(new { error = "Неавторизовано: ID користувача не знайдено." });
                }

                var user = await _userManager.FindByIdAsync(userId);
                if (user == null)
                {
                    Log.Warning("Користувача не знайдено для ID: {UserId}", userId);
                    return Unauthorized(new { error = "Користувача не знайдено." });
                }

                var task = await _context.Tasks.FindAsync(noteDto.taskId);
                if (task == null)
                {
                    Log.Information("Задачу з ID {TaskId} не знайдено", noteDto.taskId);
                    return NotFound(new { error = "Задачу не знайдено." });
                }

                var isWorker = await _userManager.IsInRoleAsync(user, "Worker");
                if (isWorker && task.UserId != int.Parse(userId))
                {
                    Log.Warning("Заборонено: Працівник {UserId} намагався додати нотатку до задачі {TaskId}, яка йому не призначена", userId, noteDto.taskId);
                    return Forbid();
                }

                var note = new Note
                {
                    TaskId = noteDto.taskId,
                    Title = noteDto.title,
                    Content = noteDto.content,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Notes.Add(note);
                await _context.SaveChangesAsync();
                Log.Information("Нотатку створено успішно з ID: {NoteId} для задачі {TaskId}", note.Id, note.TaskId);

                noteDto.id = note.Id;
                noteDto.createdAt = note.CreatedAt;
                noteDto.updatedAt = note.UpdatedAt;

                return CreatedAtAction(nameof(GetNotes), new { taskId = note.TaskId }, noteDto);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Помилка в CreateNote");
                return StatusCode(500, new { error = "Виникла помилка під час створення нотатки.", details = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateNote(int id, [FromBody] NoteDto noteDto)
        {
            Log.Information("NotesController.UpdateNote викликано для ID: {NoteId} з даними: {NoteData}", id, JsonSerializer.Serialize(noteDto));
            try
            {
                if (id != noteDto.id)
                {
                    Log.Warning("ID в URL ({Id}) не співпадає з ID нотатки ({NoteId})", id, noteDto.id);
                    return BadRequest(new { error = "ID у маршруті та ID нотатки мають співпадати." });
                }

                if (noteDto == null)
                {
                    Log.Warning("Дані нотатки відсутні");
                    return BadRequest(new { error = "Дані нотатки є обов’язковими." });
                }

                if (string.IsNullOrWhiteSpace(noteDto.title) || string.IsNullOrWhiteSpace(noteDto.content))
                {
                    Log.Warning("Заголовок або вміст нотатки не можуть бути порожніми");
                    return BadRequest(new { error = "Заголовок і вміст нотатки є обов’язковими." });
                }

                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    Log.Warning("Неавторизовано: ID користувача не знайдено");
                    return Unauthorized(new { error = "Неавторизовано: ID користувача не знайдено." });
                }

                var user = await _userManager.FindByIdAsync(userId);
                if (user == null)
                {
                    Log.Warning("Користувача не знайдено для ID: {UserId}", userId);
                    return Unauthorized(new { error = "Користувача не знайдено." });
                }

                var note = await _context.Notes
                    .Include(n => n.Task)
                    .FirstOrDefaultAsync(n => n.Id == id);

                if (note == null)
                {
                    Log.Information("Нотатку з ID {NoteId} не знайдено", id);
                    return NotFound(new { error = "Нотатку не знайдено." });
                }

                var isWorker = await _userManager.IsInRoleAsync(user, "Worker");
                if (isWorker && note.Task.UserId != int.Parse(userId))
                {
                    Log.Warning("Заборонено: Працівник {UserId} намагався оновити нотатку {NoteId} для задачі {TaskId}, яка йому не призначена", userId, id, note.TaskId);
                    return Forbid();
                }

                note.Title = noteDto.title;
                note.Content = noteDto.content;
                note.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                Log.Information("Нотатку з ID {NoteId} успішно оновлено", id);

                return NoContent();
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Помилка в UpdateNote для ID: {NoteId}", id);
                return StatusCode(500, new { error = "Виникла помилка під час оновлення нотатки.", details = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteNote(int id)
        {
            Log.Information("NotesController.DeleteNote викликано для ID: {NoteId}", id);
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    Log.Warning("Неавторизовано: ID користувача не знайдено");
                    return Unauthorized(new { error = "Неавторизовано: ID користувача не знайдено." });
                }

                var user = await _userManager.FindByIdAsync(userId);
                if (user == null)
                {
                    Log.Warning("Користувача не знайдено для ID: {UserId}", userId);
                    return Unauthorized(new { error = "Користувача не знайдено." });
                }

                var note = await _context.Notes
                    .Include(n => n.Task)
                    .FirstOrDefaultAsync(n => n.Id == id);

                if (note == null)
                {
                    Log.Information("Нотатку з ID {NoteId} не знайдено", id);
                    return NotFound(new { error = "Нотатку не знайдено." });
                }

                var isWorker = await _userManager.IsInRoleAsync(user, "Worker");
                var isManager = await _userManager.IsInRoleAsync(user, "Manager");

                if (isWorker && note.Task.UserId != int.Parse(userId))
                {
                    Log.Warning("Заборонено: Працівник {UserId} намагався видалити нотатку {NoteId} для задачі {TaskId}, яка йому не призначена", userId, id, note.TaskId);
                    return Forbid();
                }

                _context.Notes.Remove(note);
                await _context.SaveChangesAsync();
                Log.Information("Нотатку з ID {NoteId} успішно видалено", id);

                return NoContent();
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Помилка в DeleteNote для ID: {NoteId}", id);
                return StatusCode(500, new { error = "Виникла помилка під час видалення нотатки.", details = ex.Message });
            }
        }
    }
}