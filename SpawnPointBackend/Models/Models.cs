using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System.Collections.Generic;

namespace SpawnPointBackend.Models
{
    public class User
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string Username { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string PasswordHash { get; set; } = null!;
        public string UserType { get; set; } = null!;
        public bool IsEmailVerified { get; set; } = false;
        public List<string>? PortfolioUrls { get; set; }
        public List<string>? Skillsets { get; set; }
        public List<string>? OngoingProjects { get; set; }
        public HardwareSpecs? Hardware { get; set; }
        public List<string>? GamingInterests { get; set; }
        public List<string>? TestingHistory { get; set; }
        public string? ProfilePicture { get; set; }

        // ─── Admin Fields ──────────────────────────────────────────────────────
        public string Role { get; set; } = "user";
        public bool IsSuspended { get; set; } = false;
        public string? SuspendReason { get; set; }
        public DateTime? SuspendedAt { get; set; }
        public DateTime? SuspendedUntil { get; set; }
        public bool IsBanned { get; set; } = false;
        public string? BanReason { get; set; }
        public DateTime? BannedAt { get; set; }
        public string? AdminNotes { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // ─── Ghost Mode Fields ─────────────────────────────────────────────────
        public int GhostCount { get; set; } = 0;           // how many times ghosted a game without feedback

        // ─── Crash Bounty Fields ───────────────────────────────────────────────
        public int BountiesClaimed { get; set; } = 0;
        public List<string> Badges { get; set; } = new(); // e.g. "GoldTester", "BugHunter", "EliteHunter"

        // ─── Scout Mode Fields ─────────────────────────────────────────────────
        /// <summary>Career track this tester is scoutable for: QA | Community | Design | Production. Null = auto-derived.</summary>
        public string? RoleTrack { get; set; }
        /// <summary>Short bio shown on the Scout Mode talent card.</summary>
        public string? ScoutBlurb { get; set; }
        /// <summary>Whether this user is currently open to being scouted/offered by studios.</summary>
        public bool OpenToOffers { get; set; } = true;
    }

    // ─── Admin Action Log ──────────────────────────────────────────────────────
    public class AdminLog
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string AdminId { get; set; } = null!;
        public string AdminUsername { get; set; } = null!;
        public string Action { get; set; } = null!;
        public string TargetType { get; set; } = null!;
        public string TargetId { get; set; } = null!;
        public string? Reason { get; set; }
        public string? Details { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    // ─── Platform Stats Snapshot ───────────────────────────────────────────────
    public class PlatformStats
    {
        public long TotalUsers { get; set; }
        public long TotalDevelopers { get; set; }
        public long TotalGamers { get; set; }
        public long TotalGames { get; set; }
        public long TotalPosts { get; set; }
        public long TotalCommunities { get; set; }
        public long TotalSquads { get; set; }
        public long SuspendedUsers { get; set; }
        public long BannedUsers { get; set; }
        public long UnverifiedUsers { get; set; }
    }

    public class OtpEntry
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string Email { get; set; } = null!;
        public string Code { get; set; } = null!;
        public string Purpose { get; set; } = null!;
        public DateTime ExpiresAt { get; set; }
        public bool IsUsed { get; set; } = false;
    }

    public class HardwareSpecs
    {
        public string? GPU { get; set; }
        public string? CPU { get; set; }
        public string? RAM { get; set; }
        public string? OS { get; set; }
    }

    public class Game
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string Title { get; set; } = null!;
        public string Description { get; set; } = null!;
        public string DeveloperId { get; set; } = null!;
        public string DeveloperName { get; set; } = null!;
        public List<string>? Screenshots { get; set; }
        public string? BuildVersion { get; set; }
        public string? DownloadUrl { get; set; }
        public string Genre { get; set; } = null!;
        public string Status { get; set; } = null!;
        public List<BetaTester>? BetaTesters { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class BetaTester
    {
        public string GamerId { get; set; } = null!;
        public string Status { get; set; } = "Pending";
    }

    public class Squad
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string Name { get; set; } = null!;
        public string ProjectId { get; set; } = null!;
        public List<string> Members { get; set; } = new();
        public List<string> VacancyRoles { get; set; } = new();
        public string? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Feedback
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string GameId { get; set; } = null!;
        public string GamerId { get; set; } = null!;
        public int Rating { get; set; }
        public string Comment { get; set; } = null!;
        public List<BugReport>? BugReports { get; set; }
    }

    public class BugReport
    {
        public string Title { get; set; } = null!;
        public string Description { get; set; } = null!;
        public string Severity { get; set; } = null!;
        public string Status { get; set; } = "Open";
    }

    public class FriendRequest
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string SenderId { get; set; } = null!;
        public string ReceiverId { get; set; } = null!;
        public string Status { get; set; } = "Pending";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Block
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string BlockerId { get; set; } = null!;
        public string BlockedId { get; set; } = null!;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Community
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string Name { get; set; } = null!;
        public string Description { get; set; } = "";
        public string Type { get; set; } = null!;
        public string? GameId { get; set; }
        public string CreatedBy { get; set; } = null!;
        public List<string> MemberIds { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Story
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string UserId { get; set; } = null!;
        public string MediaUrl { get; set; } = null!;
        public string? Caption { get; set; }
        public List<string> ViewerIds { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddHours(24);
    }

    public class Post
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string UserId { get; set; } = null!;
        public string AuthorUsername { get; set; } = "";
        public string? CommunityId { get; set; }
        public string Content { get; set; } = null!;
        public string? MediaUrl { get; set; }
        public List<string> LikedByUserIds { get; set; } = new();
        public List<PostComment> Comments { get; set; } = new();
        public List<string> SharedByUserIds { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class PostComment
    {
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; } = ObjectId.GenerateNewId().ToString();
        public string UserId { get; set; } = null!;
        public string Content { get; set; } = null!;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Conversation
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public List<string> ParticipantIds { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public enum MessageType { text, file, signal }

    public class Message
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string ConversationId { get; set; } = null!;
        public string SenderId { get; set; } = null!;
        public string Content { get; set; } = null!;
        public MessageType Type { get; set; } = MessageType.text;
        public string? FileName { get; set; }
        public long? FileSize { get; set; }
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
    }

    public class CommunityMessage
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string CommunityId { get; set; } = null!;
        public string Sender { get; set; } = null!;
        public string Content { get; set; } = null!;
        public DateTime Time { get; set; } = DateTime.UtcNow;
    }

    public class SquadMessage
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string SquadId { get; set; } = null!;
        public string Sender { get; set; } = null!;
        public string Content { get; set; } = null!;
        public DateTime Time { get; set; } = DateTime.UtcNow;
    }

    public class CallSession
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string InitiatorId { get; set; } = null!;
        public string ReceiverId { get; set; } = null!;
        public string Status { get; set; } = "Pending";
        public string? RoomId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? EndedAt { get; set; }
    }

