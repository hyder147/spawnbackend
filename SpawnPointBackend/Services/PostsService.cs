using SpawnPointBackend.Models;
using SpawnPointBackend.Repositories;

namespace SpawnPointBackend.Services
{
    public class PostsService : IPostsService
    {
        private readonly IPostsRepository _postsRepo;
        private readonly IBlocksRepository _blocksRepo;

        public PostsService(IPostsRepository postsRepo, IBlocksRepository blocksRepo)
        {
            _postsRepo = postsRepo;
            _blocksRepo = blocksRepo;
        }

        public async Task<Post> CreatePostAsync(Post post)
        {
            post.CreatedAt = DateTime.UtcNow;
            return await _postsRepo.CreateAsync(post);
        }

        public async Task<List<Post>> GetFeedAsync(string userId)
        {
            // Business logic: blocked users ki posts filter karo
            var blockedIds = await _blocksRepo.GetBlockedIdsAsync(userId);
            return await _postsRepo.GetFeedAsync(blockedIds);
        }

        public async Task<List<Post>> GetCommunityPostsAsync(string communityId)
        {
            return await _postsRepo.GetCommunityPostsAsync(communityId);
        }

        public async Task<(bool success, string message)> LikePostAsync(string postId, string userId)
        {
            var post = await _postsRepo.GetByIdAsync(postId);
            if (post == null) return (false, "Post nahi mili.");

            if (post.LikedByUserIds.Contains(userId))
                return (false, "Pehle se like kiya hua hai.");

            await _postsRepo.LikeAsync(postId, userId);
            return (true, "Post like ho gayi!");
        }

        public async Task UnlikePostAsync(string postId, string userId)
        {
            await _postsRepo.UnlikeAsync(postId, userId);
        }

        public async Task<(bool success, PostComment? comment)> AddCommentAsync(string postId, PostComment comment)
        {
            var post = await _postsRepo.GetByIdAsync(postId);
            if (post == null) return (false, null);

            comment.Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString();
            comment.CreatedAt = DateTime.UtcNow;

            await _postsRepo.AddCommentAsync(postId, comment);
            return (true, comment);
        }

        public async Task<(bool success, List<PostComment>? comments)> GetCommentsAsync(string postId)
        {
            var post = await _postsRepo.GetByIdAsync(postId);
            if (post == null) return (false, null);
            return (true, post.Comments);
        }

        public async Task DeleteCommentAsync(string postId, string commentId)
        {
            await _postsRepo.DeleteCommentAsync(postId, commentId);
        }

        public async Task<(bool success, string message)> SharePostAsync(string postId, string userId)
        {
            var post = await _postsRepo.GetByIdAsync(postId);
            if (post == null) return (false, "Post nahi mili.");

            if (!post.SharedByUserIds.Contains(userId))
                await _postsRepo.ShareAsync(postId, userId);

            return (true, "Post share ho gayi!");
        }

        public async Task DeletePostAsync(string postId)
        {
            await _postsRepo.DeleteAsync(postId);
        }
    }
}