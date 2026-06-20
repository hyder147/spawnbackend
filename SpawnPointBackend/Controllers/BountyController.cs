using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;
using System.Security.Claims;
using System.Text.Json;

namespace SpawnPointBackend.Controllers
{
    /// <summary>
    /// Crash Bounty — developers post bug symptoms as bounties,
    /// testers race to find and reproduce them.
    ///
    /// Flow:
    ///   1. Developer posts a bounty with a public symptom description.
    ///   2. Testers see open bounties for games they are testing.
    ///   3. Tester submits reproduction steps.
    ///   4. AI checks if submission is a duplicate of an earlier one.
    ///   5. Developer reviews and accepts the best submission.
    ///   6. Winner gets a badge added to their profile.
    /// </summary>
    [ApiController]
    [Route("api/bounty")]
    [Authorize]
    public class BountyController : ControllerBase
    {
        private readonly MongoDbContext _context;
        private readonly IConfiguration _config;
        private readonly HttpClient _http;

        public BountyController(MongoDbContext context, IConfiguration config, IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _config = config;
            _http = httpClientFactory.CreateClient();
        }

        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
        private string Username => User.FindFirstValue("username") ?? "";

        // ── CREATE BOUNTY (Developer) ────────────────────────────────────────

        /// <summary>
        /// Developer posts a new bounty for one of their games.
        /// POST /api/bounty
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateBounty([FromBody] CreateBountyDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.GameId))
                return BadRequest(new { message = "GameId is required." });
            if (string.IsNullOrWhiteSpace(dto.Symptom) || dto.Symptom.Trim().Length < 20)
                return BadRequest(new { message = "Symptom description must be at least 20 characters." });

            var game = await _context.Games.Find(g => g.Id == dto.GameId).FirstOrDefaultAsync();
            if (game == null)
                return NotFound(new { message = "Game not found." });

            if (game.DeveloperId != UserId)
                return Forbid();

            var validRewards = new[] { "GoldBadge", "PriorityAccess", "Shoutout", "EliteBadge" };
            var rewardType = validRewards.Contains(dto.RewardType) ? dto.RewardType : "GoldBadge";

            var bounty = new CrashBounty
            {
                GameId = dto.GameId,
                DeveloperId = UserId,
                Symptom = dto.Symptom.Trim(),
                PrivateContext = dto.PrivateContext?.Trim(),
                RewardType = rewardType,
                Status = "Open",
                CreatedAt = DateTime.UtcNow
            };

            await _context.CrashBounties.InsertOneAsync(bounty);

