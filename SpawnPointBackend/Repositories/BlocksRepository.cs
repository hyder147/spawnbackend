using MongoDB.Driver;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;

namespace SpawnPointBackend.Repositories
{
    public class BlocksRepository : IBlocksRepository
    {
        private readonly MongoDbContext _context;

        public BlocksRepository(MongoDbContext context)
        {
            _context = context;
        }

        public async Task<List<string>> GetBlockedIdsAsync(string userId)
        {
            var blocks = await _context.Blocks
                .Find(b => b.BlockerId == userId || b.BlockedId == userId)
                .ToListAsync();

            return blocks
                .Select(b => b.BlockerId == userId ? b.BlockedId : b.BlockerId)
                .ToList();
        }

        public async Task<bool> IsBlockedAsync(string userId1, string userId2)
        {
            return await _context.Blocks.Find(b =>
                (b.BlockerId == userId1 && b.BlockedId == userId2) ||
                (b.BlockerId == userId2 && b.BlockedId == userId1))
                .AnyAsync();
        }

        public async Task BlockAsync(string blockerId, string blockedId)
        {
            var block = new Block
            {
                BlockerId = blockerId,
                BlockedId = blockedId,
                CreatedAt = DateTime.UtcNow
            };
            await _context.Blocks.InsertOneAsync(block);
        }

        public async Task UnblockAsync(string blockerId, string blockedId)
        {
            await _context.Blocks.DeleteOneAsync(b =>
                b.BlockerId == blockerId && b.BlockedId == blockedId);
        }
    }
}