using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManager.Data;
using TaskManager.Models;

namespace TaskManager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TagsController : ControllerBase
    {
        private readonly TaskManagerContext _context;

        public TagsController(TaskManagerContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Tag>>> GetTags()
        {
            var tags = await _context.Tags.ToListAsync();
            if (tags == null || !tags.Any())
            {
                return Ok(new List<Tag>()); // Повертаємо порожній список замість null
            }
            return Ok(tags);
        }

        [HttpPost]
        [Authorize(Roles = "Manager")]
        public async Task<ActionResult<Tag>> CreateTag([FromBody] Tag tag)
        {
            if (string.IsNullOrEmpty(tag.Name))
            {
                return BadRequest(new { error = "Tag name is required." });
            }

            _context.Tags.Add(tag);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetTags), new { id = tag.Id }, tag);
        }
    }
}