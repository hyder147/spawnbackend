using System.ComponentModel.DataAnnotations;

namespace SpawnPointBackend.Dtos
{
    // ─── AUTH ─────────────────────────────────────────────────────────────────

    public class RegisterDto
    {
        [Required(ErrorMessage = "Username is required.")]
        [MinLength(3, ErrorMessage = "Username consist of 3 characters.")]
        [MaxLength(30, ErrorMessage = "Username length can't be 30.")]
        [RegularExpression(@"^[a-zA-Z0-9_]+$",
            ErrorMessage = "Only numbers,letters and underscores are allowed in username.")]
        public string Username { get; set; } = null!;

        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Enter your valid email.")]
        [MaxLength(100, ErrorMessage = "Email is way too much long.")]
        public string Email { get; set; } = null!;

        [Required(ErrorMessage = "Password is necessary.")]
        [MinLength(8, ErrorMessage = "Password must be 8 characters.")]
        [MaxLength(100, ErrorMessage = "Password can't be 100 characters.")]
        public string Password { get; set; } = null!;

        [Required(ErrorMessage = "UserType is necessary.")]
        [RegularExpression(@"^(Developer|Gamer)$",
            ErrorMessage = "UserType must be 'Developer' or 'Gamer'.")]
        public string UserType { get; set; } = null!;
    }

    public class LoginDto
    {
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Enter your valid email.")]
        public string Email { get; set; } = null!;

        [Required(ErrorMessage = "Password is necessary.")]
        public string Password { get; set; } = null!;
    }

    public class VerifyOtpDto
    {
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Enter your valid email.")]
        public string Email { get; set; } = null!;

        [Required(ErrorMessage = "OTP is required.")]
        [StringLength(6, MinimumLength = 6, ErrorMessage = "OTP must be 6 digits.")]
        public string Otp { get; set; } = null!;
    }

    public class EmailDto
    {
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Enter your valid email.")]
        public string Email { get; set; } = null!;
    }

    public class ResetPasswordDto
    {
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Enter your valid email.")]
        public string Email { get; set; } = null!;

        [Required(ErrorMessage = "OTP is required.")]
        [StringLength(6, MinimumLength = 6, ErrorMessage = "OTP must be 6 digits.")]
        public string Otp { get; set; } = null!;

        [Required(ErrorMessage = "New password is required.")]
        [MinLength(8, ErrorMessage = "Password must be at least 8 characters.")]
        [MaxLength(100, ErrorMessage = "Password can't be 100 characters.")]
        public string NewPassword { get; set; } = null!;
    }

    // ─── PROFILE UPDATE ───────────────────────────────────────────────────────
    // All fields optional — sirf jo fields bhejo woh update honge

    public class UpdateProfileDto
    {
        public string? Username { get; set; }
        public string? Email { get; set; }

        // Skills — dono field names accept
        public List<string>? Skillsets { get; set; }
        public List<string>? Skills { get; set; }

        // Portfolio — multiple forms accept
        public List<string>? PortfolioUrls { get; set; }
        public List<string>? Portfolio { get; set; }
        public string? PortfolioUrl { get; set; }

        // Profile Picture (base64 or URL)
        public string? ProfilePicture { get; set; }

        // Hardware — nested object
        public HardwareSpecsDto? Hardware { get; set; }
        public HardwareSpecsDto? Specs { get; set; }

        // Hardware — flat fields bhi accept
        public string? Gpu { get; set; }
        public string? Cpu { get; set; }
        public string? Ram { get; set; }
        public string? Os { get; set; }
    }

    public class HardwareSpecsDto
    {
        public string? Gpu { get; set; }
        public string? Cpu { get; set; }
        public string? Ram { get; set; }
        public string? Os { get; set; }
    }

    // ─── POST ─────────────────────────────────────────────────────────────────

    public class CreatePostDto
    {
        [Required(ErrorMessage = "UserId is must.")]
        public string UserId { get; set; } = null!;

        [Required(ErrorMessage = "Content is necessary.")]
        [MinLength(1, ErrorMessage = "Post can't be empty.")]
        [MaxLength(2000, ErrorMessage = "Post can't be 2000 characters.")]
        public string Content { get; set; } = null!;

        public string? CommunityId { get; set; }

        [Url(ErrorMessage = "Enter valid URL.")]
        [MaxLength(500)]
        public string? MediaUrl { get; set; }
    }

