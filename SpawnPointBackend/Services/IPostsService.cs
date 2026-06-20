using SpawnPointBackend.Models;

namespace SpawnPointBackend.Services
{
	public interface IPostsService
	{
		Task<Post> CreatePostAsync(Post post);
		Task<List<Post>> GetFeedAsync(string userId);
		Task<List<Post>> GetCommunityPostsAsync(string communityId);
		Task<(bool success, string message)> LikePostAsync(string postId, string userId);
		Task UnlikePostAsync(string postId, string userId);
		Task<(bool success, PostComment? comment)> AddCommentAsync(string postId, PostComment comment);
		Task<(bool success, List<PostComment>? comments)> GetCommentsAsync(string postId);
		Task DeleteCommentAsync(string postId, string commentId);
		Task<(bool success, string message)> SharePostAsync(string postId, string userId);
		Task DeletePostAsync(string postId);
	}
}