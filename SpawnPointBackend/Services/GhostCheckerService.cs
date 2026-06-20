using MongoDB.Driver;
using SpawnPointBackend.Models;

namespace SpawnPointBackend.Services
{
    /// <summary>
    /// Background service that runs every 2 minutes.
    /// Finds sessions where the last ping is older than 5 minutes and
    /// the session is still marked as active — these are ghost sessions.
    /// Marks them as ghosted and increments the tester's GhostCount.
    /// </summary>
    public class GhostCheckerService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<GhostCheckerService> _logger;

        // How long without a ping before a session is considered ghosted
        private static readonly TimeSpan GhostThreshold = TimeSpan.FromMinutes(5);

        // How often to run the check
        private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(2);

        public GhostCheckerService(IServiceScopeFactory scopeFactory, ILogger<GhostCheckerService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("GhostCheckerService started.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RunCheckAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "GhostCheckerService encountered an error.");
                }

                await Task.Delay(CheckInterval, stoppingToken);
            }
        }

        private async Task RunCheckAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<MongoDbContext>();

            var cutoff = DateTime.UtcNow - GhostThreshold;

            // Find all active sessions with no ping in the last 5 minutes
            var staleSessions = await context.TestingSessions
                .Find(s => s.IsActive && !s.IsGhosted && s.LastPing < cutoff)
                .ToListAsync();

            if (!staleSessions.Any())
                return;

            _logger.LogInformation("GhostChecker: found {Count} stale sessions to ghost.", staleSessions.Count);

            foreach (var session in staleSessions)
            {
                // Mark session as ghosted
                var sessionUpdate = Builders<TestingSession>.Update
                    .Set(s => s.IsActive, false)
                    .Set(s => s.IsGhosted, true)
                    .Set(s => s.EndedAt, DateTime.UtcNow);

                await context.TestingSessions.UpdateOneAsync(s => s.Id == session.Id, sessionUpdate);

                // Increment tester's ghost count
                var userUpdate = Builders<User>.Update.Inc(u => u.GhostCount, 1);
                await context.Users.UpdateOneAsync(u => u.Id == session.TesterId, userUpdate);

                _logger.LogInformation(
                    "Session {SessionId} for tester {TesterUsername} on game {GameId} marked as ghosted.",
                    session.Id, session.TesterUsername, session.GameId);
            }
        }
    }
}