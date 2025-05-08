using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;

namespace TaskManager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AntiforgeryController : ControllerBase
    {
        private readonly IAntiforgery _antiforgery;

        public AntiforgeryController(IAntiforgery antiforgery)
        {
            _antiforgery = antiforgery;
        }

        [HttpGet("token")]
        [IgnoreAntiforgeryToken]
        public IActionResult GetToken()
        {
            try
            {
                var token = _antiforgery.GetAndStoreTokens(HttpContext);
                if (string.IsNullOrEmpty(token.RequestToken))
                {
                    return StatusCode(500, new { error = "Failed to generate CSRF token." });
                }
                return Ok(new { token = token.RequestToken });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error generating CSRF token.", details = ex.Message });
            }
        }
    }
}