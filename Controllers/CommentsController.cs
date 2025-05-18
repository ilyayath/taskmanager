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
    public class CommentsController : ControllerBase
    {
        private readonly TaskManagerContext _context;
        private readonly UserManager<User> _userManager;

        public CommentsController(TaskManagerContext context, UserManager<User> userManager)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _userManager = userManager ?? throw new ArgumentNullException(nameof(userManager));
        }

        [HttpGet("/api/tasks/{taskId}/comments")]
        public async Task<ActionResult<IEnumerable<CommentDto>>> GetComments(int taskId)
        {
            Log.Information("CommentsController.GetComments викликано для задачі ID: {TaskId}", taskId);
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
                    Log.Warning("Заборонено: Працівник {UserId} намагався отримати коментарі задачі {TaskId}, яка йому не призначена", userId, taskId);
                    return Forbid();
                }

                var comments = await _context.Comments
                    .AsNoTracking()
                    .Where(c => c.TaskId == taskId)
                    .Select(c => new CommentDto
                    {
                        id = c.Id,
                        taskId = c.TaskId,
                        userId = c.UserId,
                        comment = c.Content,
                        timestamp = c.CreatedAt
                    })
                    .OrderBy(c => c.timestamp)
                    .ToListAsync();

                Log.Information("Знайдено {CommentCount} коментарів для задачі {TaskId}", comments.Count, taskId);
                return Ok(comments);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Помилка в GetComments для задачі ID: {TaskId}", taskId);
                return StatusCode(500, new { error = "Виникла помилка під час отримання коментарів.", details = ex.Message });
            }
        }

        [HttpPost]
        public async Task<ActionResult<CommentDto>> CreateComment([FromBody] CommentDto commentDto)
        {
            Log.Information("CommentsController.CreateComment викликано з даними: {CommentData}", JsonSerializer.Serialize(commentDto));
            try
            {
                if (commentDto == null)
                {
                    Log.Warning("Дані коментаря відсутні");
                    return BadRequest(new { error = "Дані коментаря є обов’язковими." });
                }

                if (string.IsNullOrWhiteSpace(commentDto.comment))
                {
                    Log.Warning("Текст коментаря не може бути порожнім");
                    return BadRequest(new { error = "Текст коментаря є обов’язковим." });
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

                var task = await _context.Tasks.FindAsync(commentDto.taskId);
                if (task == null)
                {
                    Log.Information("Задачу з ID {TaskId} не знайдено", commentDto.taskId);
                    return NotFound(new { error = "Задачу не знайдено." });
                }

                var isWorker = await _userManager.IsInRoleAsync(user, "Worker");
                if (isWorker && task.UserId != int.Parse(userId))
                {
                    Log.Warning("Заборонено: Працівник {UserId} намагався додати коментар до задачі {TaskId}, яка йому не призначена", userId, commentDto.taskId);
                    return Forbid();
                }

                var comment = new Comment
                {
                    TaskId = commentDto.taskId,
                    UserId = int.Parse(userId),
                    Content = commentDto.comment,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Comments.Add(comment);
                await _context.SaveChangesAsync();
                Log.Information("Коментар створено успішно з ID: {CommentId} для задачі {TaskId}", comment.Id, comment.TaskId);

                commentDto.id = comment.Id;
                commentDto.userId = comment.UserId;
                commentDto.timestamp = comment.CreatedAt;

                return CreatedAtAction(nameof(GetComments), new { taskId = comment.TaskId }, commentDto);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Помилка в CreateComment");
                return StatusCode(500, new { error = "Виникла помилка під час створення коментаря.", details = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteComment(int id)
        {
            Log.Information("CommentsController.DeleteComment викликано для ID: {CommentId}", id);
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

                var comment = await _context.Comments
                    .Include(c => c.Task)
                    .FirstOrDefaultAsync(c => c.Id == id);

                if (comment == null)
                {
                    Log.Information("Коментар з ID {CommentId} не знайдено", id);
                    return NotFound(new { error = "Коментар не знайдено." });
                }

                var isWorker = await _userManager.IsInRoleAsync(user, "Worker");
                var isManager = await _userManager.IsInRoleAsync(user, "Manager");

                if (isWorker && comment.UserId != int.Parse(userId))
                {
                    Log.Warning("Заборонено: Працівник {UserId} намагався видалити коментар {CommentId}, який йому не належить", userId, id);
                    return Forbid();
                }

                if (!isManager && comment.UserId != int.Parse(userId))
                {
                    Log.Warning("Заборонено: Користувач {UserId} намагався видалити коментар {CommentId}, який йому не належить", userId, id);
                    return Forbid();
                }

                _context.Comments.Remove(comment);
                await _context.SaveChangesAsync();
                Log.Information("Коментар з ID {CommentId} успішно видалено", id);

                return NoContent();
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Помилка в DeleteComment для ID: {CommentId}", id);
                return StatusCode(500, new { error = "Виникла помилка під час видалення коментаря.", details = ex.Message });
            }
        }
    }
}