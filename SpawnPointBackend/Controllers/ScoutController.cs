using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;
using System.Security.Claims;

namespace SpawnPointBackend.Controllers
{
    /// <summary>
    /// Scout Mode — turns verified in-app activity (bugs caught, squads led,
    /// badges earned) into a public, ranked talent profile that developers/
    /// studios can browse and directly send recruiting offers to.
    ///
    /// Signal Score is computed from real data, not self-reported:
    ///   - BountiesClaimed & submission accuracy (Crash Bounty history)
    ///   - Squads created/led
    ///   - Badges earned
    /// </summary>
    [ApiController]
    [Route("api/scout")]
    [Authorize]
    public class ScoutController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public ScoutController(MongoDbContext context)
        {
            _context = context;
        }

        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
        private string Username => User.FindFirstValue("username") ?? "";

        // ── TALENT BOARD ──────────────────────────────────────────────────────

        /// <summary>
        /// Ranked list of scoutable testers. Optional filters: role, search.
        /// GET /api/scout/talent?role=QA&search=ash
        /// </summary>
        [HttpGet("talent")]
        public async Task<IActionResult> GetTalent([FromQuery] string? role, [FromQuery] string? search)
        {
            var gamers = await _context.Users
                .Find(u => u.UserType == "Gamer" && !u.IsBanned && !u.IsSuspended)
                .ToListAsync();

            if (gamers.Count == 0)
                return Ok(new List<object>());

            var userIds = gamers.Select(g => g.Id).ToList();

            // Pull related data in bulk rather than per-user round trips.
            var submissions = await _context.BountySubmissions
                .Find(s => userIds.Contains(s.TesterId))
                .ToListAsync();
            var submissionsByUser = submissions.GroupBy(s => s.TesterId).ToDictionary(g => g.Key, g => g.ToList());

            var squads = await _context.Squads
                .Find(s => userIds.Contains(s.CreatedBy))
                .ToListAsync();
            var squadsByUser = squads.GroupBy(s => s.CreatedBy!).ToDictionary(g => g.Key, g => g.Count());

            var profiles = gamers.Select(u =>
            {
                var mySubs = submissionsByUser.TryGetValue(u.Id!, out var s) ? s : new List<BountySubmission>();
                var totalSubs = mySubs.Count;
                var accepted = mySubs.Count(x => x.Status == "Accepted");
                var accuracy = totalSubs > 0 ? (int)Math.Round(accepted * 100.0 / totalSubs) : 0;
                var squadsLed = squadsByUser.TryGetValue(u.Id!, out var c) ? c : 0;

                var roleTrack = ResolveRoleTrack(u, squadsLed);
                var signalScore = ComputeSignalScore(u.BountiesClaimed, accuracy, squadsLed, u.Badges?.Count ?? 0);

                return new
                {
                    id = u.Id,
                    username = u.Username,
                    roleTrack,
                    bugsCaught = u.BountiesClaimed,
                    accuracy,
                    squadsLed,
                    signalScore,
                    topBadge = u.Badges != null && u.Badges.Count > 0 ? u.Badges.Last() : "Rising Talent",
                    blurb = string.IsNullOrWhiteSpace(u.ScoutBlurb)
                        ? $"{u.BountiesClaimed} bugs caught" + (totalSubs > 0 ? $", {accuracy}% repro accuracy." : ".")
                        : u.ScoutBlurb,
                    available = u.OpenToOffers,
                };
            });

            if (!string.IsNullOrWhiteSpace(role) && role != "All")
                profiles = profiles.Where(p => string.Equals(p.roleTrack, role, StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrWhiteSpace(search))
                profiles = profiles.Where(p => p.username.Contains(search, StringComparison.OrdinalIgnoreCase));

            var ranked = profiles.OrderByDescending(p => p.signalScore).ToList();
            return Ok(ranked);
        }

        // ── SEND OFFER (Developer) ────────────────────────────────────────────

        /// <summary>
        /// Developer sends a direct recruiting offer to a scouted tester.
        /// POST /api/scout/offer/{userId}
        /// </summary>
        [HttpPost("offer/{userId}")]
        public async Task<IActionResult> SendOffer(string userId, [FromBody] SendOfferDto dto)
        {
            var developer = await _context.Users.Find(u => u.Id == UserId).FirstOrDefaultAsync();
            if (developer == null)
                return NotFound(new { message = "Developer account not found." });
            if (developer.UserType != "Developer")
                return Forbid();

            var target = await _context.Users.Find(u => u.Id == userId).FirstOrDefaultAsync();
            if (target == null)
                return NotFound(new { message = "Tester not found." });
            if (!target.OpenToOffers)
                return BadRequest(new { message = "This tester is not currently open to offers." });

            var mySubs = await _context.BountySubmissions.Find(s => s.TesterId == userId).ToListAsync();
            var accuracy = mySubs.Count > 0 ? (int)Math.Round(mySubs.Count(x => x.Status == "Accepted") * 100.0 / mySubs.Count) : 0;
            var squadsLed = (int)await _context.Squads.CountDocumentsAsync(s => s.CreatedBy == userId);
            var score = ComputeSignalScore(target.BountiesClaimed, accuracy, squadsLed, target.Badges?.Count ?? 0);

            var offer = new ScoutOffer
            {
                FromDeveloperId = UserId,
                FromDeveloperUsername = Username,
                ToUserId = userId,
                ToUsername = target.Username,
                Note = dto.Note,
                SignalScoreAtOffer = score,
            };

            await _context.ScoutOffers.InsertOneAsync(offer);
            return Ok(new { message = $"Offer sent to @{target.Username}.", offer });
        }

        // ── OFFERS RECEIVED (Tester) ──────────────────────────────────────────

        /// <summary>GET /api/scout/offers/received</summary>
        [HttpGet("offers/received")]
        public async Task<IActionResult> GetReceivedOffers()
        {
            var offers = await _context.ScoutOffers
                .Find(o => o.ToUserId == UserId)
                .SortByDescending(o => o.CreatedAt)
                .ToListAsync();
            return Ok(offers);
        }

        // ── AVAILABILITY TOGGLE (Tester) ──────────────────────────────────────

        /// <summary>PATCH /api/scout/availability</summary>
        [HttpPatch("availability")]
        public async Task<IActionResult> SetAvailability([FromBody] SetAvailabilityDto dto)
        {
            var update = Builders<User>.Update.Set(u => u.OpenToOffers, dto.Open);
            await _context.Users.UpdateOneAsync(u => u.Id == UserId, update);
            return Ok(new { message = dto.Open ? "You are now open to offers." : "You are now hidden from Scout Mode offers." });
        }

        // ── HELPERS ────────────────────────────────────────────────────────────

        private static string ResolveRoleTrack(User u, int squadsLed)
        {
            if (!string.IsNullOrWhiteSpace(u.RoleTrack))
                return u.RoleTrack!;

            var skills = u.Skillsets ?? new List<string>();
            if (skills.Any(s => s.Contains("design", StringComparison.OrdinalIgnoreCase) || s.Contains("balance", StringComparison.OrdinalIgnoreCase)))
                return "Design";
            if (skills.Any(s => s.Contains("production", StringComparison.OrdinalIgnoreCase) || s.Contains("management", StringComparison.OrdinalIgnoreCase) || s.Contains("project", StringComparison.OrdinalIgnoreCase)))
                return "Production";
            if (squadsLed >= 3)
                return "Community";
            return "QA";
        }

        private static int ComputeSignalScore(int bugsCaught, int accuracy, int squadsLed, int badgeCount)
        {
            var raw = bugsCaught * 1.5 + accuracy * 0.4 + squadsLed * 4 + badgeCount * 3;
            return (int)Math.Max(0, Math.Min(100, Math.Round(raw)));
        }
    }

    public class SendOfferDto
    {
        public string? Note { get; set; }
    }

    public class SetAvailabilityDto
    {
        public bool Open { get; set; }
    }
}