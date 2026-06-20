using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SpawnPointBackend.Models
{
    public class UserReport
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public string ReporterId { get; set; } = null!;
        public string ReporterUsername { get; set; } = null!;

        public string TargetType { get; set; } = null!;   // "user" | "community" | "post"
        public string TargetId { get; set; } = null!;
        public string? TargetName { get; set; }            // username ya community name

        public string Reason { get; set; } = null!;
        public string Status { get; set; } = "pending";   // "pending" | "reviewed" | "dismissed" | "actioned"

        public string? AdminNote { get; set; }
        public string? ReviewedByAdminId { get; set; }
        public DateTime? ReviewedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}