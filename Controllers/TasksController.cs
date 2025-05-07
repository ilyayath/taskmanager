using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManager.Data;
using TaskManager.Models;

namespace TaskManager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TasksController : ControllerBase
    {
        private readonly TaskManagerContext _context;

        public TasksController(TaskManagerContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TaskItem>>> GetTasks()
        {
            try
            {
                var tasks = await _context.Tasks.ToListAsync();
                return Ok(tasks);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetTasks: {ex.Message}");
                Console.WriteLine($"Stack Trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"Inner Exception: {ex.InnerException.Message}");
                }
                return StatusCode(500, "An error occurred while retrieving tasks.");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TaskItem>> GetTask(int id)
        {
            try
            {
                var task = await _context.Tasks.FirstOrDefaultAsync(t => t.Id == id);
                if (task == null) return NotFound();
                return task;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetTask: {ex.Message}");
                return StatusCode(500, "An error occurred while retrieving the task.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<TaskItem>> CreateTask(TaskItem task)
        {
            try
            {
                Console.WriteLine($"Received task: {System.Text.Json.JsonSerializer.Serialize(task)}");

                if (ModelState.ContainsKey("AssignedUser"))
                {
                    ModelState.Remove("AssignedUser");
                }

                if (!ModelState.IsValid)
                {
                    Console.WriteLine($"ModelState errors: {System.Text.Json.JsonSerializer.Serialize(ModelState)}");
                    return BadRequest(ModelState);
                }

                task.DueDate = DateTime.SpecifyKind(task.DueDate, DateTimeKind.Utc);
                task.AssignedUser = null;
                _context.Tasks.Add(task);
                await _context.SaveChangesAsync();
                return CreatedAtAction(nameof(GetTask), new { id = task.Id }, task);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in CreateTask: {ex.Message}");
                return StatusCode(500, "An error occurred while creating the task.");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTask(int id, TaskItem task)
        {
            try
            {
                Console.WriteLine($"Received task for PUT: {System.Text.Json.JsonSerializer.Serialize(task)}");

                if (id != task.Id) return BadRequest("Route id and task Id must match.");

                if (ModelState.ContainsKey("AssignedUser"))
                {
                    ModelState.Remove("AssignedUser");
                }

                if (!ModelState.IsValid)
                {
                    Console.WriteLine($"ModelState errors: {System.Text.Json.JsonSerializer.Serialize(ModelState)}");
                    return BadRequest(ModelState);
                }

                var existingTask = await _context.Tasks.FindAsync(id);
                if (existingTask == null) return NotFound();

                // Оновлюємо всі поля
                existingTask.Title = task.Title;
                existingTask.Description = task.Description;
                existingTask.DueDate = DateTime.SpecifyKind(task.DueDate, DateTimeKind.Utc);
                existingTask.IsCompleted = task.IsCompleted;
                existingTask.UserId = task.UserId;

                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in UpdateTask: {ex.Message}");
                return StatusCode(500, "An error occurred while updating the task.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
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
                return StatusCode(500, "An error occurred while deleting the task.");
            }
        }
    }
}