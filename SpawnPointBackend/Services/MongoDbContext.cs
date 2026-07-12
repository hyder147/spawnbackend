using Microsoft.Extensions.Configuration;
using MongoDB.Driver;
using SpawnPointBackend.Models;

namespace SpawnPointBackend.Services
{
    public class MongoDbContext
    {
        private readonly IMongoDatabase _database;

        public MongoDbContext(IConfiguration configuration)
        {
            var client = new MongoClient(configuration.GetConnectionString("MongoDb"));
            _database = client.GetDatabase("SpawnPointDb");
        }

        // ─── Existing Collections ──────────────────────────────────────────────
        public IMongoCollection<User> Users => _database.GetCollection<User>("Users");
        public IMongoCollection<Game> Games => _database.GetCollection<Game>("Games");
        public IMongoCollection<Squad> Squads => _database.GetCollection<Squad>("Squads");
        public IMongoCollection<Feedback> Feedback => _database.GetCollection<Feedback>("Feedback");
        public IMongoCollection<FriendRequest> FriendRequests => _database.GetCollection<FriendRequest>("FriendRequests");
        public IMongoCollection<Block> Blocks => _database.GetCollection<Block>("Blocks");
        public IMongoCollection<Community> Communities => _database.GetCollection<Community>("Communities");
        public IMongoCollection<Post> Posts => _database.GetCollection<Post>("Posts");
        public IMongoCollection<Story> Stories => _database.GetCollection<Story>("Stories");
        public IMongoCollection<Conversation> Conversations => _database.GetCollection<Conversation>("Conversations");
        public IMongoCollection<Message> Messages => _database.GetCollection<Message>("Messages");
        public IMongoCollection<OtpEntry> OtpEntries => _database.GetCollection<OtpEntry>("OtpEntries");
        public IMongoCollection<CommunityMessage> CommunityMessages => _database.GetCollection<CommunityMessage>("CommunityMessages");
        public IMongoCollection<SquadMessage> SquadMessages => _database.GetCollection<SquadMessage>("SquadMessages");
        public IMongoCollection<CallSession> CallSessions => _database.GetCollection<CallSession>("CallSessions");
        public IMongoCollection<CommunityJoinRequest> CommunityJoinRequests => _database.GetCollection<CommunityJoinRequest>("CommunityJoinRequests");
        public IMongoCollection<SquadJoinRequest> SquadJoinRequests => _database.GetCollection<SquadJoinRequest>("SquadJoinRequests");
        public IMongoCollection<AdminLog> AdminLogs => _database.GetCollection<AdminLog>("AdminLogs");
        public IMongoCollection<UserReport> Reports => _database.GetCollection<UserReport>("Reports");
        public IMongoCollection<DeletedUser> DeletedUsers => _database.GetCollection<DeletedUser>("DeletedUsers");

        // ─── Ghost Mode Collections ────────────────────────────────────────────
        public IMongoCollection<TestingSession> TestingSessions => _database.GetCollection<TestingSession>("TestingSessions");

        // ─── Crash Bounty Collections ──────────────────────────────────────────
        public IMongoCollection<CrashBounty> CrashBounties => _database.GetCollection<CrashBounty>("CrashBounties");
        public IMongoCollection<BountySubmission> BountySubmissions => _database.GetCollection<BountySubmission>("BountySubmissions");

        // ─── Scout Mode Collections ─────────────────────────────────────────────
        public IMongoCollection<ScoutOffer> ScoutOffers => _database.GetCollection<ScoutOffer>("ScoutOffers");

        // ─── Identity Cards (paid Gaming/Developer cards) ───────────────────────
        public IMongoCollection<CardOrder> CardOrders => _database.GetCollection<CardOrder>("CardOrders");
    }
}