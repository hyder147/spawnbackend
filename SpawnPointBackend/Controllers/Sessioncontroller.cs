using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;
using System.Security.Claims;

namespace SpawnPointBackend.Controllers
{
    /// <summary>
    /// Ghost Mode — tracks live testing sessions.
    ///
    /// Flow:
    ///   1. Tester calls POST /api/session/start when they launch the game.
    ///   2. Frontend pings POST /api/session/ping every 30 seconds while game is open.
    ///   3. Tester calls POST /api/session/end when they close the game.
    ///   4. If no ping arrives for 5+ minutes AND no feedback was submitted,
    ///      the background checker (GhostCheckerService) marks the session as ghosted
    ///      and increments the tester's GhostCount.
    ///   5. Developer calls GET /api/session/live/{gameId} to see who is playing right now.
    /// </summary>
    [ApiController]
    [Route("api/session")]
    [Authorize]
    public class SessionController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public SessionController(MongoDbContext context)
        {
            _context = context;
        }

        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
        private string Username => User.FindFirstValue("username") ?? "";

        // ── START SESSION ────────────────────────────────────────────────────

        /// <summary>
        /// Tester calls this when they open the game.
        /// POST /api/session/start
        /// Body: { "gameId": "..." }
        /// </summary>
        [HttpPost("start")]
        public async Task<IActionResult> StartSession([FromBody] StartSessionDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.GameId))
                return BadRequest(new { message = "GameId is required." });

            var game = await _context.Games.Find(g => g.Id == dto.GameId).FirstOrDefaultAsync();
            if (game == null)
                return NotFound(new { message = "Game not found." });

            // Close any existing active session for this tester + game
            var existingFilter = Builders<TestingSession>.Filter.Where(
                s => s.TesterId == UserId && s.GameId == dto.GameId && s.IsActive);

            var closeExisting = Builders<TestingSession>.Update
                .Set(s => s.IsActive, false)
                .Set(s => s.EndedAt, DateTime.UtcNow);

            await _context.TestingSessions.UpdateManyAsync(existingFilter, closeExisting);

            var session = new TestingSession
            {
                GameId = dto.GameId,
                TesterId = UserId,
                TesterUsername = Username,
                SessionStart = DateTime.UtcNow,
                LastPing = DateTime.UtcNow,
                IsActive = true,
                IsGhosted = false,
                EndedCleanly = false
            };

            await _context.TestingSessions.InsertOneAsync(session);

            return Ok(new { sessionId = session.Id, message = "Session started." });
        }

        // ── HEARTBEAT PING ───────────────────────────────────────────────────

        /// <summary>
        /// Frontend sends this every 30 seconds while the game is open.
        /// POST /api/session/ping
        /// Body: { "sessionId": "..." }
        /// </summary>
        [HttpPost("ping")]
        public async Task<IActionResult> Ping([FromBody] PingSessionDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.SessionId))
                return BadRequest(new { message = "SessionId is required." });

            var update = Builders<TestingSession>.Update
                .Set(s => s.LastPing, DateTime.UtcNow);

            var result = await _context.TestingSessions.UpdateOneAsync(
                s => s.Id == dto.SessionId && s.TesterId == UserId && s.IsActive,
                update);

            if (result.MatchedCount == 0)
                return NotFound(new { message = "Active session not found." });

            return Ok(new { message = "Ping received." });
        }

        // ── END SESSION ──────────────────────────────────────────────────────

        /// <summary>
        /// Tester calls this when they close the game properly.
        /// A clean end does NOT count as a ghost even without feedback.
        /// POST /api/session/end
        /// Body: { "sessionId": "...", "submittedFeedback": true/false }
        /// </summary>
        [HttpPost("end")]
        public async Task<IActionResult> EndSession([FromBody] EndSessionDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.SessionId))
                return BadRequest(new { message = "SessionId is required." });

            var session = await _context.TestingSessions
                .Find(s => s.Id == dto.SessionId && s.TesterId == UserId)
                .FirstOrDefaultAsync();

            if (session == null)
                return NotFound(new { message = "Session not found." });

            // If tester ended WITHOUT submitting feedback, mark as ghosted
            bool ghosted = !dto.SubmittedFeedback;

            var update = Builders<TestingSession>.Update
                .Set(s => s.IsActive, false)
                .Set(s => s.EndedCleanly, true)
                .Set(s => s.IsGhosted, ghosted)
                .Set(s => s.EndedAt, DateTime.UtcNow);

            await _context.TestingSessions.UpdateOneAsync(s => s.Id == dto.SessionId, update);

            if (ghosted)
            {
                // Increment tester's ghost count
                var ghostUpdate = Builders<User>.Update.Inc(u => u.GhostCount, 1);
                await _context.Users.UpdateOneAsync(u => u.Id == UserId, ghostUpdate);
            }

            return Ok(new
            {
                message = ghosted
                    ? "Session ended. No feedback was submitted — this has been recorded."
                    : "Session ended cleanly. Thank you for testing!"
            });
        }

        // ── LIVE ROOM (Developer Only) ───────────────────────────────────────

        /// <summary>
        /// Developer sees who is currently playing their game in real time.
        /// A session is considered "live" if its last ping was within 2 minutes.
        /// GET /api/session/live/{gameId}
        /// </summary>
        [HttpGet("live/{gameId}")]
        public async Task<IActionResult> GetLiveSessions(string gameId)
        {
            var cutoff = DateTime.UtcNow.AddMinutes(-2);

            var liveSessions = await _context.TestingSessions
                .Find(s => s.GameId == gameId && s.IsActive && s.LastPing >= cutoff)
                .SortByDescending(s => s.LastPing)
                .ToListAsync();

            var result = liveSessions.Select(s => new
            {
                s.TesterId,
                s.TesterUsername,
                s.SessionStart,
                s.LastPing,
                MinutesPlaying = (int)(DateTime.UtcNow - s.SessionStart).TotalMinutes
            });

            return Ok(new
            {
                liveCount = liveSessions.Count,
                testers = result
            });
        }

        // ── SESSION HISTORY (Developer) ──────────────────────────────────────

        /// <summary>
        /// Developer sees full history for their game — who played, who ghosted.
        /// GET /api/session/history/{gameId}
        /// </summary>
        [HttpGet("history/{gameId}")]
        public async Task<IActionResult> GetSessionHistory(string gameId)
        {
            var sessions = await _context.TestingSessions
                .Find(s => s.GameId == gameId)
                .SortByDescending(s => s.SessionStart)
                .Limit(100)
                .ToListAsync();

            var result = sessions.Select(s => new
            {
                s.TesterUsername,
                s.SessionStart,
                s.EndedAt,
                s.IsActive,
                s.IsGhosted,
                s.EndedCleanly,
                MinutesPlayed = s.EndedAt.HasValue
                    ? (int)(s.EndedAt.Value - s.SessionStart).TotalMinutes
                    : (int)(DateTime.UtcNow - s.SessionStart).TotalMinutes
            });

            return Ok(result);
        }

        // ── GHOST LEADERBOARD (Developer) ────────────────────────────────────

        /// <summary>
        /// Returns testers sorted by ghost count — so developer knows who to avoid approving.
        /// GET /api/session/ghosts
        /// </summary>
        [HttpGet("ghosts")]
        public async Task<IActionResult> GetGhostLeaderboard()
        {
            var ghostTesters = await _context.Users
                .Find(u => u.GhostCount > 0 && u.UserType == "Gamer")
                .SortByDescending(u => u.GhostCount)
                .Limit(50)
                .ToListAsync();

            var result = ghostTesters.Select(u => new
            {
                u.Id,
                u.Username,
                u.GhostCount
            });

            return Ok(result);
        }
    }

    // ─── DTOs ─────────────────────────────────────────────────────────────────

    public class StartSessionDto
    {
        public string GameId { get; set; } = null!;
    }

    public class PingSessionDto
    {
        public string SessionId { get; set; } = null!;
    }

    public class EndSessionDto
    {
        public string SessionId { get; set; } = null!;

        /// <summary>Set to true if the tester already submitted feedback before ending.</summary>
        public bool SubmittedFeedback { get; set; } = false;
    }
}