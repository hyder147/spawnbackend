using MongoDB.Driver;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;

namespace SpawnPointBackend.Repositories
{
	public class PostsRepository : IPostsRepository
	{
		private readonly MongoDbContext _context;

		public PostsRepository(MongoDbContext context)
		{
			_context = context;
		}

		public async Task<Post> CreateAsync(Post post)
		{
			await _context.Posts.InsertOneAsync(post);
			return post;
		}

		public async Task<List<Post>> GetFeedAsync(List<string> blockedUserIds)
		{
			return await _context.Posts
				.Find(p => !blockedUserIds.Contains(p.UserId))
				.SortByDescending(p => p.CreatedAt)
				.ToListAsync();
		}

		public async Task<List<Post>> GetCommunityPostsAsync(string communityId)
		{
			return await _context.Posts
				.Find(p => p.CommunityId == communityId)
				.SortByDescending(p => p.CreatedAt)
				.ToListAsync();
		}

		public async Task<Post?> GetByIdAsync(string postId)
		{
			return await _context.Posts
				.Find(p => p.Id == postId)
				.FirstOrDefaultAsync();
		}

		public async Task LikeAsync(string postId, string userId)
		{
			var update = Builders<Post>.Update.Push(p => p.LikedByUserIds, userId);
			await _context.Posts.UpdateOneAsync(p => p.Id == postId, update);
		}

		public async Task UnlikeAsync(string postId, string userId)
		{
			var update = Builders<Post>.Update.Pull(p => p.LikedByUserIds, userId);
			await _context.Posts.UpdateOneAsync(p => p.Id == postId, update);
		}

		public async Task AddCommentAsync(string postId, PostComment comment)
		{
			var update = Builders<Post>.Update.Push(p => p.Comments, comment);
			await _context.Posts.UpdateOneAsync(p => p.Id == postId, update);
		}

		public async Task DeleteCommentAsync(string postId, string commentId)
		{
			var update = Builders<Post>.Update.PullFilter(
				p => p.Comments,
				c => c.Id == commentId);
			await _context.Posts.UpdateOneAsync(p => p.Id == postId, update);
		}

		public async Task ShareAsync(string postId, string userId)
		{
			var update = Builders<Post>.Update.Push(p => p.SharedByUserIds, userId);
			await _context.Posts.UpdateOneAsync(p => p.Id == postId, update);
		}

		public async Task DeleteAsync(string postId)
		{
			await _context.Posts.DeleteOneAsync(p => p.Id == postId);
		}
	}
}