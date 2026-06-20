using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;

namespace SpawnPointBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BetaTestingController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public BetaTestingController(MongoDbContext context)
        {
            _context = context;
        }

        [HttpPost("apply")]
        public async Task<IActionResult> Apply(BetaApplicationDto application)
        {
            var game = await _context.Games.Find(g => g.Id == application.GameId).FirstOrDefaultAsync();
            if (game == null) return NotFound("Game not found");

            if (game.BetaTesters == null) game.BetaTesters = new List<BetaTester>();
            
            if (game.BetaTesters.Any(t => t.GamerId == application.GamerId))
                return BadRequest("Already applied");

            game.BetaTesters.Add(new BetaTester { GamerId = application.GamerId, Status = "Pending" });
            await _context.Games.ReplaceOneAsync(g => g.Id == application.GameId, game);
            
            return Ok(game);
        }

        [HttpPut("{gameId}/approve/{gamerId}")]
        public async Task<IActionResult> Approve(string gameId, string gamerId)
        {
            var game = await _context.Games.Find(g => g.Id == gameId).FirstOrDefaultAsync();
            if (game == null) return NotFound("Game not found");

            var tester = game.BetaTesters?.FirstOrDefault(t => t.GamerId == gamerId);
            if (tester == null) return NotFound("Application not found");

            tester.Status = "Approved";
            await _context.Games.ReplaceOneAsync(g => g.Id == gameId, game);
            return Ok(game);
        }

        [HttpPut("{gameId}/reject/{gamerId}")]
        public async Task<IActionResult> Reject(string gameId, string gamerId)
        {
            var game = await _context.Games.Find(g => g.Id == gameId).FirstOrDefaultAsync();
            if (game == null) return NotFound("Game not found");

            var tester = game.BetaTesters?.FirstOrDefault(t => t.GamerId == gamerId);
            if (tester == null) return NotFound("Application not found");

            tester.Status = "Rejected";
            await _context.Games.ReplaceOneAsync(g => g.Id == gameId, game);
            return Ok(game);
        }

        [HttpGet("game/{gameId}")]
        public async Task<IActionResult> GetTesters(string gameId)
        {
            var game = await _context.Games.Find(g => g.Id == gameId).FirstOrDefaultAsync();
            if (game == null) return NotFound("Game not found");
            return Ok(game.BetaTesters ?? new List<BetaTester>());
        }
    }

    public class BetaApplicationDto
    {
        public string GameId { get; set; } = null!;
        public string GamerId { get; set; } = null!;
    }
}
