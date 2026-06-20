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
    public class FriendsController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public FriendsController(MongoDbContext context)
        {
            _context = context;
        }

        [HttpPost("send/{senderId}/{receiverId}")]
        public async Task<IActionResult> SendRequest(string senderId, string receiverId)
        {
            var isBlocked = await _context.Blocks.Find(b =>
                (b.BlockerId == senderId && b.BlockedId == receiverId) ||
                (b.BlockerId == receiverId && b.BlockedId == senderId)).AnyAsync();
            if (isBlocked) return BadRequest(new { message = "You can't send a request." });

            var existing = await _context.FriendRequests.Find(r =>
                r.SenderId == senderId && r.ReceiverId == receiverId && r.Status == "Pending").FirstOrDefaultAsync();
            if (existing != null) return BadRequest(new { message = "Request is already sent." });

            var request = new FriendRequest { SenderId = senderId, ReceiverId = receiverId };
            await _context.FriendRequests.InsertOneAsync(request);
            return Ok(request);
        }

        [HttpGet("requests/received/{userId}")]
        public async Task<IActionResult> GetReceivedRequests(string userId)
        {
            var requests = await _context.FriendRequests
                .Find(r => r.ReceiverId == userId && r.Status == "Pending")
                .ToListAsync();
            return Ok(requests);
        }

        [HttpGet("requests/sent/{userId}")]
        public async Task<IActionResult> GetSentRequests(string userId)
        {
            var requests = await _context.FriendRequests
                .Find(r => r.SenderId == userId && r.Status == "Pending")
                .ToListAsync();
            return Ok(requests);
        }

        [HttpPut("accept/{requestId}")]
        public async Task<IActionResult> AcceptRequest(string requestId)
        {
            var request = await _context.FriendRequests.Find(r => r.Id == requestId).FirstOrDefaultAsync();
            if (request == null) return NotFound();

            var update = Builders<FriendRequest>.Update.Set(r => r.Status, "Accepted");
            await _context.FriendRequests.UpdateOneAsync(r => r.Id == requestId, update);
            return Ok(new { message = "Request accepted!" });
        }

        [HttpPut("reject/{requestId}")]
        public async Task<IActionResult> RejectRequest(string requestId)
        {
            var request = await _context.FriendRequests.Find(r => r.Id == requestId).FirstOrDefaultAsync();
            if (request == null) return NotFound();

            var update = Builders<FriendRequest>.Update.Set(r => r.Status, "Rejected");
            await _context.FriendRequests.UpdateOneAsync(r => r.Id == requestId, update);
            return Ok(new { message = "Request rejected!." });
        }

        [HttpGet("list/{userId}")]
        public async Task<IActionResult> GetFriends(string userId)
        {
            var accepted = await _context.FriendRequests.Find(r =>
                (r.SenderId == userId || r.ReceiverId == userId) && r.Status == "Accepted")
                .ToListAsync();

            var friendIds = accepted
                .Select(r => r.SenderId == userId ? r.ReceiverId : r.SenderId)
                .Where(id => id != null)
                .ToList();
            var friends = await _context.Users
                .Find(u => u.Id != null && friendIds.Contains(u.Id))
                .ToListAsync();

            // Password hash kabhi front-end ko mat bhejo
            var result = friends.Select(f => new { f.Id, f.Username, f.UserType });
            return Ok(result);
        }

        [HttpDelete("remove/{userId}/{friendId}")]
        public async Task<IActionResult> RemoveFriend(string userId, string friendId)
        {
            await _context.FriendRequests.DeleteOneAsync(r =>
                ((r.SenderId == userId && r.ReceiverId == friendId) ||
                 (r.SenderId == friendId && r.ReceiverId == userId)) && r.Status == "Accepted");
            return Ok(new { message = "Friend is removed!." });
        }
    }
}