    public class CommunityJoinRequest
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string CommunityId { get; set; } = null!;
        public string UserId { get; set; } = null!;
        public string Username { get; set; } = null!;
        public string Status { get; set; } = "Pending";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class SquadJoinRequest
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string SquadId { get; set; } = null!;
        public string UserId { get; set; } = null!;
        public string Username { get; set; } = null!;
        public string Status { get; set; } = "Pending";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GHOST MODE — Testing Session Tracking
    // ══════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Tracks a live testing session. Tester sends a heartbeat ping every 30s.
    /// If 5 minutes pass without a ping and no feedback was given, session is
    /// marked as ghosted and the tester's GhostCount is incremented.
    /// </summary>
    public class TestingSession
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public string GameId { get; set; } = null!;
        public string TesterId { get; set; } = null!;
        public string TesterUsername { get; set; } = null!;

        public DateTime SessionStart { get; set; } = DateTime.UtcNow;
        public DateTime LastPing { get; set; } = DateTime.UtcNow;

        /// <summary>True while the tester is actively playing.</summary>
        public bool IsActive { get; set; } = true;

        /// <summary>True if tester went silent for 5+ mins without submitting feedback.</summary>
        public bool IsGhosted { get; set; } = false;

        /// <summary>True if tester called EndSession properly.</summary>
        public bool EndedCleanly { get; set; } = false;

        /// <summary>Set when session ends or is ghosted.</summary>
        public DateTime? EndedAt { get; set; }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CRASH BOUNTY — Bug Hunting Reward System
    // ══════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// A bounty posted by a developer describing a known symptom.
    /// First tester to submit valid reproduction steps wins the reward.
    /// </summary>
    public class CrashBounty
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public string GameId { get; set; } = null!;
        public string DeveloperId { get; set; } = null!;

        /// <summary>Public description visible to all testers — only the symptom, no spoilers.</summary>
        public string Symptom { get; set; } = null!;

        /// <summary>Private developer notes — only visible to the developer.</summary>
        public string? PrivateContext { get; set; }

        /// <summary>Reward type: "GoldBadge" | "PriorityAccess" | "Shoutout" | "EliteBadge"</summary>
        public string RewardType { get; set; } = "GoldBadge";

        /// <summary>Open | Claimed | Closed</summary>
        public string Status { get; set; } = "Open";

        public string? ClaimedByUserId { get; set; }
        public string? ClaimedByUsername { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ClaimedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
    }

    /// <summary>
    /// A tester's submission for a bounty — contains reproduction steps.
    /// AI checks if it is a duplicate of an existing submission.
    /// </summary>
    public class BountySubmission
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public string BountyId { get; set; } = null!;
        public string GameId { get; set; } = null!;
        public string TesterId { get; set; } = null!;
        public string TesterUsername { get; set; } = null!;

