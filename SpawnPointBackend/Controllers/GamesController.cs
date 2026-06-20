
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;

namespace SpawnPointBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class GamesController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public GamesController(MongoDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var games = await _context.Games.Find(_ => true).ToListAsync();
            return Ok(games);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var game = await _context.Games.Find(g => g.Id == id).FirstOrDefaultAsync();
            if (game == null) return NotFound();
            return Ok(game);
        }

        [HttpPost]
        public async Task<IActionResult> Create(Game game)
        {
            game.CreatedAt = DateTime.UtcNow;
            await _context.Games.InsertOneAsync(game);
            return Ok(game);
        }

        [HttpPost("{id}/apply")]
        public async Task<IActionResult> ApplyForBeta(string id, [FromBody] BetaApplicationDto dto)
        {
            var game = await _context.Games.Find(g => g.Id == id).FirstOrDefaultAsync();
            if (game == null) return NotFound(new { message = "Game not found." });

            return Ok(new { message = $"{game.Title} your application has been submitted!" });
        }
    }

    //public class BetaApplicationDto
    //{
    //    public string UserId { get; set; } = null!;
    //    public string Reason { get; set; } = null!;
    //}
}