    public class CreateCommentDto
    {
        [Required(ErrorMessage = "UserId is required.")]
        public string UserId { get; set; } = null!;

        [Required(ErrorMessage = "Comment can't be empty.")]
        [MinLength(1)]
        [MaxLength(500, ErrorMessage = "Comment can't be 500 characters.")]
        public string Content { get; set; } = null!;
    }

    // ─── COMMUNITY ────────────────────────────────────────────────────────────

    public class CreateCommunityDto
    {
        [Required(ErrorMessage = "Community name is must.")]
        [MinLength(3, ErrorMessage = "Name must be 3 characters.")]
        [MaxLength(50, ErrorMessage = "Name can't be 50 characters")]
        public string Name { get; set; } = null!;

        [MaxLength(300, ErrorMessage = "Description can't be 500 characters.")]
        public string Description { get; set; } = "";

        [Required(ErrorMessage = "Type is required.")]
        [RegularExpression(@"^(Game|Developer|General)$",
            ErrorMessage = "Type must be 'Game', 'Developer', or 'General'.")]
        public string Type { get; set; } = null!;

        public string? GameId { get; set; }

        [Required(ErrorMessage = "CreatedBy is necessary.")]
        public string CreatedBy { get; set; } = null!;
    }

    // ─── MESSAGE ──────────────────────────────────────────────────────────────

    public class SendMessageDto
    {
        [Required(ErrorMessage = "SenderId is required.")]
        public string SenderId { get; set; } = null!;

        [Required(ErrorMessage = "ReceiverId is required.")]
        public string ReceiverId { get; set; } = null!;

        [Required(ErrorMessage = "Message can't be empty.")]
        [MinLength(1)]
        [MaxLength(1000, ErrorMessage = "Message can't be 1000 characters.")]
        public string Content { get; set; } = null!;
    }

    public class GroupMessageDto
    {
        [Required(ErrorMessage = "SenderId is required.")]
        public string SenderId { get; set; } = null!;

        [Required(ErrorMessage = "Message can't be empty.")]
        [MinLength(1)]
        [MaxLength(1000, ErrorMessage = "Message can't be 1000 characters.")]
        public string Content { get; set; } = null!;
    }

    // ─── GAME ─────────────────────────────────────────────────────────────────

    public class CreateGameDto
    {
        [Required(ErrorMessage = "Title is required.")]
        [MinLength(2, ErrorMessage = "Title must be 2 characters.")]
        [MaxLength(100, ErrorMessage = "Title can't be 100 characters.")]
        public string Title { get; set; } = null!;

        [Required(ErrorMessage = "Description is necessary.")]
        [MinLength(10, ErrorMessage = "Description must be 10 characters.")]
        [MaxLength(2000, ErrorMessage = "Description can't be 2000 characters.")]
        public string Description { get; set; } = null!;

        [Required(ErrorMessage = "DeveloperId is must.")]
        public string DeveloperId { get; set; } = null!;

        [Required(ErrorMessage = "DeveloperName is required.")]
        public string DeveloperName { get; set; } = null!;

        [Required(ErrorMessage = "Genre is must.")]
        [MaxLength(50)]
        public string Genre { get; set; } = null!;

        [Required(ErrorMessage = "Status is required.")]
        [RegularExpression(@"^(Alpha|Beta|Released)$",
            ErrorMessage = "Status must be 'Alpha', 'Beta', or 'Released'.")]
        public string Status { get; set; } = null!;

        [Url(ErrorMessage = "Enter valid URL download.")]
        public string? DownloadUrl { get; set; }
    }

    // ─── SQUAD ────────────────────────────────────────────────────────────────

    public class CreateSquadDto
    {
        [Required(ErrorMessage = "Squad name is required.")]
        [MinLength(2, ErrorMessage = "Name must be 2 characters.")]
        [MaxLength(50, ErrorMessage = "Name can't be 50 characters.")]
        public string Name { get; set; } = null!;

        [Required(ErrorMessage = "ProjectId is required.")]
        public string ProjectId { get; set; } = null!;
    }

    // ─── STORY ────────────────────────────────────────────────────────────────

    public class CreateStoryDto
    {
        [Required(ErrorMessage = "UserId is required.")]
        public string UserId { get; set; } = null!;

        [Required(ErrorMessage = "MediaUrl is required.")]
        [Url(ErrorMessage = "Enter valid media URL..")]
        [MaxLength(500)]
        public string MediaUrl { get; set; } = null!;

