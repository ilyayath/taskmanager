using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManager.Data;
using TaskManager.Models;

namespace TaskManager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [Produces("application/json")]
    public class UsersController : ControllerBase
    {
        private readonly TaskManagerContext _context;

        public UsersController(TaskManagerContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<UserDto>>> GetUsers()
        {
            try
            {
                var users = await _context.Users
                    .Select(u => new UserDto
                    {
                        Id = u.Id,
                        Name = u.Name,
                        Email = u.Email
                    })
                    .ToListAsync();
                if (users == null || !users.Any()) return NotFound();
                return Ok(users);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetUsers: {ex.Message}");
                return StatusCode(500, new { error = "An error occurred while retrieving users.", details = ex.Message });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<UserDto>> GetUser(int id)
        {
            try
            {
                var user = await _context.Users
                    .Select(u => new UserDto
                    {
                        Id = u.Id,
                        Name = u.Name,
                        Email = u.Email
                    })
                    .FirstOrDefaultAsync(u => u.Id == id);
                if (user == null) return NotFound();
                return Ok(user);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetUser: {ex.Message}");
                return StatusCode(500, new { error = "An error occurred while retrieving the user.", details = ex.Message });
            }
        }
    }
}