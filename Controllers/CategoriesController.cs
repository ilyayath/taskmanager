using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManager.Data;
using TaskManager.Models;
using System.Text.Json;
using Serilog;

namespace TaskManager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [Produces("application/json")]
    public class CategoriesController : ControllerBase
    {
        private readonly TaskManagerContext _context;

        public CategoriesController(TaskManagerContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Category>>> GetCategories()
        {
            Log.Information("CategoriesController.GetCategories called");
            try
            {
                Log.Information("Fetching categories...");
                var categories = await _context.Categories.ToListAsync();
                if (categories == null || !categories.Any())
                {
                    Log.Information("No categories found, returning empty list.");
                }
                else
                {
                    Log.Information($"Found {categories.Count} categories.");
                }
                return Ok(categories); // Завжди повертаємо 200, навіть якщо список порожній
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error in GetCategories");
                return StatusCode(500, new { error = "An error occurred while retrieving categories.", details = ex.Message });
            }
        }

        [HttpPost]
        [Authorize(Roles = "Manager")]
        public async Task<ActionResult<Category>> CreateCategory([FromBody] Category category)
        {
            Console.WriteLine($"CategoriesController.CreateCategory called with data: {JsonSerializer.Serialize(category)}");
            try
            {
                if (category == null || string.IsNullOrEmpty(category.Name))
                {
                    return BadRequest(new { error = "Category name is required." });
                }

                ModelState.Remove("Tasks");

                if (!ModelState.IsValid)
                {
                    var errors = ModelState.ToDictionary(
                        kvp => kvp.Key,
                        kvp => kvp.Value.Errors.Select(e => e.ErrorMessage).ToArray()
                    );
                    Console.WriteLine($"ModelState errors: {JsonSerializer.Serialize(errors)}");
                    return BadRequest(new { errors });
                }

                category.Tasks ??= new List<TaskItem>();

                _context.Categories.Add(category);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetCategories), new { id = category.Id }, category);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in CreateCategory: {ex.Message}");
                return StatusCode(500, new { error = "An error occurred while creating the category.", details = ex.Message });
            }
        }
    }
}