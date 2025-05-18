using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManager.Data;
using TaskManager.Models;
using System.Security.Claims;
using System.Text.Json;
using Serilog;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace TaskManager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [Produces("application/json")]
    public class TasksController : ControllerBase
    {
        private readonly TaskManagerContext _context;
        private readonly UserManager<User> _userManager;

        public TasksController(TaskManagerContext context, UserManager<User> userManager)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _userManager = userManager ?? throw new ArgumentNullException(nameof(userManager));
        }

        [HttpGet]
        public async Task<ActionResult<PagedTasksResponse>> GetTasks([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            Log.Information("TasksController.GetTasks викликано з page={Page}, pageSize={PageSize}", page, pageSize);
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

                var isWorker = await _userManager.IsInRoleAsync(user, "Worker");
                var tasksQuery = _context.Tasks
                    .AsNoTracking()
                    .Where(t => !isWorker || t.UserId == int.Parse(userId))
                    .Include(t => t.TaskTags)
                    .ThenInclude(tt => tt.Tag)
                    .Select(t => new TaskItemDto
                    {
                        id = t.Id,
                        title = t.Title,
                        description = t.Description,
                        dueDate = t.DueDate,
                        isCompleted = t.IsCompleted,
                        userId = t.UserId,
                        categoryId = t.CategoryId,
                        priority = t.Priority,
                        progress = t.Progress,
                        notes = t.Notes,
                        tagIds = t.TaskTags.Select(tt => tt.TagId).ToList()
                    });

                var total = await tasksQuery.CountAsync();
                var tasks = await tasksQuery
                    .OrderBy(t => t.id)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                Log.Information("Знайдено {TaskCount} задач для користувача {UserId}, сторінка {Page}", tasks.Count, userId, page);
                return Ok(new PagedTasksResponse
                {
                    tasks = tasks,
                    total = total,
                    page = page
                });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Помилка в GetTasks");
                return StatusCode(500, new { error = "Виникла помилка під час отримання задач.", details = ex.Message });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TaskItemDto>> GetTask(int id)
        {
            Log.Information("TasksController.GetTask викликано для ID: {TaskId}", id);
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    Log.Warning("Неавторизовано: ID користувача не знайдено");
                    return Unauthorized(new { error = "Неавторизовано: ID користувача не знайдено." });
                }

                var task = await _context.Tasks
                    .AsNoTracking()
                    .Include(t => t.TaskTags)
                    .ThenInclude(tt => tt.Tag)
                    .Select(t => new TaskItemDto
                    {
                        id = t.Id,
                        title = t.Title,
                        description = t.Description,
                        dueDate = t.DueDate,
                        isCompleted = t.IsCompleted,
                        userId = t.UserId,
                        categoryId = t.CategoryId,
                        priority = t.Priority,
                        progress = t.Progress,
                        notes = t.Notes,
                        tagIds = t.TaskTags.Select(tt => tt.TagId).ToList()
                    })
                    .FirstOrDefaultAsync(t => t.id == id);

                if (task == null)
                {
                    Log.Information("Задачу з ID {TaskId} не знайдено", id);
                    return NotFound(new { error = "Задачу не знайдено." });
                }

                var user = await _userManager.FindByIdAsync(userId);
                var isWorker = await _userManager.IsInRoleAsync(user, "Worker");
                if (isWorker && task.userId != int.Parse(userId))
                {
                    Log.Warning("Заборонено: Працівник {UserId} намагався отримати задачу {TaskId}, яка йому не призначена", userId, id);
                    return Forbid();
                }

                return Ok(task);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Помилка в GetTask для ID: {TaskId}", id);
                return StatusCode(500, new { error = "Виникла помилка під час отримання задачі.", details = ex.Message });
            }
        }

        [HttpPost]
        [Authorize(Roles = "Manager")]
        public async Task<ActionResult<TaskItemDto>> CreateTask([FromBody] TaskItemDto taskDto)
        {
            Log.Information("TasksController.CreateTask викликано з даними: {TaskData}", JsonSerializer.Serialize(taskDto));
            try
            {
                if (taskDto == null)
                {
                    Log.Warning("Дані задачі відсутні");
                    return BadRequest(new { error = "Дані задачі є обов’язковими." });
                }

                if (!ModelState.IsValid)
                {
                    var errors = ModelState.ToDictionary(k => k.Key, v => v.Value.Errors.Select(e => e.ErrorMessage).ToArray());
                    Log.Warning("Помилки валідації моделі: {Errors}", JsonSerializer.Serialize(errors));
                    return BadRequest(new { errors });
                }

                if (taskDto.dueDate == default)
                {
                    Log.Warning("Дата виконання не вказана або некоректна");
                    return BadRequest(new { error = "Дата виконання є обов’язковою і має бути коректною." });
                }

                if (taskDto.progress < 0 || taskDto.progress > 100)
                {
                    Log.Warning("Прогрес {Progress} не в межах 0-100", taskDto.progress);
                    return BadRequest(new { error = "Прогрес має бути в межах від 0 до 100." });
                }

                if (!new[] { "High", "Medium", "Low" }.Contains(taskDto.priority))
                {
                    Log.Warning("Некоректний пріоритет: {Priority}", taskDto.priority);
                    return BadRequest(new { error = "Пріоритет має бути High, Medium або Low." });
                }

                if (taskDto.userId.HasValue && !await _context.Users.AnyAsync(u => u.Id == taskDto.userId))
                {
                    Log.Warning("Користувача з ID {UserId} не знайдено", taskDto.userId);
                    return BadRequest(new { error = "Користувача з вказаним ID не знайдено." });
                }

                if (taskDto.categoryId.HasValue && !await _context.Categories.AnyAsync(c => c.Id == taskDto.categoryId))
                {
                    Log.Warning("Категорію з ID {CategoryId} не знайдено", taskDto.categoryId);
                    return BadRequest(new { error = "Категорію з вказаним ID не знайдено." });
                }

                if (taskDto.tagIds != null && taskDto.tagIds.Any())
                {
                    var invalidTagIds = taskDto.tagIds.Where(id => !_context.Tags.Any(t => t.Id == id)).ToList();
                    if (invalidTagIds.Any())
                    {
                        Log.Warning("Некоректні ID тегів: {InvalidTagIds}", string.Join(", ", invalidTagIds));
                        return BadRequest(new { error = $"Теги з ID {string.Join(", ", invalidTagIds)} не існують." });
                    }
                }

                var task = new TaskItem
                {
                    Title = taskDto.title,
                    Description = taskDto.description,
                    DueDate = DateTime.SpecifyKind(taskDto.dueDate, DateTimeKind.Utc),
                    IsCompleted = taskDto.isCompleted,
                    UserId = taskDto.userId,
                    CategoryId = taskDto.categoryId,
                    Priority = taskDto.priority,
                    Progress = taskDto.progress,
                    Notes = taskDto.notes,
                    TaskTags = taskDto.tagIds?.Select(tagId => new TaskTag { TagId = tagId }).ToList() ?? new List<TaskTag>()
                };

                _context.Tasks.Add(task);
                await _context.SaveChangesAsync();
                Log.Information("Задачу створено успішно з ID: {TaskId}", task.Id);

                taskDto.id = task.Id;
                return CreatedAtAction(nameof(GetTask), new { id = task.Id }, taskDto);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Помилка в CreateTask");
                return StatusCode(500, new { error = "Виникла помилка під час створення задачі.", details = ex.Message });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Worker,Manager")]
        public async Task<IActionResult> UpdateTask(int id, [FromBody] TaskItemDto taskDto)
        {
            Log.Information("TasksController.UpdateTask викликано для ID: {TaskId} з даними: {TaskData}", id, JsonSerializer.Serialize(taskDto));
            try
            {
                if (id != taskDto.id)
                {
                    Log.Warning("ID в URL ({Id}) не співпадає з ID задачі ({TaskId})", id, taskDto.id);
                    return BadRequest(new { error = "ID у маршруті та ID задачі мають співпадати." });
                }

                if (taskDto == null)
                {
                    Log.Warning("Дані задачі відсутні");
                    return BadRequest(new { error = "Дані задачі є обов’язковими." });
                }

                if (!ModelState.IsValid)
                {
                    var errors = ModelState.ToDictionary(k => k.Key, v => v.Value.Errors.Select(e => e.ErrorMessage).ToArray());
                    Log.Warning("Помилки валідації моделі: {Errors}", JsonSerializer.Serialize(errors));
                    return BadRequest(new { errors });
                }

                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var existingTask = await _context.Tasks
                    .Include(t => t.TaskTags)
                    .FirstOrDefaultAsync(t => t.Id == id);

                if (existingTask == null)
                {
                    Log.Information("Задачу з ID {TaskId} не знайдено", id);
                    return NotFound(new { error = "Задачу не знайдено." });
                }

                var user = await _userManager.FindByIdAsync(userId);
                var isWorker = await _userManager.IsInRoleAsync(user, "Worker");
                if (isWorker && existingTask.UserId != int.Parse(userId))
                {
                    Log.Warning("Заборонено: Працівник {UserId} намагався оновити задачу {TaskId}, яка йому не призначена", userId, id);
                    return Forbid();
                }

                if (taskDto.dueDate == default)
                {
                    Log.Warning("Дата виконання не вказана або некоректна");
                    return BadRequest(new { error = "Дата виконання є обов’язковою і має бути коректною." });
                }

                if (taskDto.progress < 0 || taskDto.progress > 100)
                {
                    Log.Warning("Прогрес {Progress} не в межах 0-100", taskDto.progress);
                    return BadRequest(new { error = "Прогрес має бути в межах від 0 до 100." });
                }

                if (!new[] { "High", "Medium", "Low" }.Contains(taskDto.priority))
                {
                    Log.Warning("Некоректний пріоритет: {Priority}", taskDto.priority);
                    return BadRequest(new { error = "Пріоритет має бути High, Medium або Low." });
                }

                if (taskDto.userId.HasValue && !await _context.Users.AnyAsync(u => u.Id == taskDto.userId))
                {
                    Log.Warning("Користувача з ID {UserId} не знайдено", taskDto.userId);
                    return BadRequest(new { error = "Користувача з вказаним ID не знайдено." });
                }

                if (taskDto.categoryId.HasValue && !await _context.Categories.AnyAsync(c => c.Id == taskDto.categoryId))
                {
                    Log.Warning("Категорію з ID {CategoryId} не знайдено", taskDto.categoryId);
                    return BadRequest(new { error = "Категорію з вказаним ID не знайдено." });
                }

                if (taskDto.tagIds != null && taskDto.tagIds.Any())
                {
                    var invalidTagIds = taskDto.tagIds.Where(tId => !_context.Tags.Any(t => t.Id == tId)).ToList();
                    if (invalidTagIds.Any())
                    {
                        Log.Warning("Некоректні ID тегів: {InvalidTagIds}", string.Join(", ", invalidTagIds));
                        return BadRequest(new { error = $"Теги з ID {string.Join(", ", invalidTagIds)} не існують." });
                    }
                }

                if (isWorker)
                {
                    existingTask.IsCompleted = taskDto.isCompleted;
                    existingTask.Notes = taskDto.notes;
                    existingTask.Progress = taskDto.progress;
                }
                else
                {
                    existingTask.Title = taskDto.title;
                    existingTask.Description = taskDto.description;
                    existingTask.DueDate = DateTime.SpecifyKind(taskDto.dueDate, DateTimeKind.Utc);
                    existingTask.IsCompleted = taskDto.isCompleted;
                    existingTask.UserId = taskDto.userId;
                    existingTask.CategoryId = taskDto.categoryId;
                    existingTask.Priority = taskDto.priority;
                    existingTask.Progress = taskDto.progress;
                    existingTask.Notes = taskDto.notes;

                    existingTask.TaskTags.Clear();
                    if (taskDto.tagIds != null)
                    {
                        existingTask.TaskTags = taskDto.tagIds.Select(tagId => new TaskTag { TaskId = id, TagId = tagId }).ToList();
                    }
                }

                await _context.SaveChangesAsync();
                Log.Information("Задачу з ID {TaskId} успішно оновлено", id);
                return NoContent();
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Помилка в UpdateTask для ID: {TaskId}", id);
                return StatusCode(500, new { error = "Виникла помилка під час оновлення задачі.", details = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            Log.Information("TasksController.DeleteTask викликано для ID: {TaskId}", id);
            try
            {
                var task = await _context.Tasks.FindAsync(id);
                if (task == null)
                {
                    Log.Information("Задачу з ID {TaskId} не знайдено", id);
                    return NotFound(new { error = "Задачу не знайдено." });
                }

                _context.Tasks.Remove(task);
                await _context.SaveChangesAsync();
                Log.Information("Задачу з ID {TaskId} успішно видалено", id);
                return NoContent();
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Помилка в DeleteTask для ID: {TaskId}", id);
                return StatusCode(500, new { error = "Виникла помилка під час видалення задачі.", details = ex.Message });
            }
        }
    }
}