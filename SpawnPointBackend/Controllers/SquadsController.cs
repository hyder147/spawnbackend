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
    public class SquadsController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public SquadsController(MongoDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var squads = await _context.Squads.Find(_ => true).ToListAsync();
            return Ok(squads);
        }

        // ⚠️ "my" must be ABOVE {id} so ASP.NET doesn't swallow it as a wildcard
        [HttpGet("my")]
        public async Task<IActionResult> GetMySquads()
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var squads = await _context.Squads
                .Find(s => s.Members.Contains(userId))
                .ToListAsync();
            return Ok(squads);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var squad = await _context.Squads.Find(s => s.Id == id).FirstOrDefaultAsync();
            if (squad == null) return NotFound();
            return Ok(squad);
        }

        [HttpPost]
        public async Task<IActionResult> Create(Squad squad)
        {
            squad.CreatedAt = DateTime.UtcNow;
            await _context.Squads.InsertOneAsync(squad);
            return Ok(squad);
        }

        [HttpPost("{id}/apply")]
        public async Task<IActionResult> Apply(string id, [FromBody] SquadApplicationDto dto)
        {
            var squad = await _context.Squads.Find(s => s.Id == id).FirstOrDefaultAsync();
            if (squad == null) return NotFound(new { message = "Squad not found." });
            if (!squad.VacancyRoles.Contains(dto.Role))
                return BadRequest(new { message = "This role is not available." });
            return Ok(new { message = $"Application for {dto.Role} in {squad.Name} submitted!" });
        }

        [HttpPost("{id}/members")]
        public async Task<IActionResult> AddMember(string id, [FromBody] string userId)
        {
            var squad = await _context.Squads.Find(s => s.Id == id).FirstOrDefaultAsync();
            if (squad == null) return NotFound();
            if (!squad.Members.Contains(userId))
            {
                squad.Members.Add(userId);
                await _context.Squads.ReplaceOneAsync(s => s.Id == id, squad);
            }
            return Ok(squad);
        }

        // ── JOIN REQUEST FLOW ────────────────────────────────────────

        /// <summary>User submits a request to join the squad.</summary>
        [HttpPost("{squadId}/join-request")]
        public async Task<IActionResult> RequestJoin(string squadId, [FromBody] SquadJoinRequestDto dto)
        {
            var squad = await _context.Squads.Find(s => s.Id == squadId).FirstOrDefaultAsync();
            if (squad == null) return NotFound(new { message = "Squad not found." });

            if (squad.Members.Contains(dto.UserId))
                return BadRequest(new { message = "Already a member." });

            var existing = await _context.SquadJoinRequests
                .Find(r => r.SquadId == squadId && r.UserId == dto.UserId && r.Status == "Pending")
                .AnyAsync();
            if (existing) return BadRequest(new { message = "Request already pending." });

            var req = new SquadJoinRequest
            {
                SquadId = squadId,
                UserId = dto.UserId,
                Username = dto.Username,
                Status = "Pending",
                CreatedAt = DateTime.UtcNow
            };
            await _context.SquadJoinRequests.InsertOneAsync(req);
            return Ok(new { message = "Join request submitted." });
        }

        /// <summary>Admin fetches all pending join requests for their squad.</summary>
        [HttpGet("{squadId}/join-requests")]
        public async Task<IActionResult> GetJoinRequests(string squadId)
        {
            var requests = await _context.SquadJoinRequests
                .Find(r => r.SquadId == squadId && r.Status == "Pending")
                .SortBy(r => r.CreatedAt)
                .ToListAsync();
            return Ok(requests);
        }

        /// <summary>Admin approves a join request — adds user to Members.</summary>
        [HttpPost("{squadId}/join-requests/{requestId}/approve")]
        public async Task<IActionResult> ApproveRequest(string squadId, string requestId)
        {
            var req = await _context.SquadJoinRequests.Find(r => r.Id == requestId).FirstOrDefaultAsync();
            if (req == null) return NotFound(new { message = "Request not found." });

            var addMember = Builders<Squad>.Update.AddToSet(s => s.Members, req.UserId);
            await _context.Squads.UpdateOneAsync(s => s.Id == squadId, addMember);

            var updateReq = Builders<SquadJoinRequest>.Update.Set(r => r.Status, "Approved");
            await _context.SquadJoinRequests.UpdateOneAsync(r => r.Id == requestId, updateReq);

            return Ok(new { message = $"{req.Username} approved and added to the squad." });
        }

        /// <summary>Admin rejects a join request.</summary>
        [HttpPost("{squadId}/join-requests/{requestId}/reject")]
        public async Task<IActionResult> RejectRequest(string squadId, string requestId)
        {
            var req = await _context.SquadJoinRequests.Find(r => r.Id == requestId).FirstOrDefaultAsync();
            if (req == null) return NotFound(new { message = "Request not found." });

            var update = Builders<SquadJoinRequest>.Update.Set(r => r.Status, "Rejected");
            await _context.SquadJoinRequests.UpdateOneAsync(r => r.Id == requestId, update);

            return Ok(new { message = $"{req.Username}'s request rejected." });
        }

        // ── GROUP CHAT ───────────────────────────────────────────────

        [HttpGet("{squadId}/messages")]
        public async Task<IActionResult> GetMessages(string squadId)
        {
            var messages = await _context.SquadMessages
                .Find(m => m.SquadId == squadId)
                .SortBy(m => m.Time)
                .ToListAsync();
            return Ok(messages);
        }

        [HttpPost("{squadId}/messages")]
        public async Task<IActionResult> SendMessage(string squadId, [FromBody] SendSquadMessageDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Content))
                return BadRequest(new { message = "Message cannot be empty." });

            var squad = await _context.Squads.Find(s => s.Id == squadId).FirstOrDefaultAsync();
            if (squad == null) return NotFound(new { message = "Squad not found." });

            if (!squad.Members.Contains(dto.SenderId))
                return Forbid();

            var msg = new SquadMessage
            {
                SquadId = squadId,
                Sender = dto.SenderId,
                Content = dto.Content,
                Time = DateTime.UtcNow
            };
            await _context.SquadMessages.InsertOneAsync(msg);
            return Ok(msg);
        }
    }

    public class SquadApplicationDto
    {
        public string UserId { get; set; } = null!;
        public string Role { get; set; } = null!;
        public string Reason { get; set; } = null!;
    }

    public class SquadJoinRequestDto
    {
        public string UserId { get; set; } = null!;
        public string Username { get; set; } = null!;
    }

    public class SendSquadMessageDto
    {
        public string SenderId { get; set; } = null!;
        public string Content { get; set; } = null!;
    }
}