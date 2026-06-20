using SpawnPointBackend.Models;

namespace SpawnPointBackend.Repositories
{
    public interface IBlocksRepository
    {
        Task<List<string>> GetBlockedIdsAsync(string userId);
        Task<bool> IsBlockedAsync(string userId1, string userId2);
        Task BlockAsync(string blockerId, string blockedId);
        Task UnblockAsync(string blockerId, string blockedId);
    }
}