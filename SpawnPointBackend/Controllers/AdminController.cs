using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;
using System.Security.Claims;

namespace SpawnPointBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = "AdminOnly")]
    public class AdminController : ControllerBase
    {
        private readonly MongoDbContext _ctx;

        public AdminController(MongoDbContext ctx)
        {
            _ctx = ctx;
        }

        // ─── Helpers ──────────────────────────────────────────────────────────
        private string AdminId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        private string AdminUsername => User.FindFirstValue("username") ?? "admin";

        private async Task LogAsync(string action, string targetType, string targetId, string? reason = null, string? details = null)
        {
            var log = new AdminLog
            {
                AdminId = AdminId,
                AdminUsername = AdminUsername,
                Action = action,
                TargetType = targetType,
                TargetId = targetId,
                Reason = reason,
                Details = details,
            };
            await _ctx.AdminLogs.InsertOneAsync(log);
        }

        private static object SafeUser(User u) => new
        {
            id = u.Id,
            username = u.Username,
            email = u.Email,
            userType = u.UserType,
            role = u.Role,
            isEmailVerified = u.IsEmailVerified,
            isSuspended = u.IsSuspended,
            suspendReason = u.SuspendReason,
            suspendedAt = u.SuspendedAt,
            suspendedUntil = u.SuspendedUntil,
            isBanned = u.IsBanned,
            banReason = u.BanReason,
            bannedAt = u.BannedAt,
            adminNotes = u.AdminNotes,
            createdAt = u.CreatedAt
        };

        // ══════════════════════════════════════════════════════════════════════
        // DASHBOARD STATS
        // ══════════════════════════════════════════════════════════════════════

        /// <summary>Platform ke overall stats — dashboard ke liye</summary>
        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var stats = new PlatformStats
            {
                TotalUsers = await _ctx.Users.CountDocumentsAsync(FilterDefinition<User>.Empty),
                TotalDevelopers = await _ctx.Users.CountDocumentsAsync(u => u.UserType == "Developer"),
                TotalGamers = await _ctx.Users.CountDocumentsAsync(u => u.UserType == "Gamer"),
                TotalGames = await _ctx.Games.CountDocumentsAsync(FilterDefinition<Game>.Empty),
                TotalPosts = await _ctx.Posts.CountDocumentsAsync(FilterDefinition<Post>.Empty),
                TotalCommunities = await _ctx.Communities.CountDocumentsAsync(FilterDefinition<Community>.Empty),
                TotalSquads = await _ctx.Squads.CountDocumentsAsync(FilterDefinition<Squad>.Empty),
                SuspendedUsers = await _ctx.Users.CountDocumentsAsync(u => u.IsSuspended),
                BannedUsers = await _ctx.Users.CountDocumentsAsync(u => u.IsBanned),
                UnverifiedUsers = await _ctx.Users.CountDocumentsAsync(u => !u.IsEmailVerified),
            };
            return Ok(stats);
        }

        // ══════════════════════════════════════════════════════════════════════
        // USER MANAGEMENT
        // ══════════════════════════════════════════════════════════════════════

        /// <summary>Saare users ki list — pagination + filter support</summary>
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 20,
            [FromQuery] string? search = null,
            [FromQuery] string? userType = null,
            [FromQuery] string? status = null)   // "active"|"suspended"|"banned"|"unverified"
        {
            var filter = Builders<User>.Filter.Empty;

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchLower = search.ToLower();
                filter &= Builders<User>.Filter.Or(
                    Builders<User>.Filter.Where(u => u.Username.ToLower().Contains(searchLower)),
                    Builders<User>.Filter.Where(u => u.Email.ToLower().Contains(searchLower))
                );
            }

            if (!string.IsNullOrWhiteSpace(userType))
                filter &= Builders<User>.Filter.Eq(u => u.UserType, userType);

            if (status == "suspended")
                filter &= Builders<User>.Filter.Eq(u => u.IsSuspended, true);
            else if (status == "banned")
                filter &= Builders<User>.Filter.Eq(u => u.IsBanned, true);
            else if (status == "unverified")
                filter &= Builders<User>.Filter.Eq(u => u.IsEmailVerified, false);
            else if (status == "active")
                filter &= Builders<User>.Filter.And(
                    Builders<User>.Filter.Eq(u => u.IsSuspended, false),
                    Builders<User>.Filter.Eq(u => u.IsBanned, false),
                    Builders<User>.Filter.Eq(u => u.IsEmailVerified, true)
                );

            var total = await _ctx.Users.CountDocumentsAsync(filter);
            var users = await _ctx.Users.Find(filter)
                .SortByDescending(u => u.CreatedAt)
                .Skip((page - 1) * limit)
                .Limit(limit)
                .ToListAsync();

            return Ok(new
            {
                total,
                page,
                limit,
                totalPages = (int)Math.Ceiling((double)total / limit),
                users = users.Select(SafeUser)
            });
        }

        /// <summary>Single user detail</summary>
        [HttpGet("users/{id}")]
        public async Task<IActionResult> GetUser(string id)
        {
            var user = await _ctx.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found." });

            var postCount = await _ctx.Posts.CountDocumentsAsync(p => p.UserId == id);
            var gameCount = await _ctx.Games.CountDocumentsAsync(g => g.DeveloperId == id);
            var feedbackCount = await _ctx.Feedback.CountDocumentsAsync(f => f.GamerId == id);

            return Ok(new
            {
                user = SafeUser(user),
                activity = new { postCount, gameCount, feedbackCount }
            });
        }

        // ─── SUSPEND ──────────────────────────────────────────────────────────

        /// <summary>User ko suspend karo</summary>
        [HttpPost("users/{id}/suspend")]
        public async Task<IActionResult> Suspend(string id, [FromBody] SuspendDto dto)
        {
            if (id == AdminId)
                return BadRequest(new { message = "Aap apne aap ko suspend nahi kar sakte." });

            var user = await _ctx.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found." });
            if (user.Role == "admin") return Forbid();

            DateTime? until = dto.DurationHours.HasValue
                ? DateTime.UtcNow.AddHours(dto.DurationHours.Value)
                : null;

            var update = Builders<User>.Update
                .Set(u => u.IsSuspended, true)
                .Set(u => u.SuspendReason, dto.Reason)
                .Set(u => u.SuspendedAt, DateTime.UtcNow)
                .Set(u => u.SuspendedUntil, until);

            await _ctx.Users.UpdateOneAsync(u => u.Id == id, update);
            await LogAsync("suspend", "user", id, dto.Reason,
                until.HasValue ? $"Until: {until:yyyy-MM-dd HH:mm} UTC" : "Permanent suspension");

            return Ok(new { message = $"User @{user.Username} suspended{(until.HasValue ? $" until {until:yyyy-MM-dd HH:mm} UTC" : " permanently")}." });
        }

        /// <summary>User ka suspension hata do</summary>
        [HttpPost("users/{id}/unsuspend")]
        public async Task<IActionResult> Unsuspend(string id)
        {
            var user = await _ctx.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found." });

            var update = Builders<User>.Update
                .Set(u => u.IsSuspended, false)
                .Unset(u => u.SuspendReason)
                .Unset(u => u.SuspendedAt)
                .Unset(u => u.SuspendedUntil);

            await _ctx.Users.UpdateOneAsync(u => u.Id == id, update);
            await LogAsync("unsuspend", "user", id);

            return Ok(new { message = $"User @{user.Username} ka suspension hata diya gaya." });
        }

        // ─── BAN ──────────────────────────────────────────────────────────────

        /// <summary>User ko permanently ban karo</summary>
        [HttpPost("users/{id}/ban")]
        public async Task<IActionResult> Ban(string id, [FromBody] ReasonDto dto)
        {
            if (id == AdminId)
                return BadRequest(new { message = "Aap apne aap ko ban nahi kar sakte." });

            var user = await _ctx.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found." });
            if (user.Role == "admin") return Forbid();

            var update = Builders<User>.Update
                .Set(u => u.IsBanned, true)
                .Set(u => u.BanReason, dto.Reason)
                .Set(u => u.BannedAt, DateTime.UtcNow)
                .Set(u => u.IsSuspended, false);

            await _ctx.Users.UpdateOneAsync(u => u.Id == id, update);
            await LogAsync("ban", "user", id, dto.Reason);

            return Ok(new { message = $"User @{user.Username} permanently ban ho gaya." });
        }

        /// <summary>User ka ban hata do</summary>
        [HttpPost("users/{id}/unban")]
        public async Task<IActionResult> Unban(string id)
        {
            var user = await _ctx.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found." });

            var update = Builders<User>.Update
                .Set(u => u.IsBanned, false)
                .Unset(u => u.BanReason)
                .Unset(u => u.BannedAt);

            await _ctx.Users.UpdateOneAsync(u => u.Id == id, update);
            await LogAsync("unban", "user", id);

            return Ok(new { message = $"User @{user.Username} ka ban hata diya gaya." });
        }

        // ─── ROLE ─────────────────────────────────────────────────────────────

        /// <summary>User ka role change karo (admin/moderator/user)</summary>
        [HttpPost("users/{id}/role")]
        public async Task<IActionResult> ChangeRole(string id, [FromBody] RoleDto dto)
        {
            if (id == AdminId && dto.Role != "admin")
                return BadRequest(new { message = "Aap apna admin role nahi hata sakte." });

            var validRoles = new[] { "user", "moderator", "admin" };
            if (!validRoles.Contains(dto.Role))
                return BadRequest(new { message = "Role 'user', 'moderator', ya 'admin' hona chahiye." });

            var user = await _ctx.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found." });

            var old = user.Role;
            await _ctx.Users.UpdateOneAsync(u => u.Id == id,
                Builders<User>.Update.Set(u => u.Role, dto.Role));
            await LogAsync("role_change", "user", id, null, $"{old} → {dto.Role}");

            return Ok(new { message = $"@{user.Username} ka role '{dto.Role}' kar diya gaya." });
        }

        // ─── ADMIN NOTES ──────────────────────────────────────────────────────

        /// <summary>User ke baare mein admin notes save karo</summary>
        [HttpPut("users/{id}/notes")]
        public async Task<IActionResult> UpdateNotes(string id, [FromBody] NotesDto dto)
        {
            var user = await _ctx.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found." });

            await _ctx.Users.UpdateOneAsync(u => u.Id == id,
                Builders<User>.Update.Set(u => u.AdminNotes, dto.Notes));

            return Ok(new { message = "Notes save ho gayi." });
        }

        // ─── DELETE USER (with 30-day Recovery) ───────────────────────────────

        /// <summary>User delete karo — 30 din baad recovery bhi ho sakti hai</summary>
        [HttpDelete("users/{id}")]
        public async Task<IActionResult> DeleteUser(string id, [FromBody] ReasonDto? dto = null)
        {
            if (id == AdminId)
                return BadRequest(new { message = "Aap apna account delete nahi kar sakte." });

            var user = await _ctx.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found." });
            if (user.Role == "admin") return Forbid();

            // Pehle DeletedUsers mein backup save karo (recovery ke liye)
            var backup = new DeletedUser
            {
                OriginalUserId = user.Id!,
                Username = user.Username,
                Email = user.Email,
                PasswordHash = user.PasswordHash,
                UserType = user.UserType,
                Role = user.Role,
                IsEmailVerified = user.IsEmailVerified,
                AdminNotes = user.AdminNotes,
                DeletedByAdminId = AdminId,
                DeletedByAdminUsername = AdminUsername,
                DeleteReason = dto?.Reason,
                RecoveryDeadline = DateTime.UtcNow.AddDays(30),
            };
            await _ctx.DeletedUsers.InsertOneAsync(backup);

            // Cascade delete
            await _ctx.Users.DeleteOneAsync(u => u.Id == id);
            await _ctx.Posts.DeleteManyAsync(p => p.UserId == id);
            await _ctx.Stories.DeleteManyAsync(s => s.UserId == id);
            await _ctx.Feedback.DeleteManyAsync(f => f.GamerId == id);
            await _ctx.FriendRequests.DeleteManyAsync(f => f.SenderId == id || f.ReceiverId == id);
            await _ctx.Blocks.DeleteManyAsync(b => b.BlockerId == id || b.BlockedId == id);

            await LogAsync("delete_user", "user", id, dto?.Reason,
                $"Username: {user.Username}, Email: {user.Email} | Recovery ID: {backup.Id} | Deadline: {backup.RecoveryDeadline:yyyy-MM-dd}");

            return Ok(new
            {
                message = $"User @{user.Username} delete ho gaya. 30 din tak Recovery tab se wapis laya ja sakta hai.",
                recoveryId = backup.Id
            });
        }

        // ─── GET DELETED USERS ────────────────────────────────────────────────

        [HttpGet("deleted-users")]
        public async Task<IActionResult> GetDeletedUsers(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 20,
            [FromQuery] bool? recoverable = null)
        {
            var filter = Builders<DeletedUser>.Filter.Eq(d => d.IsRecovered, false);

            if (recoverable == true)
                filter &= Builders<DeletedUser>.Filter.Gt(d => d.RecoveryDeadline, DateTime.UtcNow);
            else if (recoverable == false)
                filter &= Builders<DeletedUser>.Filter.Lte(d => d.RecoveryDeadline, DateTime.UtcNow);

            var total = await _ctx.DeletedUsers.CountDocumentsAsync(filter);
            var deletedUsers = await _ctx.DeletedUsers.Find(filter)
                .SortByDescending(d => d.DeletedAt)
                .Skip((page - 1) * limit)
                .Limit(limit)
                .ToListAsync();

            return Ok(new
            {
                total,
                page,
                limit,
                users = deletedUsers.Select(d => new
                {
                    d.Id,
                    d.OriginalUserId,
                    d.Username,
                    d.Email,
                    d.UserType,
                    d.Role,
                    d.DeletedAt,
                    d.RecoveryDeadline,
                    d.DeletedByAdminUsername,
                    d.DeleteReason,
                    d.IsRecovered,
                    d.RecoveredAt,
                    canRecover = !d.IsRecovered && d.RecoveryDeadline > DateTime.UtcNow,
                    daysLeft = d.IsRecovered ? 0 : Math.Max(0, (int)(d.RecoveryDeadline - DateTime.UtcNow).TotalDays)
                })
            });
        }

        // ─── RECOVER USER ─────────────────────────────────────────────────────

        [HttpPost("deleted-users/{id}/recover")]
        public async Task<IActionResult> RecoverUser(string id, [FromBody] RecoverDto dto)
        {
            var deletedUser = await _ctx.DeletedUsers.Find(d => d.Id == id).FirstOrDefaultAsync();
            if (deletedUser == null)
                return NotFound(new { message = "Deleted user record nahi mila." });
            if (deletedUser.IsRecovered)
                return BadRequest(new { message = "Ye account pehle hi recover ho chuka hai." });
            if (deletedUser.RecoveryDeadline < DateTime.UtcNow)
                return BadRequest(new { message = "Recovery window guzar gayi (30 din limit)." });

            var existingUser = await _ctx.Users.Find(u => u.Email == deletedUser.Email).FirstOrDefaultAsync();
            if (existingUser != null)
                return Conflict(new { message = $"Is email se '{existingUser.Username}' account pehle se exist karta hai." });

            var recoveredUser = new User
            {
                Username = deletedUser.Username,
                Email = deletedUser.Email,
                PasswordHash = deletedUser.PasswordHash,
                UserType = deletedUser.UserType,
                Role = deletedUser.Role,
                IsEmailVerified = deletedUser.IsEmailVerified,
                AdminNotes = $"[RECOVERED {DateTime.UtcNow:yyyy-MM-dd}] {deletedUser.AdminNotes}",
                CreatedAt = DateTime.UtcNow,
            };
            await _ctx.Users.InsertOneAsync(recoveredUser);

            await _ctx.DeletedUsers.UpdateOneAsync(
                d => d.Id == id,
                Builders<DeletedUser>.Update
                    .Set(d => d.IsRecovered, true)
                    .Set(d => d.RecoveredAt, DateTime.UtcNow)
                    .Set(d => d.RecoveredByAdminId, AdminId));

            await LogAsync("recover_user", "user", recoveredUser.Id ?? id, dto.Reason,
                $"Recovered: {deletedUser.Username} ({deletedUser.Email})");

            return Ok(new
            {
                message = $"@{deletedUser.Username} ka account recover ho gaya!",
                newUserId = recoveredUser.Id,
                username = recoveredUser.Username,
                email = recoveredUser.Email
            });
        }

        // ─── REPORTS ─────────────────────────────────────────────────────────

        [HttpGet("reports")]
        public async Task<IActionResult> GetReports(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 20,
            [FromQuery] string? status = null,
            [FromQuery] string? targetType = null)
        {
            var filter = Builders<UserReport>.Filter.Empty;
            if (!string.IsNullOrWhiteSpace(status))
                filter &= Builders<UserReport>.Filter.Eq(r => r.Status, status);
            if (!string.IsNullOrWhiteSpace(targetType))
                filter &= Builders<UserReport>.Filter.Eq(r => r.TargetType, targetType);

            var total = await _ctx.Reports.CountDocumentsAsync(filter);
            var reports = await _ctx.Reports.Find(filter)
                .SortByDescending(r => r.CreatedAt)
                .Skip((page - 1) * limit)
                .Limit(limit)
                .ToListAsync();

            var pendingCount = await _ctx.Reports.CountDocumentsAsync(
                Builders<UserReport>.Filter.Eq(r => r.Status, "pending"));

            return Ok(new { total, page, limit, pendingCount, reports });
        }

        [HttpPut("reports/{id}/status")]
        public async Task<IActionResult> UpdateReportStatus(string id, [FromBody] ReportStatusDto dto)
        {
            var validStatuses = new[] { "pending", "reviewed", "dismissed", "actioned" };
            if (!validStatuses.Contains(dto.Status))
                return BadRequest(new { message = "Status invalid hai." });

            var report = await _ctx.Reports.Find(r => r.Id == id).FirstOrDefaultAsync();
            if (report == null) return NotFound(new { message = "Report nahi mili." });

            await _ctx.Reports.UpdateOneAsync(r => r.Id == id,
                Builders<UserReport>.Update
                    .Set(r => r.Status, dto.Status)
                    .Set(r => r.AdminNote, dto.AdminNote)
                    .Set(r => r.ReviewedByAdminId, AdminId)
                    .Set(r => r.ReviewedAt, DateTime.UtcNow));

            await LogAsync("review_report", "report", id, dto.AdminNote,
                $"Status: {dto.Status} | Target: {report.TargetType}/{report.TargetId}");

            return Ok(new { message = $"Report '{dto.Status}' ho gayi." });
        }

        [HttpDelete("reports/{id}")]
        public async Task<IActionResult> DeleteReport(string id)
        {
            await _ctx.Reports.DeleteOneAsync(r => r.Id == id);
            await LogAsync("delete_report", "report", id);
            return Ok(new { message = "Report delete ho gayi." });
        }

        // ── FORCE VERIFY EMAIL ────────────────────────────────────────────────

        [HttpPost("users/{id}/verify-email")]
        public async Task<IActionResult> ForceVerifyEmail(string id)
        {
            var user = await _ctx.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found." });

            await _ctx.Users.UpdateOneAsync(u => u.Id == id,
                Builders<User>.Update.Set(u => u.IsEmailVerified, true));
            await LogAsync("force_verify_email", "user", id);

            return Ok(new { message = $"@{user.Username} ka email verify ho gaya." });
        }

        // ══════════════════════════════════════════════════════════════════════
        // CONTENT MODERATION — POSTS
        // ══════════════════════════════════════════════════════════════════════

        /// <summary>Saari posts list — pagination</summary>
        [HttpGet("posts")]
        public async Task<IActionResult> GetPosts([FromQuery] int page = 1, [FromQuery] int limit = 20, [FromQuery] string? search = null)
        {
            var filter = Builders<Post>.Filter.Empty;
            if (!string.IsNullOrWhiteSpace(search))
                filter = Builders<Post>.Filter.Where(p => p.Content.ToLower().Contains(search.ToLower()));

            var total = await _ctx.Posts.CountDocumentsAsync(filter);
            var posts = await _ctx.Posts.Find(filter)
                .SortByDescending(p => p.CreatedAt)
                .Skip((page - 1) * limit)
                .Limit(limit)
                .ToListAsync();

            return Ok(new { total, page, limit, posts });
        }

        /// <summary>Post delete karo</summary>
        [HttpDelete("posts/{id}")]
        public async Task<IActionResult> DeletePost(string id, [FromBody] ReasonDto? dto = null)
        {
            var post = await _ctx.Posts.Find(p => p.Id == id).FirstOrDefaultAsync();
            if (post == null) return NotFound(new { message = "Post not found." });

            await _ctx.Posts.DeleteOneAsync(p => p.Id == id);
            await LogAsync("delete_post", "post", id, dto?.Reason, $"Content: {post.Content[..Math.Min(100, post.Content.Length)]}");

            return Ok(new { message = "Post delete ho gayi." });
        }

        // ══════════════════════════════════════════════════════════════════════
        // CONTENT MODERATION — GAMES
        // ══════════════════════════════════════════════════════════════════════

        /// <summary>Saari games list</summary>
        [HttpGet("games")]
        public async Task<IActionResult> GetGames([FromQuery] int page = 1, [FromQuery] int limit = 20)
        {
            var total = await _ctx.Games.CountDocumentsAsync(FilterDefinition<Game>.Empty);
            var games = await _ctx.Games.Find(FilterDefinition<Game>.Empty)
                .SortByDescending(g => g.CreatedAt)
                .Skip((page - 1) * limit)
                .Limit(limit)
                .ToListAsync();

            return Ok(new { total, page, limit, games });
        }

        /// <summary>Game delete karo</summary>
        [HttpDelete("games/{id}")]
        public async Task<IActionResult> DeleteGame(string id, [FromBody] ReasonDto? dto = null)
        {
            var game = await _ctx.Games.Find(g => g.Id == id).FirstOrDefaultAsync();
            if (game == null) return NotFound(new { message = "Game not found." });

            await _ctx.Games.DeleteOneAsync(g => g.Id == id);
            await _ctx.Feedback.DeleteManyAsync(f => f.GameId == id);
            await LogAsync("delete_game", "game", id, dto?.Reason, $"Title: {game.Title}");

            return Ok(new { message = $"Game '{game.Title}' delete ho gayi." });
        }

        // ── GAME STATUS CHANGE ────────────────────────────────────────────────

        [HttpPut("games/{id}/status")]
        public async Task<IActionResult> SetGameStatus(string id, [FromBody] StatusDto dto)
        {
            var validStatuses = new[] { "Alpha", "Beta", "Released", "Suspended" };
            if (!validStatuses.Contains(dto.Status))
                return BadRequest(new { message = "Status 'Alpha', 'Beta', 'Released', ya 'Suspended' hona chahiye." });

            var game = await _ctx.Games.Find(g => g.Id == id).FirstOrDefaultAsync();
            if (game == null) return NotFound(new { message = "Game not found." });

            await _ctx.Games.UpdateOneAsync(g => g.Id == id,
                Builders<Game>.Update.Set(g => g.Status, dto.Status));
            await LogAsync("update_game_status", "game", id, null, $"{game.Status} → {dto.Status}");

            return Ok(new { message = $"Game status '{dto.Status}' ho gaya." });
        }

        // ══════════════════════════════════════════════════════════════════════
        // FEEDBACK / BUG REPORTS
        // ══════════════════════════════════════════════════════════════════════

        /// <summary>Saara feedback / bug reports list</summary>
        [HttpGet("feedback")]
        public async Task<IActionResult> GetFeedback([FromQuery] int page = 1, [FromQuery] int limit = 20)
        {
            var total = await _ctx.Feedback.CountDocumentsAsync(FilterDefinition<Feedback>.Empty);
            var feedback = await _ctx.Feedback.Find(FilterDefinition<Feedback>.Empty)
                .SortByDescending(f => f.Id)
                .Skip((page - 1) * limit)
                .Limit(limit)
                .ToListAsync();

            return Ok(new { total, page, limit, feedback });
        }

        [HttpDelete("feedback/{id}")]
        public async Task<IActionResult> DeleteFeedback(string id)
        {
            await _ctx.Feedback.DeleteOneAsync(f => f.Id == id);
            await LogAsync("delete_feedback", "feedback", id);
            return Ok(new { message = "Feedback delete ho gaya." });
        }

        // ══════════════════════════════════════════════════════════════════════
        // COMMUNITIES
        // ══════════════════════════════════════════════════════════════════════

        [HttpGet("communities")]
        public async Task<IActionResult> GetCommunities([FromQuery] int page = 1, [FromQuery] int limit = 20)
        {
            var total = await _ctx.Communities.CountDocumentsAsync(FilterDefinition<Community>.Empty);
            var communities = await _ctx.Communities.Find(FilterDefinition<Community>.Empty)
                .SortByDescending(c => c.CreatedAt)
                .Skip((page - 1) * limit)
                .Limit(limit)
                .ToListAsync();

            return Ok(new { total, page, limit, communities });
        }

        [HttpDelete("communities/{id}")]
        public async Task<IActionResult> DeleteCommunity(string id, [FromBody] ReasonDto? dto = null)
        {
            var community = await _ctx.Communities.Find(c => c.Id == id).FirstOrDefaultAsync();
            if (community == null) return NotFound(new { message = "Community not found." });

            await _ctx.Communities.DeleteOneAsync(c => c.Id == id);
            await _ctx.CommunityMessages.DeleteManyAsync(m => m.CommunityId == id);
            await LogAsync("delete_community", "community", id, dto?.Reason, $"Name: {community.Name}");

            return Ok(new { message = $"Community '{community.Name}' delete ho gayi." });
        }

        // ══════════════════════════════════════════════════════════════════════
        // ADMIN LOGS
        // ══════════════════════════════════════════════════════════════════════

        /// <summary>Admin activity log — audit trail</summary>
        [HttpGet("logs")]
        public async Task<IActionResult> GetLogs(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 50,
            [FromQuery] string? action = null,
            [FromQuery] string? adminId = null)
        {
            var filter = Builders<AdminLog>.Filter.Empty;

            if (!string.IsNullOrWhiteSpace(action))
                filter &= Builders<AdminLog>.Filter.Eq(l => l.Action, action);
            if (!string.IsNullOrWhiteSpace(adminId))
                filter &= Builders<AdminLog>.Filter.Eq(l => l.AdminId, adminId);

            var total = await _ctx.AdminLogs.CountDocumentsAsync(filter);
            var logs = await _ctx.AdminLogs.Find(filter)
                .SortByDescending(l => l.CreatedAt)
                .Skip((page - 1) * limit)
                .Limit(limit)
                .ToListAsync();

            return Ok(new { total, page, limit, logs });
        }

        // ══════════════════════════════════════════════════════════════════════
        // SEARCH (cross-entity)
        // ══════════════════════════════════════════════════════════════════════

        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
                return BadRequest(new { message = "Search query minimum 2 characters." });

            var lower = q.ToLower();
            var users = await _ctx.Users.Find(u =>
                u.Username.ToLower().Contains(lower) || u.Email.ToLower().Contains(lower))
                .Limit(10).ToListAsync();
            var games = await _ctx.Games.Find(g =>
                g.Title.ToLower().Contains(lower))
                .Limit(5).ToListAsync();

            return Ok(new
            {
                users = users.Select(SafeUser),
                games = games.Select(g => new { g.Id, g.Title, g.Status, g.DeveloperName })
            });
        }
    }

    // ─── DTOs ─────────────────────────────────────────────────────────────────
    public class SuspendDto
    {
        public string? Reason { get; set; }
        public double? DurationHours { get; set; }   // null = permanent
    }

    public class ReasonDto
    {
        public string? Reason { get; set; }
    }

    public class RoleDto
    {
        public string Role { get; set; } = "user";
    }

    public class NotesDto
    {
        public string? Notes { get; set; }
    }

    public class StatusDto
    {
        public string Status { get; set; } = null!;
    }

    public class ReportStatusDto
    {
        public string Status { get; set; } = "reviewed";
        public string? AdminNote { get; set; }
    }

    public class RecoverDto
    {
        public string? Reason { get; set; }
    }
}