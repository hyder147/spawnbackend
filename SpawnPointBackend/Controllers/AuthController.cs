using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using SpawnPointBackend.Dtos;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace SpawnPointBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly MongoDbContext _context;
        private readonly IConfiguration _config;
        private readonly IEmailService _emailService;

        // Dummy hash for timing-safe login (prevents email enumeration)
        private static readonly string _dummyHash = BCrypt.Net.BCrypt.HashPassword("dummy_timing_safe_password");

        public AuthController(MongoDbContext context, IConfiguration config, IEmailService emailService)
        {
            _context = context;
            _config = config;
            _emailService = emailService;
        }

        // ─── REGISTER ─────────────────────────────────────────────────────────
        [HttpPost("register")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> Register(RegisterDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var existingEmail = await _context.Users
                .Find(u => u.Email == dto.Email.ToLower())
                .FirstOrDefaultAsync();
            if (existingEmail != null)
                return BadRequest(new { message = "This email is already registered." });

            var existingUsername = await _context.Users
                .Find(u => u.Username.ToLower() == dto.Username.ToLower())
                .FirstOrDefaultAsync();
            if (existingUsername != null)
                return BadRequest(new { message = "This username is already taken." });

            // Save user as unverified
            var user = new User
            {
                Username = dto.Username.Trim(),
                Email = dto.Email.ToLower().Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                UserType = dto.UserType,
                IsEmailVerified = false
            };

            await _context.Users.InsertOneAsync(user);

            // Generate and send OTP
            var otp = GenerateOtp();
            await SaveOtpAsync(user.Email, otp, "EmailVerification");
            await _emailService.SendOtpAsync(user.Email, otp, "EmailVerification");

            return Ok(new { message = "Registration successful! Please check your email for the OTP to verify your account." });
        }

        // ─── VERIFY EMAIL ─────────────────────────────────────────────────────
        [HttpPost("verify-email")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> VerifyEmail(VerifyOtpDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var otpEntry = await _context.OtpEntries
                .Find(o => o.Email == dto.Email.ToLower() &&
                           o.Code == dto.Otp &&
                           o.Purpose == "EmailVerification" &&
                           !o.IsUsed &&
                           o.ExpiresAt > DateTime.UtcNow)
                .FirstOrDefaultAsync();

            if (otpEntry == null)
                return BadRequest(new { message = "Invalid or expired OTP." });

            // Mark OTP as used
            var otpUpdate = Builders<OtpEntry>.Update.Set(o => o.IsUsed, true);
            await _context.OtpEntries.UpdateOneAsync(o => o.Id == otpEntry.Id, otpUpdate);

            // Mark user as verified
            var userUpdate = Builders<User>.Update.Set(u => u.IsEmailVerified, true);
            await _context.Users.UpdateOneAsync(u => u.Email == dto.Email.ToLower(), userUpdate);

            return Ok(new { message = "Email verified successfully! You can now login." });
        }

        // ─── RESEND VERIFICATION OTP ──────────────────────────────────────────
        [HttpPost("resend-verification")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ResendVerification(EmailDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var user = await _context.Users
                .Find(u => u.Email == dto.Email.ToLower())
                .FirstOrDefaultAsync();

            if (user == null)
                return BadRequest(new { message = "No account found with this email." });

            if (user.IsEmailVerified)
                return BadRequest(new { message = "Email is already verified." });

            var otp = GenerateOtp();
            await SaveOtpAsync(user.Email, otp, "EmailVerification");
            await _emailService.SendOtpAsync(user.Email, otp, "EmailVerification");

            return Ok(new { message = "A new OTP has been sent to your email." });
        }

        // ─── LOGIN ────────────────────────────────────────────────────────────
        [HttpPost("login")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var user = await _context.Users
                .Find(u => u.Email == dto.Email.ToLower())
                .FirstOrDefaultAsync();

            // Timing-safe: hamesha hash compare karo chahe user mile ya nahi
            var hashToVerify = user?.PasswordHash ?? _dummyHash;
            var passwordValid = BCrypt.Net.BCrypt.Verify(dto.Password, hashToVerify);

            if (user == null || !passwordValid)
                return Unauthorized(new { message = "Email or password is wrong." });

            // Block login if email not verified
            if (!user.IsEmailVerified)
                return Unauthorized(new { message = "Please verify your email before logging in." });

            // ─── Admin: Check suspension & ban ────────────────────────────────
            if (user.IsBanned)
                return Unauthorized(new { message = $"Your account has been permanently banned. Reason: {user.BanReason ?? "Terms of Service violation"}" });

            if (user.IsSuspended)
            {
                if (user.SuspendedUntil.HasValue && user.SuspendedUntil.Value <= DateTime.UtcNow)
                {
                    // Suspension expired — auto-lift
                    var lift = Builders<User>.Update
                        .Set(u => u.IsSuspended, false)
                        .Unset(u => u.SuspendedUntil);
                    await _context.Users.UpdateOneAsync(u => u.Id == user.Id, lift);
                }
                else
                {
                    var until = user.SuspendedUntil.HasValue
                        ? $" until {user.SuspendedUntil.Value:yyyy-MM-dd HH:mm} UTC"
                        : " permanently";
                    return Unauthorized(new { message = $"Your account is suspended{until}. Reason: {user.SuspendReason ?? "Policy violation"}" });
                }
            }

            var token = GenerateJwtToken(user);

            return Ok(new LoginResponseDto
            {
                Token = token,
                User = new UserResponseDto
                {
                    Id = user.Id!,
                    Username = user.Username,
                    Email = user.Email,
                    UserType = user.UserType,
                    Role = user.Role ?? "user"
                }
            });
        }

        // ─── FORGOT PASSWORD ──────────────────────────────────────────────────
        [HttpPost("forgot-password")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ForgotPassword(EmailDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var user = await _context.Users
                .Find(u => u.Email == dto.Email.ToLower())
                .FirstOrDefaultAsync();

            // Always return OK to prevent email enumeration
            if (user == null)
                return Ok(new { message = "If this email is registered, an OTP has been sent." });

            var otp = GenerateOtp();
            await SaveOtpAsync(user.Email, otp, "ForgotPassword");
            await _emailService.SendOtpAsync(user.Email, otp, "ForgotPassword");

            return Ok(new { message = "If this email is registered, an OTP has been sent." });
        }

        // ─── RESET PASSWORD ───────────────────────────────────────────────────
        [HttpPost("reset-password")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ResetPassword(ResetPasswordDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var otpEntry = await _context.OtpEntries
                .Find(o => o.Email == dto.Email.ToLower() &&
                           o.Code == dto.Otp &&
                           o.Purpose == "ForgotPassword" &&
                           !o.IsUsed &&
                           o.ExpiresAt > DateTime.UtcNow)
                .FirstOrDefaultAsync();

            if (otpEntry == null)
                return BadRequest(new { message = "Invalid or expired OTP." });

            // Mark OTP as used
            var otpUpdate = Builders<OtpEntry>.Update.Set(o => o.IsUsed, true);
            await _context.OtpEntries.UpdateOneAsync(o => o.Id == otpEntry.Id, otpUpdate);

            // Update password
            var newHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            var userUpdate = Builders<User>.Update.Set(u => u.PasswordHash, newHash);
            await _context.Users.UpdateOneAsync(u => u.Email == dto.Email.ToLower(), userUpdate);

            return Ok(new { message = "Password reset successfully! You can now login with your new password." });
        }

        // ─── HELPERS ──────────────────────────────────────────────────────────
        private static string GenerateOtp()
        {
            return new Random().Next(100000, 999999).ToString();
        }

        private async Task SaveOtpAsync(string email, string otp, string purpose)
        {
            // Invalidate any old OTPs for this email + purpose
            var invalidate = Builders<OtpEntry>.Update.Set(o => o.IsUsed, true);
            await _context.OtpEntries.UpdateManyAsync(
                o => o.Email == email && o.Purpose == purpose && !o.IsUsed,
                invalidate);

            // Save new OTP
            var otpEntry = new OtpEntry
            {
                Email = email,
                Code = otp,
                Purpose = purpose,
                ExpiresAt = DateTime.UtcNow.AddMinutes(10),
                IsUsed = false
            };
            await _context.OtpEntries.InsertOneAsync(otpEntry);
        }

        private string GenerateJwtToken(User user)
        {
            var jwtKey = _config["Jwt:Key"]!;
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id!),
                new Claim(JwtRegisteredClaimNames.Sub, user.Id!),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim("username", user.Username),
                new Claim("userType", user.UserType),
                new Claim(ClaimTypes.Role, user.Role ?? "user"),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(int.Parse(_config["Jwt:ExpiryHours"] ?? "24")),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }

    public class UserResponseDto
    {
        public string Id { get; set; } = null!;
        public string Username { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string UserType { get; set; } = null!;
        public string Role { get; set; } = "user";
    }

    public class LoginResponseDto
    {
        public string Token { get; set; } = null!;
        public UserResponseDto User { get; set; } = null!;
    }
}