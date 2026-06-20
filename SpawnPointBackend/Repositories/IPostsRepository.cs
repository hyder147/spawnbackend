using SpawnPointBackend.Models;

namespace SpawnPointBackend.Repositories
{
    public interface IPostsRepository
    {
        Task<Post> CreateAsync(Post post);
        Task<List<Post>> GetFeedAsync(List<string> blockedUserIds);
        Task<List<Post>> GetCommunityPostsAsync(string communityId);
        Task<Post?> GetByIdAsync(string postId);
        Task LikeAsync(string postId, string userId);
        Task UnlikeAsync(string postId, string userId);
        Task AddCommentAsync(string postId, PostComment comment);
        Task DeleteCommentAsync(string postId, string commentId);
        Task ShareAsync(string postId, string userId);
        Task DeleteAsync(string postId);
    }
}