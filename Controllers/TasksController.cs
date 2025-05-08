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
        public async Task<ActionResult<IEnumerable<TaskItemDto>>> GetTasks()
        {
            Log.Information("TasksController.GetTasks called");
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    Log.Warning("Unauthorized: No user ID found");
                    return Unauthorized();
                }

                var user = await _userManager.FindByIdAsync(userId);
                if (user == null)
                {
                    Log.Warning($"User not found for ID: {userId}");
                    return Unauthorized();
                }

                var isWorker = await _userManager.IsInRoleAsync(user, "Worker");
                var tasksQuery = _context.Tasks
                    .AsNoTracking()
                    .Where(t => !isWorker || t.UserId == int.Parse(userId))
                    .Include(t => t.TaskTags)
                    .ThenInclude(tt => tt.Tag)
                    .Select(t => new TaskItemDto
                    {
                        Id = t.Id,
                        Title = t.Title,
                        Description = t.Description,
                        DueDate = t.DueDate,
                        IsCompleted = t.IsCompleted,
                        UserId = t.UserId,
                        CategoryId = t.CategoryId,
                        Notes = t.Notes,
                        Progress = t.Progress,
                        TagIds = t.TaskTags.Select(tt => tt.TagId).ToList()
                    });

                var tasks = await tasksQuery.ToListAsync();
                Log.Information($"Found {tasks.Count} tasks for user {userId}");
                return Ok(tasks);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error in GetTasks");
                return StatusCode(500, new { error = "An error occurred while retrieving tasks.", details = ex.Message });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TaskItemDto>> GetTask(int id)
        {
            Console.WriteLine($"TasksController.GetTask called for ID: {id}");
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    Console.WriteLine("Unauthorized: No user ID found");
                    return Unauthorized();
                }

                var task = await _context.Tasks
                    .Include(t => t.AssignedUser)
                    .Include(t => t.Category)
                    .Select(t => new TaskItemDto
                    {
                        Id = t.Id,
                        Title = t.Title,
                        Description = t.Description,
                        DueDate = t.DueDate,
                        IsCompleted = t.IsCompleted,
                        UserId = t.UserId,
                        CategoryId = t.CategoryId,
                        Notes = t.Notes,
                        Progress = t.Progress,
                        TagIds = t.TaskTags.Select(tt => tt.TagId).ToList()
                    })
                    .FirstOrDefaultAsync(t => t.Id == id);

                if (task == null) return NotFound();

                var user = await _userManager.FindByIdAsync(userId);
                var isWorker = await _userManager.IsInRoleAsync(user, "Worker");
                if (isWorker && task.UserId != int.Parse(userId))
                {
                    Console.WriteLine($"Forbidden: Worker {userId} tried to access task {id} not assigned to them");
                    return Forbid();
                }

                return Ok(task);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetTask: {ex.Message}");
                return StatusCode(500, new { error = "An error occurred while retrieving the task.", details = ex.Message });
            }
        }

        [HttpPost]
        [Authorize(Roles = "Manager")]
        public async Task<ActionResult<TaskItemDto>> CreateTask(TaskItemDto taskDto)
        {
            Console.WriteLine($"TasksController.CreateTask called with data: {JsonSerializer.Serialize(taskDto)}");
            try
            {
                if (taskDto == null)
                {
                    return BadRequest(new { error = "Task data is required." });
                }

                if (!ModelState.IsValid)
                {
                    var errors = ModelState.ToDictionary(k => k.Key, v => v.Value.Errors.Select(e => e.ErrorMessage).ToArray());
                    Console.WriteLine($"ModelState errors: {JsonSerializer.Serialize(errors)}");
                    return BadRequest(new { errors });
                }

                if (taskDto.DueDate == default(DateTime))
                {
                    return BadRequest(new { error = "DueDate is required and must be a valid date." });
                }

                if (taskDto.Progress < 0 || taskDto.Progress > 100)
                {
                    return BadRequest(new { error = "Progress must be between 0 and 100." });
                }

                var task = new TaskItem
                {
                    Title = taskDto.Title,
                    Description = taskDto.Description,
                    DueDate = DateTime.SpecifyKind(taskDto.DueDate, DateTimeKind.Utc),
                    IsCompleted = taskDto.IsCompleted,
                    UserId = taskDto.UserId,
                    CategoryId = taskDto.CategoryId,
                    Notes = taskDto.Notes,
                    Progress = taskDto.Progress,
                    TaskTags = taskDto.TagIds?.Select(tagId => new TaskTag { TagId = tagId }).ToList() ?? new List<TaskTag>()
                };

                _context.Tasks.Add(task);
                await _context.SaveChangesAsync();
                Console.WriteLine($"Task created successfully with ID: {task.Id}");

                taskDto.Id = task.Id;
                return CreatedAtAction(nameof(GetTask), new { id = task.Id }, taskDto);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in CreateTask: {ex.Message}");
                return StatusCode(500, new { error = "An error occurred while creating the task.", details = ex.Message });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Worker,Manager")]
        public async Task<IActionResult> UpdateTask(int id, [FromBody] TaskItemDto taskDto)
        {
            Console.WriteLine($"TasksController.UpdateTask called for ID: {id} with data: {JsonSerializer.Serialize(taskDto)}");
            try
            {
                if (id != taskDto.Id) return BadRequest(new { error = "Route id and task Id must match." });

                if (taskDto == null)
                {
                    return BadRequest(new { error = "Task data is required." });
                }

                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var existingTask = await _context.Tasks
                    .Include(t => t.TaskTags)
                    .FirstOrDefaultAsync(t => t.Id == id);
                if (existingTask == null) return NotFound();

                var user = await _userManager.FindByIdAsync(userId);
                var isWorker = await _userManager.IsInRoleAsync(user, "Worker");
                if (isWorker && existingTask.UserId != int.Parse(userId))
                {
                    Console.WriteLine($"Forbidden: Worker {userId} tried to update task {id} not assigned to them");
                    return Forbid();
                }

                if (isWorker)
                {
                    existingTask.IsCompleted = taskDto.IsCompleted;
                    existingTask.Notes = taskDto.Notes;
                }
                else
                {
                    existingTask.Title = taskDto.Title;
                    existingTask.Description = taskDto.Description;
                    existingTask.DueDate = DateTime.SpecifyKind(taskDto.DueDate, DateTimeKind.Utc);
                    existingTask.IsCompleted = taskDto.IsCompleted;
                    existingTask.UserId = taskDto.UserId;
                    existingTask.CategoryId = taskDto.CategoryId;
                    existingTask.Notes = taskDto.Notes;
                    existingTask.Progress = taskDto.Progress;

                    // Оновлення тегів
                    existingTask.TaskTags.Clear();
                    if (taskDto.TagIds != null)
                    {
                        existingTask.TaskTags = taskDto.TagIds.Select(tagId => new TaskTag { TaskId = id, TagId = tagId }).ToList();
                    }
                }

                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in UpdateTask: {ex.Message}");
                return StatusCode(500, new { error = "An error occurred while updating the task.", details = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            Console.WriteLine($"TasksController.DeleteTask called for ID: {id}");
            try
            {
                var task = await _context.Tasks.FindAsync(id);
                if (task == null) return NotFound();
                _context.Tasks.Remove(task);
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in DeleteTask: {ex.Message}");
                return StatusCode(500, new { error = "An error occurred while deleting the task.", details = ex.Message });
            }
        }
    }

    public class TaskItemDto
    {
        public int Id { get; set; }

        [Required]
        public string Title { get; set; }

        public string Description { get; set; }

        [Required]
        public DateTime DueDate { get; set; }

        public bool IsCompleted { get; set; }

        public int? UserId { get; set; }

        public int? CategoryId { get; set; }

        public string Notes { get; set; }

        // Нове поле для прогресу
        public int Progress { get; set; }

        // Нове поле для тегів
        public List<int> TagIds { get; set; }
    }
}