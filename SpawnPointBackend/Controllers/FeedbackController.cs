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
    public class FeedbackController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public FeedbackController(MongoDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<IActionResult> Create(Feedback feedback)
        {
            if (string.IsNullOrWhiteSpace(feedback.GameId))
                return BadRequest(new { message = "GameId is required." });

            if (string.IsNullOrWhiteSpace(feedback.GamerId))
                return BadRequest(new { message = "GamerId is required." });

            if (string.IsNullOrWhiteSpace(feedback.Comment))
                return BadRequest(new { message = "Comment is required." });

            if (feedback.Rating < 1 || feedback.Rating > 5)
                return BadRequest(new { message = "Rating must be between 1 and 5." });

            // Verify game exists
            var game = await _context.Games.Find(g => g.Id == feedback.GameId).FirstOrDefaultAsync();
            if (game == null)
                return NotFound(new { message = "Game not found." });

            await _context.Feedback.InsertOneAsync(feedback);
            return Ok(feedback);
        }

        [HttpGet("game/{gameId}")]
        public async Task<IActionResult> GetByGame(string gameId)
        {
            var feedback = await _context.Feedback
                .Find(f => f.GameId == gameId)
                .ToListAsync();
            return Ok(feedback);
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetByUser(string userId)
        {
            var feedback = await _context.Feedback
                .Find(f => f.GamerId == userId)
                .ToListAsync();
            return Ok(feedback);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            await _context.Feedback.DeleteOneAsync(f => f.Id == id);
            return Ok(new { message = "Feedback deleted." });
        }
    }
}