        [MaxLength(150, ErrorMessage = "Caption can't be 150 characters.")]
        public string? Caption { get; set; }
    }

    // ─── FEEDBACK ─────────────────────────────────────────────────────────────

    public class CreateFeedbackDto
    {
        [Required(ErrorMessage = "GameId is required.")]
        public string GameId { get; set; } = null!;

        [Required(ErrorMessage = "GamerId is required.")]
        public string GamerId { get; set; } = null!;

        [Required(ErrorMessage = "Rating is required.")]
        [Range(1, 5, ErrorMessage = "Rating must be in between 1-5.")]
        public int Rating { get; set; }

        [Required(ErrorMessage = "Comment is required.")]
        [MinLength(5, ErrorMessage = "Comment must be 5 characters.")]
        [MaxLength(1000, ErrorMessage = "Comment can't be 1000 characters")]
        public string Comment { get; set; } = null!;
    }

    // ─── RESPONSE ─────────────────────────────────────────────────────────────

    public class UserResponseDto
    {
        public string Id { get; set; } = null!;
        public string Username { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string UserType { get; set; } = null!;
    }

    public class LoginResponseDto
    {
        public string Token { get; set; } = null!;
        public UserResponseDto User { get; set; } = null!;
    }

    // ─── IDENTITY CARDS ───────────────────────────────────────────────────────

    public class CardCheckoutDto
    {
        [Required(ErrorMessage = "Card type is required.")]
        [RegularExpression(@"^(Gaming|Developer)$", ErrorMessage = "CardType must be 'Gaming' or 'Developer'.")]
        public string CardType { get; set; } = null!;
    }

    public class CardKeyValueDto
    {
        public string Key { get; set; } = "";
        public string Value { get; set; } = "";
    }

    public class CardStatDto
    {
        public string Label { get; set; } = "";
        public int Percent { get; set; }
    }

    public class CardDetailsDto
    {
        [Required(ErrorMessage = "Full name is required.")]
        [MaxLength(60, ErrorMessage = "Full name is too long.")]
        public string FullName { get; set; } = null!;

        [Required(ErrorMessage = "Role / title is required.")]
        [MaxLength(80, ErrorMessage = "Role is too long.")]
        public string RoleTitle { get; set; } = null!;

        [MaxLength(80)] public string? Specialization { get; set; }
        [MaxLength(60)] public string? Location { get; set; }
        [MaxLength(10)] public string? Age { get; set; }
        [MaxLength(120)] public string? Motto { get; set; }

        public string? ProfilePicture { get; set; }

        [MaxLength(40, ErrorMessage = "Too many skills — keep it under 40.")]
        public List<string> Skills { get; set; } = new();

        [MaxLength(20)]
        public List<CardStatDto> ProficiencyStats { get; set; } = new();

        [MaxLength(20)]
        public List<CardKeyValueDto> QuickStats { get; set; } = new();

        [MaxLength(20)]
        public List<CardKeyValueDto> Experience { get; set; } = new();

        [MaxLength(20)]
        public List<string> Achievements { get; set; } = new();

        [MaxLength(30)]
        public List<string> Tools { get; set; } = new();

        [MaxLength(20)]
        public List<CardKeyValueDto> PersonalInfo { get; set; } = new();

        [MaxLength(50)] public string? GithubHandle { get; set; }
        [MaxLength(50)] public string? InstagramHandle { get; set; }
        [MaxLength(50)] public string? LinkedInHandle { get; set; }
        [MaxLength(50)] public string? TwitterHandle { get; set; }

        [MaxLength(500, ErrorMessage = "Notes can't be over 500 characters.")]
        public string? AdditionalNotes { get; set; }
    }

    public class AdminCardStatusDto
    {
        [Required(ErrorMessage = "Status is required.")]
        [RegularExpression(@"^(Submitted|InProgress|Rejected)$", ErrorMessage = "Invalid status.")]
        public string Status { get; set; } = null!;
        public string? AdminNote { get; set; }
    }

    public class AdminCardDeliverDto
    {
        [Required(ErrorMessage = "Front card image is required.")]
        public string FrontImageUrl { get; set; } = null!;
        public string? BackImageUrl { get; set; }
        public string? AdminNote { get; set; }
    }

    public class AdminCardPaymentOverrideDto
    {
        [Required]
        public bool Paid { get; set; }
        public string? Note { get; set; }
    }
}