// ══════════════════════════════════════════════════════════════════════════════
// FILE: Controllers/ReportsController.cs  (NAYA FILE BANAO)
// Ye user-side controller hai — users is se report karte hain
// Admin side ke endpoints AdminController mein hain (file 3)
// ══════════════════════════════════════════════════════════════════════════════

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;
using System.Security.Claims;

namespace SpawnPointBackend.Controllers
{
    [ApiController]
    [Route("api/reports")]
    [Authorize]   // Login hona zaroori hai report karne ke liye
    public class ReportsController : ControllerBase
    {
        private readonly MongoDbContext _ctx;

        public ReportsController(MongoDbContext ctx)
        {
            _ctx = ctx;
        }

        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
        private string Username => User.FindFirstValue("username") ?? "";

        // ─── SUBMIT REPORT ────────────────────────────────────────────────────
        /// <summary>
        /// User kisi aur user, community, ya post ko report kare
        /// POST /api/reports
        /// Body: { targetType: "user"|"community"|"post", targetId: "...", reason: "..." }
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> SubmitReport([FromBody] SubmitReportDto dto)
        {
            // Validation
            if (string.IsNullOrWhiteSpace(dto.TargetId))
                return BadRequest(new { message = "Target ID required hai." });
            if (string.IsNullOrWhiteSpace(dto.Reason) || dto.Reason.Trim().Length < 10)
                return BadRequest(new { message = "Reason kam se kam 10 characters ka hona chahiye." });

            var validTypes = new[] { "user", "community", "post" };
            if (!validTypes.Contains(dto.TargetType?.ToLower()))
                return BadRequest(new { message = "TargetType: 'user', 'community', ya 'post' honi chahiye." });

            dto.TargetType = dto.TargetType!.ToLower();

            // Apne aap ko report nahi kar sakte
            if (dto.TargetType == "user" && dto.TargetId == UserId)
                return BadRequest(new { message = "Aap apne aap ko report nahi kar sakte." });

            // Duplicate check — same user ne same target pehle se report ki?
            var alreadyReported = await _ctx.Reports.Find(r =>
                r.ReporterId == UserId &&
                r.TargetId == dto.TargetId &&
                r.TargetType == dto.TargetType &&
                r.Status == "pending"
            ).AnyAsync();

            if (alreadyReported)
                return Conflict(new { message = "Aap ne is cheez ko pehle hi report kar rakha hai. Admin review kar raha hai." });

            // Target ka naam fetch karo (optional — display ke liye)
            string? targetName = null;
            if (dto.TargetType == "user")
            {
                var target = await _ctx.Users.Find(u => u.Id == dto.TargetId).FirstOrDefaultAsync();
                if (target == null) return NotFound(new { message = "Reported user exist nahi karta." });
                targetName = target.Username;
            }
            else if (dto.TargetType == "community")
            {
                var community = await _ctx.Communities.Find(c => c.Id == dto.TargetId).FirstOrDefaultAsync();
                if (community == null) return NotFound(new { message = "Reported community exist nahi karti." });
                targetName = community.Name;
            }
            else if (dto.TargetType == "post")
            {
                var post = await _ctx.Posts.Find(p => p.Id == dto.TargetId).FirstOrDefaultAsync();
                if (post == null) return NotFound(new { message = "Reported post exist nahi karti." });
                targetName = post.Content.Length > 50 ? post.Content[..50] + "..." : post.Content;
            }

            // Report save karo
            var report = new UserReport
            {
                ReporterId = UserId,
                ReporterUsername = Username,
                TargetType = dto.TargetType,
                TargetId = dto.TargetId,
                TargetName = targetName,
                Reason = dto.Reason.Trim(),
                Status = "pending",
                CreatedAt = DateTime.UtcNow,
            };

            await _ctx.Reports.InsertOneAsync(report);

            return Ok(new
            {
                message = "Report submit ho gayi. Admin review karega.",
                reportId = report.Id,
            });
        }

        // ─── MY REPORTS ───────────────────────────────────────────────────────
        /// <summary>User apni submitted reports dekh sake</summary>
        [HttpGet("my")]
        public async Task<IActionResult> GetMyReports()
        {
            var reports = await _ctx.Reports
                .Find(r => r.ReporterId == UserId)
                .SortByDescending(r => r.CreatedAt)
                .Limit(20)
                .ToListAsync();

            return Ok(reports.Select(r => new
            {
                r.Id,
                r.TargetType,
                r.TargetName,
                r.Reason,
                r.Status,
                r.AdminNote,
                r.CreatedAt,
            }));
        }
    }

    // ─── DTO ──────────────────────────────────────────────────────────────────
    public class SubmitReportDto
    {
        public string TargetType { get; set; } = null!;   // "user" | "community" | "post"
        public string TargetId { get; set; } = null!;
        public string Reason { get; set; } = null!;
    }
}