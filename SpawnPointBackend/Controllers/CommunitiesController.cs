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
    public class CommunitiesController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public CommunitiesController(MongoDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var communities = await _context.Communities.Find(_ => true).ToListAsync();
            return Ok(communities);
        }

        [HttpPost]
        public async Task<IActionResult> Create(Community community)
        {
            community.CreatedAt = DateTime.UtcNow;
            await _context.Communities.InsertOneAsync(community);
            return Ok(community);
        }

        [HttpPost("game/{gameId}")]
        public async Task<IActionResult> CreateGameCommunity(string gameId)
        {
            var game = await _context.Games.Find(g => g.Id == gameId).FirstOrDefaultAsync();
            if (game == null) return NotFound(new { message = "Game not found." });

            var existing = await _context.Communities.Find(c => c.GameId == gameId).AnyAsync();
            if (existing) return BadRequest(new { message = "This game already has a community." });

            var community = new Community
            {
                Name = game.Title + " Community",
                Description = game.Title + " community of players",
                Type = "Game",
                GameId = gameId,
                CreatedBy = game.DeveloperId
            };
            await _context.Communities.InsertOneAsync(community);
            return Ok(community);
        }

        [HttpGet("developers")]
        public async Task<IActionResult> GetDeveloperCommunity()
        {
            var community = await _context.Communities.Find(c => c.Type == "Developer").FirstOrDefaultAsync();
            if (community == null) return NotFound(new { message = "Developer community not created yet." });
            return Ok(community);
        }

        [HttpGet("game/{gameId}")]
        public async Task<IActionResult> GetGameCommunity(string gameId)
        {
            var community = await _context.Communities.Find(c => c.GameId == gameId).FirstOrDefaultAsync();
            if (community == null) return NotFound(new { message = "This game doesn't have a community." });
            return Ok(community);
        }

        [HttpDelete("{communityId}/leave/{userId}")]
        public async Task<IActionResult> Leave(string communityId, string userId)
        {
            var update = Builders<Community>.Update.Pull(c => c.MemberIds, userId);
            await _context.Communities.UpdateOneAsync(c => c.Id == communityId, update);
            return Ok(new { message = "Left community." });
        }

        [HttpGet("{communityId}/members")]
        public async Task<IActionResult> GetMembers(string communityId)
        {
            var community = await _context.Communities.Find(c => c.Id == communityId).FirstOrDefaultAsync();
            if (community == null) return NotFound();
            var memberIds = community.MemberIds.Where(id => id != null).ToList();
            var members = await _context.Users.Find(u => u.Id != null && memberIds.Contains(u.Id)).ToListAsync();
            return Ok(members.Select(m => new { m.Id, m.Username, m.UserType }));
        }

        // ── JOIN REQUEST FLOW ────────────────────────────────────────

        /// <summary>User submits a request to join. Creates a pending CommunityJoinRequest.</summary>
        [HttpPost("{communityId}/join-request")]
        public async Task<IActionResult> RequestJoin(string communityId, [FromBody] JoinRequestDto dto)
        {
            var community = await _context.Communities.Find(c => c.Id == communityId).FirstOrDefaultAsync();
            if (community == null) return NotFound(new { message = "Community not found." });

            if (community.MemberIds.Contains(dto.UserId))
                return BadRequest(new { message = "Already a member." });

            var existing = await _context.CommunityJoinRequests
                .Find(r => r.CommunityId == communityId && r.UserId == dto.UserId && r.Status == "Pending")
                .AnyAsync();
            if (existing) return BadRequest(new { message = "Request already pending." });

            var req = new CommunityJoinRequest
            {
                CommunityId = communityId,
                UserId = dto.UserId,
                Username = dto.Username,
                Status = "Pending",
                CreatedAt = DateTime.UtcNow
            };
            await _context.CommunityJoinRequests.InsertOneAsync(req);
            return Ok(new { message = "Join request submitted." });
        }

        /// <summary>Admin fetches all pending join requests for their community.</summary>
        [HttpGet("{communityId}/join-requests")]
        public async Task<IActionResult> GetJoinRequests(string communityId)
        {
            var requests = await _context.CommunityJoinRequests
                .Find(r => r.CommunityId == communityId && r.Status == "Pending")
                .SortBy(r => r.CreatedAt)
                .ToListAsync();
            return Ok(requests);
        }

        /// <summary>Admin approves a join request — adds user to MemberIds.</summary>
        [HttpPost("{communityId}/join-requests/{requestId}/approve")]
        public async Task<IActionResult> ApproveRequest(string communityId, string requestId)
        {
            var req = await _context.CommunityJoinRequests.Find(r => r.Id == requestId).FirstOrDefaultAsync();
            if (req == null) return NotFound(new { message = "Request not found." });

            // Add user to community members
            var addMember = Builders<Community>.Update.AddToSet(c => c.MemberIds, req.UserId);
            await _context.Communities.UpdateOneAsync(c => c.Id == communityId, addMember);

            // Mark request as approved
            var updateReq = Builders<CommunityJoinRequest>.Update.Set(r => r.Status, "Approved");
            await _context.CommunityJoinRequests.UpdateOneAsync(r => r.Id == requestId, updateReq);

            return Ok(new { message = $"{req.Username} approved and added to the community." });
        }

        /// <summary>Admin rejects a join request.</summary>
        [HttpPost("{communityId}/join-requests/{requestId}/reject")]
        public async Task<IActionResult> RejectRequest(string communityId, string requestId)
        {
            var req = await _context.CommunityJoinRequests.Find(r => r.Id == requestId).FirstOrDefaultAsync();
            if (req == null) return NotFound(new { message = "Request not found." });

            var update = Builders<CommunityJoinRequest>.Update.Set(r => r.Status, "Rejected");
            await _context.CommunityJoinRequests.UpdateOneAsync(r => r.Id == requestId, update);

            return Ok(new { message = $"{req.Username}'s request rejected." });
        }

        // ── GROUP CHAT ───────────────────────────────────────────────

        [HttpGet("{communityId}/messages")]
        public async Task<IActionResult> GetMessages(string communityId)
        {
            var messages = await _context.CommunityMessages
                .Find(m => m.CommunityId == communityId)
                .SortBy(m => m.Time)
                .ToListAsync();
            return Ok(messages);
        }

        [HttpPost("{communityId}/messages")]
        public async Task<IActionResult> SendMessage(string communityId, [FromBody] SendGroupMessageDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Content))
                return BadRequest(new { message = "Message cannot be empty." });

            var community = await _context.Communities.Find(c => c.Id == communityId).FirstOrDefaultAsync();
            if (community == null) return NotFound(new { message = "Community not found." });

            if (!community.MemberIds.Contains(dto.SenderId))
                return Forbid();

            var msg = new CommunityMessage
            {
                CommunityId = communityId,
                Sender = dto.SenderId,
                Content = dto.Content,
                Time = DateTime.UtcNow
            };
            await _context.CommunityMessages.InsertOneAsync(msg);
            return Ok(msg);
        }
    }

    public class JoinRequestDto
    {
        public string UserId { get; set; } = null!;
        public string Username { get; set; } = null!;
    }

    public class SendGroupMessageDto
    {
        public string SenderId { get; set; } = null!;
        public string Content { get; set; } = null!;
    }
}