            return Ok(new { bountyId = bounty.Id, message = "Bounty posted successfully." });
        }

        // ── GET OPEN BOUNTIES FOR A GAME (Testers) ───────────────────────────

        /// <summary>
        /// Returns all open bounties for a game.
        /// PrivateContext is hidden from testers.
        /// GET /api/bounty/game/{gameId}
        /// </summary>
        [HttpGet("game/{gameId}")]
        public async Task<IActionResult> GetBountiesForGame(string gameId)
        {
            var bounties = await _context.CrashBounties
                .Find(b => b.GameId == gameId && b.Status == "Open")
                .SortByDescending(b => b.CreatedAt)
                .ToListAsync();

            // Hide private context from testers
            var result = bounties.Select(b => new
            {
                b.Id,
                b.GameId,
                b.Symptom,
                b.RewardType,
                b.Status,
                b.CreatedAt
            });

            return Ok(result);
        }

        // ── GET MY BOUNTIES (Developer) ───────────────────────────────────────

        /// <summary>
        /// Developer sees all their posted bounties including private context.
        /// GET /api/bounty/mine
        /// </summary>
        [HttpGet("mine")]
        public async Task<IActionResult> GetMyBounties()
        {
            var bounties = await _context.CrashBounties
                .Find(b => b.DeveloperId == UserId)
                .SortByDescending(b => b.CreatedAt)
                .ToListAsync();

            return Ok(bounties);
        }

        // ── SUBMIT SOLUTION (Tester) ──────────────────────────────────────────

        /// <summary>
        /// Tester submits reproduction steps for an open bounty.
        /// AI automatically checks for duplicates against existing submissions.
        /// POST /api/bounty/{bountyId}/submit
        /// </summary>
        [HttpPost("{bountyId}/submit")]
        public async Task<IActionResult> SubmitSolution(string bountyId, [FromBody] SubmitBountyDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.ReproSteps) || dto.ReproSteps.Trim().Length < 30)
                return BadRequest(new { message = "Reproduction steps must be at least 30 characters." });

            var bounty = await _context.CrashBounties.Find(b => b.Id == bountyId).FirstOrDefaultAsync();
            if (bounty == null)
                return NotFound(new { message = "Bounty not found." });

            if (bounty.Status != "Open")
                return BadRequest(new { message = "This bounty is no longer open." });

            // Prevent developer from submitting to their own bounty
            if (bounty.DeveloperId == UserId)
                return BadRequest(new { message = "You cannot submit to your own bounty." });

            // Check if this tester already submitted for this bounty
            var alreadySubmitted = await _context.BountySubmissions
                .Find(s => s.BountyId == bountyId && s.TesterId == UserId)
                .AnyAsync();

            if (alreadySubmitted)
                return BadRequest(new { message = "You have already submitted a solution for this bounty." });

            // Fetch existing submissions to check for duplicates
            var existingSubmissions = await _context.BountySubmissions
                .Find(s => s.BountyId == bountyId && s.Status != "Duplicate")
                .ToListAsync();

            bool isDuplicate = false;

            if (existingSubmissions.Any())
            {
                isDuplicate = await CheckDuplicateWithAi(
                    dto.ReproSteps,
                    existingSubmissions.Select(s => s.ReproSteps).ToList()
                );
            }

            var submission = new BountySubmission
            {
                BountyId = bountyId,
                GameId = bounty.GameId,
                TesterId = UserId,
                TesterUsername = Username,
                ReproSteps = dto.ReproSteps.Trim(),
                EvidenceUrl = dto.EvidenceUrl,
                IsDuplicate = isDuplicate,
                Status = isDuplicate ? "Duplicate" : "Pending",
                SubmittedAt = DateTime.UtcNow
            };

            await _context.BountySubmissions.InsertOneAsync(submission);

            if (isDuplicate)
            {
                return Ok(new
                {
                    submissionId = submission.Id,
                    isDuplicate = true,
                    message = "Your submission appears to describe the same bug as an earlier submission. It has been marked as a duplicate."
                });
            }

            return Ok(new
            {
                submissionId = submission.Id,
                isDuplicate = false,
                message = "Submission received! The developer will review it."
            });
        }

        // ── GET SUBMISSIONS (Developer) ───────────────────────────────────────

        /// <summary>
        /// Developer views all non-duplicate submissions for a bounty.
        /// GET /api/bounty/{bountyId}/submissions
        /// </summary>
        [HttpGet("{bountyId}/submissions")]
        public async Task<IActionResult> GetSubmissions(string bountyId)
        {
            var bounty = await _context.CrashBounties.Find(b => b.Id == bountyId).FirstOrDefaultAsync();
            if (bounty == null)
                return NotFound(new { message = "Bounty not found." });

            if (bounty.DeveloperId != UserId)
                return Forbid();

            var submissions = await _context.BountySubmissions
                .Find(s => s.BountyId == bountyId && !s.IsDuplicate)
                .SortBy(s => s.SubmittedAt)
                .ToListAsync();

            return Ok(submissions);
        }

        // ── ACCEPT SUBMISSION (Developer) ─────────────────────────────────────

        /// <summary>
        /// Developer picks the winning submission.
        /// Winner gets a badge. Bounty is marked as Claimed.
        /// POST /api/bounty/{bountyId}/accept/{submissionId}
        /// </summary>
        [HttpPost("{bountyId}/accept/{submissionId}")]
        public async Task<IActionResult> AcceptSubmission(string bountyId, string submissionId)
        {
            var bounty = await _context.CrashBounties.Find(b => b.Id == bountyId).FirstOrDefaultAsync();
            if (bounty == null)
                return NotFound(new { message = "Bounty not found." });

            if (bounty.DeveloperId != UserId)
                return Forbid();

            if (bounty.Status != "Open")
                return BadRequest(new { message = "Bounty is already closed." });

            var submission = await _context.BountySubmissions
                .Find(s => s.Id == submissionId && s.BountyId == bountyId)
                .FirstOrDefaultAsync();

            if (submission == null)
                return NotFound(new { message = "Submission not found." });

            // Mark submission as accepted
            var subUpdate = Builders<BountySubmission>.Update.Set(s => s.Status, "Accepted");
            await _context.BountySubmissions.UpdateOneAsync(s => s.Id == submissionId, subUpdate);

            // Mark bounty as claimed
            var bountyUpdate = Builders<CrashBounty>.Update
                .Set(b => b.Status, "Claimed")
                .Set(b => b.ClaimedByUserId, submission.TesterId)
                .Set(b => b.ClaimedByUsername, submission.TesterUsername)
                .Set(b => b.ClaimedAt, DateTime.UtcNow);
            await _context.CrashBounties.UpdateOneAsync(b => b.Id == bountyId, bountyUpdate);

            // Award badge and increment bounty count on winner's profile
            string badge = bounty.RewardType switch
            {
                "EliteBadge" => "EliteHunter",
                "GoldBadge" => "GoldTester",
                "PriorityAccess" => "PriorityTester",
                _ => "BugHunter"
            };

            var userUpdate = Builders<User>.Update
                .Inc(u => u.BountiesClaimed, 1)
                .AddToSet(u => u.Badges, badge);
            await _context.Users.UpdateOneAsync(u => u.Id == submission.TesterId, userUpdate);

            // Reject all other pending submissions for this bounty
            var rejectOthers = Builders<BountySubmission>.Update.Set(s => s.Status, "Rejected");
            await _context.BountySubmissions.UpdateManyAsync(
                s => s.BountyId == bountyId && s.Id != submissionId && s.Status == "Pending",
                rejectOthers);

            return Ok(new
            {
                message = $"{submission.TesterUsername} has been awarded the bounty and received the '{badge}' badge."
            });
        }

        // ── CLOSE BOUNTY (Developer) ──────────────────────────────────────────

        /// <summary>
        /// Developer closes a bounty without accepting anyone (e.g. bug was fixed).
        /// POST /api/bounty/{bountyId}/close
        /// </summary>
        [HttpPost("{bountyId}/close")]
        public async Task<IActionResult> CloseBounty(string bountyId)
        {
            var bounty = await _context.CrashBounties.Find(b => b.Id == bountyId).FirstOrDefaultAsync();
            if (bounty == null)
                return NotFound(new { message = "Bounty not found." });

            if (bounty.DeveloperId != UserId)
                return Forbid();

            var update = Builders<CrashBounty>.Update
                .Set(b => b.Status, "Closed")
                .Set(b => b.ClosedAt, DateTime.UtcNow);

            await _context.CrashBounties.UpdateOneAsync(b => b.Id == bountyId, update);

            return Ok(new { message = "Bounty closed." });
        }

        // ── TOP BUG HUNTERS ───────────────────────────────────────────────────

        /// <summary>
        /// Public leaderboard of testers ranked by bounties claimed.
        /// GET /api/bounty/leaderboard
        /// </summary>
        [HttpGet("leaderboard")]
        public async Task<IActionResult> GetLeaderboard()
        {
            var hunters = await _context.Users
                .Find(u => u.BountiesClaimed > 0 && u.UserType == "Gamer")
                .SortByDescending(u => u.BountiesClaimed)
                .Limit(20)
                .ToListAsync();

            var result = hunters.Select((u, index) => new
            {
                Rank = index + 1,
                u.Id,
                u.Username,
                u.BountiesClaimed,
                u.Badges
            });

            return Ok(result);
        }

        // ── AI DUPLICATE CHECKER (Private) ────────────────────────────────────

        private async Task<bool> CheckDuplicateWithAi(string newSteps, List<string> existingSteps)
        {
            var apiKey = _config["Anthropic:ApiKey"];
            if (string.IsNullOrEmpty(apiKey))
                return false; // If AI is offline, allow submission through

            var existingFormatted = string.Join("\n---\n",
                existingSteps.Select((s, i) => $"Submission {i + 1}:\n{s}"));

            var prompt = $@"You are a bug report analyst. Compare the new submission below against existing submissions.

NEW SUBMISSION:
{newSteps}

EXISTING SUBMISSIONS:
{existingFormatted}

Does the new submission describe the same bug reproduction steps as any existing submission?
Reply with ONLY a JSON object in this exact format, nothing else:
{{""isDuplicate"": true}} or {{""isDuplicate"": false}}";

            var payload = new
            {
                model = "claude-sonnet-4-6",
                max_tokens = 50,
                messages = new[] { new { role = "user", content = prompt } }
            };

            try
            {
                _http.DefaultRequestHeaders.Clear();
                _http.DefaultRequestHeaders.Add("x-api-key", apiKey);
                _http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

                var res = await _http.PostAsJsonAsync("https://api.anthropic.com/v1/messages", payload);
                if (!res.IsSuccessStatusCode) return false;

                var data = await res.Content.ReadFromJsonAsync<JsonElement>();
                var text = data
                    .GetProperty("content")[0]
                    .GetProperty("text")
                    .GetString() ?? "";

                // Parse { "isDuplicate": true/false }
                text = text.Trim();
                var parsed = JsonSerializer.Deserialize<JsonElement>(text);
                return parsed.GetProperty("isDuplicate").GetBoolean();
            }
            catch
            {
                return false; // On any error, let the submission through
            }
        }
    }

    // ─── DTOs ─────────────────────────────────────────────────────────────────

    public class CreateBountyDto
    {
        public string GameId { get; set; } = null!;

        /// <summary>Visible to testers — describe only the symptom, not the cause.</summary>
        public string Symptom { get; set; } = null!;

        /// <summary>Private notes only the developer can see.</summary>
        public string? PrivateContext { get; set; }

        /// <summary>GoldBadge | PriorityAccess | Shoutout | EliteBadge</summary>
        public string RewardType { get; set; } = "GoldBadge";
    }

    public class SubmitBountyDto
    {
        /// <summary>Step-by-step instructions to reproduce the bug.</summary>
        public string ReproSteps { get; set; } = null!;

        /// <summary>Optional link to a screen recording or screenshot.</summary>
        public string? EvidenceUrl { get; set; }
    }
}