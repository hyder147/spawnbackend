using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SpawnPointBackend.Models
{
    public class DeletedUser
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        // Original user data (backup)
        public string OriginalUserId { get; set; } = null!;
        public string Username { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string PasswordHash { get; set; } = null!;
        public string UserType { get; set; } = null!;
        public string Role { get; set; } = null!;
        public bool IsEmailVerified { get; set; }
        public string? AdminNotes { get; set; }

        // Deletion info
        public string DeletedByAdminId { get; set; } = null!;
        public string DeletedByAdminUsername { get; set; } = null!;
        public string? DeleteReason { get; set; }
        public DateTime DeletedAt { get; set; } = DateTime.UtcNow;
        public DateTime RecoveryDeadline { get; set; }

        // Recovery info
        public bool IsRecovered { get; set; } = false;
        public DateTime? RecoveredAt { get; set; }
        public string? RecoveredByAdminId { get; set; }
    }
}