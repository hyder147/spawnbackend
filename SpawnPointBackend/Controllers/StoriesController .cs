using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SpawnPointBackend.Extensions;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;

namespace SpawnPointBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class StoriesController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public StoriesController(MongoDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<IActionResult> Create(Story story)
        {
            story.UserId = User.GetUserId();
            story.CreatedAt = DateTime.UtcNow;
            story.ExpiresAt = DateTime.UtcNow.AddHours(24);
            await _context.Stories.InsertOneAsync(story);
            return Ok(story);
        }

        [HttpGet("feed/{userId}")]
        public async Task<IActionResult> GetFeed(string userId)
        {
            var friendRequests = await _context.FriendRequests.Find(r =>
                (r.SenderId == userId || r.ReceiverId == userId) && r.Status == "Accepted")
                .ToListAsync();
            var friendIds = friendRequests
                .Select(r => r.SenderId == userId ? r.ReceiverId : r.SenderId)
                .ToList();

            var now = DateTime.UtcNow;
            var stories = await _context.Stories
                .Find(s => friendIds.Contains(s.UserId) && s.ExpiresAt > now)
                .SortByDescending(s => s.CreatedAt)
                .ToListAsync();
            return Ok(stories);
        }

        [HttpPost("{storyId}/view/{viewerId}")]
        public async Task<IActionResult> MarkView(string storyId, string viewerId)
        {
            var callerId = User.GetUserId();
            if (callerId != viewerId) return Forbid();

            var story = await _context.Stories.Find(s => s.Id == storyId).FirstOrDefaultAsync();
            if (story == null) return NotFound();

            if (!story.ViewerIds.Contains(callerId))
            {
                var update = Builders<Story>.Update.Push(s => s.ViewerIds, callerId);
                await _context.Stories.UpdateOneAsync(s => s.Id == storyId, update);
            }
            return Ok(new { message = "View marked" });
        }

        [HttpDelete("{storyId}")]
        public async Task<IActionResult> Delete(string storyId)
        {
            var story = await _context.Stories.Find(s => s.Id == storyId).FirstOrDefaultAsync();
            if (story == null) return NotFound();
            if (!User.IsOwner(story.UserId)) return Forbid();

            await _context.Stories.DeleteOneAsync(s => s.Id == storyId);
            return Ok(new { message = "Story deleted." });
        }
    }
}