        /// <summary>Step-by-step reproduction instructions.</summary>
        public string ReproSteps { get; set; } = null!;

        /// <summary>Optional screen recording or screenshot URL.</summary>
        public string? EvidenceUrl { get; set; }

        /// <summary>Set by AI duplicate checker — true if steps match an earlier submission.</summary>
        public bool IsDuplicate { get; set; } = false;

        /// <summary>Pending | Accepted | Duplicate | Rejected</summary>
        public string Status { get; set; } = "Pending";

        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SCOUT MODE — Career/Recruiting Offers
    // ══════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// A direct recruiting offer sent from a developer/studio account to a
    /// scouted tester, based on their verified in-app track record.
    /// </summary>
    public class ScoutOffer
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public string FromDeveloperId { get; set; } = null!;
        public string FromDeveloperUsername { get; set; } = null!;
        public string ToUserId { get; set; } = null!;
        public string ToUsername { get; set; } = null!;

        public string? Note { get; set; }

        /// <summary>Snapshot of the score shown to the developer at the time the offer was sent.</summary>
        public int SignalScoreAtOffer { get; set; }

        /// <summary>Pending | Accepted | Declined</summary>
        public string Status { get; set; } = "Pending";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // IDENTITY CARDS — paid Gaming / Developer ID card requests
    // ══════════════════════════════════════════════════════════════════════════

    /// <summary>Generic label/value pair — used for gaming stats, dev stats, experience, personal info, etc.</summary>
    public class CardKeyValue
    {
        public string Key { get; set; } = "";
        public string Value { get; set; } = "";
    }

    /// <summary>A skill/proficiency progress bar, e.g. "Debugging" -> 93%.</summary>
    public class CardStat
    {
        public string Label { get; set; } = "";
        public int Percent { get; set; }
    }

    /// <summary>All the user-entered content that gets printed onto the card by the admin/designer.</summary>
    public class CardDetails
    {
        public string FullName { get; set; } = null!;
        public string RoleTitle { get; set; } = null!;
        public string? Specialization { get; set; }
        public string? Location { get; set; }
        public string? Age { get; set; }
        public string? Motto { get; set; }

        /// <summary>Base64 data URL, same pattern as User.ProfilePicture.</summary>
        public string? ProfilePicture { get; set; }

        public List<string> Skills { get; set; } = new();
        public List<CardStat> ProficiencyStats { get; set; } = new();
        public List<CardKeyValue> QuickStats { get; set; } = new();
        public List<CardKeyValue> Experience { get; set; } = new();
        public List<string> Achievements { get; set; } = new();
        public List<string> Tools { get; set; } = new();
        public List<CardKeyValue> PersonalInfo { get; set; } = new();

        public string? GithubHandle { get; set; }
        public string? InstagramHandle { get; set; }
        public string? LinkedInHandle { get; set; }
        public string? TwitterHandle { get; set; }

        public string? AdditionalNotes { get; set; }
    }

    /// <summary>
    /// One user's request for a paid Gaming or Developer identity card.
    /// Lifecycle: AwaitingPayment -> (PaymentFailed -> retry) -> AwaitingDetails
    /// -> Submitted -> InProgress -> Completed | Rejected
    /// </summary>
    public class CardOrder
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public string UserId { get; set; } = null!;
        public string Username { get; set; } = null!;
        public string Email { get; set; } = null!;

        /// <summary>"Gaming" | "Developer"</summary>
        public string CardType { get; set; } = null!;

        public string Status { get; set; } = "AwaitingPayment";

        // ─── Payment (Lemon Squeezy) ──────────────────────────────────────
        public decimal PriceUsd { get; set; } = 20m;

        /// <summary>Our own order reference, embedded in checkout_data.custom so we can match the webhook back to this order.</summary>
        public string TxnRefNo { get; set; } = null!;

        /// <summary>The Lemon Squeezy "checkouts" resource id created for this order.</summary>
        public string? LsCheckoutId { get; set; }

        /// <summary>The Lemon Squeezy "orders" resource id, filled in once the webhook confirms payment.</summary>
        public string? LsOrderId { get; set; }

        /// <summary>Human-friendly order number shown in Lemon Squeezy's dashboard/emails.</summary>
        public string? LsOrderNumber { get; set; }

        public string? LsOrderStatus { get; set; }
        public string? LsReceiptUrl { get; set; }
        public DateTime? PaidAt { get; set; }

        // ─── User submitted form ─────────────────────────────────────────
        public CardDetails? Details { get; set; }
        public DateTime? DetailsSubmittedAt { get; set; }

        // ─── Admin handling ──────────────────────────────────────────────
        public string? AdminNote { get; set; }
        public string? FrontImageUrl { get; set; }
        public string? BackImageUrl { get; set; }
        public DateTime? DeliveredAt { get; set; }
        public string? HandledByAdminUsername { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}