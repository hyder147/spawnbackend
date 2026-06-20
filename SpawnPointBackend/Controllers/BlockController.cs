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
    public class BlockController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public BlockController(MongoDbContext context)
        {
            _context = context;
        }

        [HttpPost("{blockerId}/block/{blockedId}")]
        public async Task<IActionResult> BlockUser(string blockerId, string blockedId)
        {
            var existing = await _context.Blocks.Find(b =>
                b.BlockerId == blockerId && b.BlockedId == blockedId).AnyAsync();
            if (existing) return BadRequest(new { message = "Already Blocked!." });

            await _context.FriendRequests.DeleteOneAsync(r =>
                (r.SenderId == blockerId && r.ReceiverId == blockedId) ||
                (r.SenderId == blockedId && r.ReceiverId == blockerId));

            var block = new Block { BlockerId = blockerId, BlockedId = blockedId };
            await _context.Blocks.InsertOneAsync(block);
            return Ok(new { message = "User has been blocked." });
        }

        [HttpDelete("{blockerId}/unblock/{blockedId}")]
        public async Task<IActionResult> UnblockUser(string blockerId, string blockedId)
        {
            await _context.Blocks.DeleteOneAsync(b =>
                b.BlockerId == blockerId && b.BlockedId == blockedId);
            return Ok(new { message = "User has been unblocked." });
        }

        [HttpGet("{userId}/blocked")]
        public async Task<IActionResult> GetBlockedUsers(string userId)
        {
            var blocks = await _context.Blocks.Find(b => b.BlockerId == userId).ToListAsync();
            var blockedIds = blocks.Select(b => b.BlockedId).Where(id => id != null).ToList();
            var blockedUsers = await _context.Users
                .Find(u => u.Id != null && blockedIds.Contains(u.Id))  // null check add kiya
                .ToListAsync();

            var result = blockedUsers.Select(u => new { u.Id, u.Username, u.UserType });
            return Ok(result);
        }
    }
}
