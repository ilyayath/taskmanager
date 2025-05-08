using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManager.Data;

namespace TaskManager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class HealthController : ControllerBase
    {
        private readonly TaskManagerContext _context;

        public HealthController(TaskManagerContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> CheckHealth()
        {
            try
            {
                // Перевірка підключення до бази даних
                await _context.Database.CanConnectAsync();
                return Ok(new { status = "Healthy", database = "Connected", timestamp = DateTime.UtcNow });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = "Unhealthy", error = ex.Message });
            }
        }
    }
}