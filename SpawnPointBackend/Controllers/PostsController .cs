using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SpawnPointBackend.Dtos;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;

namespace SpawnPointBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PostsController : ControllerBase
    {
        private readonly IPostsService _postsService;
        private readonly MongoDbContext _context;

        public PostsController(IPostsService postsService, MongoDbContext context)
        {
            _postsService = postsService;
            _context = context;
        }

        private async Task<string> GetUsernameAsync(string userId)
        {
            var user = await _context.Users.Find(u => u.Id == userId).FirstOrDefaultAsync();
            return user?.Username ?? userId;
        }

        // GET /api/posts/feed/{userId}
        [HttpGet("feed/{userId}")]
        public async Task<IActionResult> GetFeed(string userId)
        {
            var posts = await _postsService.GetFeedAsync(userId);

            // Collect all unique userIds that need username resolution
            var userIds = posts
                .Where(p => string.IsNullOrWhiteSpace(p.AuthorUsername))
                .Select(p => p.UserId)
                .Distinct()
                .ToList();

            // Batch fetch all needed users in one query
            var users = await _context.Users
                .Find(u => userIds.Contains(u.Id))
                .ToListAsync();

            var usernameMap = users.ToDictionary(u => u.Id!, u => u.Username);

            foreach (var post in posts)
            {
                if (string.IsNullOrWhiteSpace(post.AuthorUsername))
                    post.AuthorUsername = usernameMap.TryGetValue(post.UserId, out var name) ? name : post.UserId;
            }

            return Ok(posts);
        }

        // GET /api/posts/community/{communityId}
        [HttpGet("community/{communityId}")]
        public async Task<IActionResult> GetCommunityPosts(string communityId)
        {
            var posts = await _postsService.GetCommunityPostsAsync(communityId);

            var userIds = posts
                .Where(p => string.IsNullOrWhiteSpace(p.AuthorUsername))
                .Select(p => p.UserId)
                .Distinct()
                .ToList();

            var users = await _context.Users
                .Find(u => userIds.Contains(u.Id))
                .ToListAsync();

            var usernameMap = users.ToDictionary(u => u.Id!, u => u.Username);

            foreach (var post in posts)
            {
                if (string.IsNullOrWhiteSpace(post.AuthorUsername))
                    post.AuthorUsername = usernameMap.TryGetValue(post.UserId, out var name) ? name : post.UserId;
            }

            return Ok(posts);
        }

        // POST /api/posts
        [HttpPost]
        public async Task<IActionResult> CreatePost([FromBody] CreatePostDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var username = await GetUsernameAsync(dto.UserId);

            var post = new Post
            {
                UserId = dto.UserId,
                AuthorUsername = username,   // ← always set username at creation
                CommunityId = dto.CommunityId,
                Content = dto.Content,
                MediaUrl = dto.MediaUrl
            };

            var created = await _postsService.CreatePostAsync(post);
            return Ok(created);
        }

        // POST /api/posts/{postId}/like/{userId}
        [HttpPost("{postId}/like/{userId}")]
        public async Task<IActionResult> Like(string postId, string userId)
        {
            var (success, message) = await _postsService.LikePostAsync(postId, userId);
            if (!success) return BadRequest(new { message });
            return Ok(new { message });
        }

        // DELETE /api/posts/{postId}/unlike/{userId}
        [HttpDelete("{postId}/unlike/{userId}")]
        public async Task<IActionResult> Unlike(string postId, string userId)
        {
            await _postsService.UnlikePostAsync(postId, userId);
            return Ok(new { message = "Unliked." });
        }

        // POST /api/posts/{postId}/comment
        [HttpPost("{postId}/comment")]
        public async Task<IActionResult> AddComment(string postId, [FromBody] CreateCommentDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            // Store username in UserId field so frontend displays it correctly
            var username = await GetUsernameAsync(dto.UserId);

            var comment = new PostComment
            {
                UserId = username,
                Content = dto.Content
            };

            var (success, created) = await _postsService.AddCommentAsync(postId, comment);
            if (!success) return NotFound(new { message = "Post not found." });
            return Ok(created);
        }

        // GET /api/posts/{postId}/comments
        [HttpGet("{postId}/comments")]
        public async Task<IActionResult> GetComments(string postId)
        {
            var (success, comments) = await _postsService.GetCommentsAsync(postId);
            if (!success) return NotFound(new { message = "Post not found." });
            return Ok(comments);
        }

        // DELETE /api/posts/{postId}
        [HttpDelete("{postId}")]
        public async Task<IActionResult> DeletePost(string postId)
        {
            await _postsService.DeletePostAsync(postId);
            return NoContent();
        }

        // POST /api/posts/{postId}/share/{userId}
        [HttpPost("{postId}/share/{userId}")]
        public async Task<IActionResult> Share(string postId, string userId)
        {
            var (success, message) = await _postsService.SharePostAsync(postId, userId);
            if (!success) return NotFound(new { message });
            return Ok(new { message });
        }
    }
}