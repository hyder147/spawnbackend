using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SpawnPointBackend.Dtos;
using SpawnPointBackend.Extensions;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;

namespace SpawnPointBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public UsersController(MongoDbContext context)
        {
            _context = context;
        }

        // Helper — user object ko frontend-friendly format mein return karo
        private static object MapUser(User u) => new
        {
            id = u.Id,
            username = u.Username,
            email = u.Email,
            userType = u.UserType,
            skillsets = u.Skillsets,
            portfolioUrls = u.PortfolioUrls,
            profilePicture = u.ProfilePicture,
            hardware = u.Hardware == null ? null : new
            {
                gpu = u.Hardware.GPU,   // uppercase DB → lowercase JSON
                cpu = u.Hardware.CPU,
                ram = u.Hardware.RAM,
                os = u.Hardware.OS
            }
        };

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(string id)
        {
            var user = await _context.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound();
            return Ok(MapUser(user));
        }

        [HttpGet("search/{username}")]
        public async Task<IActionResult> SearchByUsername(string username)
        {
            var user = await _context.Users
                .Find(u => u.Username.ToLower() == username.ToLower())
                .FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "This user doesn't exist." });
            return Ok(new { user.Id, user.Username, user.UserType });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, UpdateProfileDto dto)
        {
            if (!User.IsOwner(id)) return Forbid();

            var user = await _context.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound();

            if (!string.IsNullOrWhiteSpace(dto.Username))
                user.Username = dto.Username;

            if (dto.Skillsets != null) user.Skillsets = dto.Skillsets;
            if (dto.Skills != null) user.Skillsets = dto.Skills;

            if (dto.PortfolioUrls != null) user.PortfolioUrls = dto.PortfolioUrls;
            if (dto.Portfolio != null) user.PortfolioUrls = dto.Portfolio;
            if (!string.IsNullOrWhiteSpace(dto.PortfolioUrl))
                user.PortfolioUrls = new List<string> { dto.PortfolioUrl };

            if (!string.IsNullOrWhiteSpace(dto.ProfilePicture))
                user.ProfilePicture = dto.ProfilePicture;

            var hw = dto.Hardware ?? dto.Specs;
            if (hw != null || dto.Gpu != null || dto.Cpu != null || dto.Ram != null || dto.Os != null)
            {
                user.Hardware ??= new HardwareSpecs();
                var gpu = hw?.Gpu ?? dto.Gpu;
                var cpu = hw?.Cpu ?? dto.Cpu;
                var ram = hw?.Ram ?? dto.Ram;
                var os = hw?.Os ?? dto.Os;
                if (gpu != null) user.Hardware.GPU = gpu;
                if (cpu != null) user.Hardware.CPU = cpu;
                if (ram != null) user.Hardware.RAM = ram;
                if (os != null) user.Hardware.OS = os;
            }

            await _context.Users.ReplaceOneAsync(u => u.Id == id, user);
            return Ok(MapUser(user));
        }

        [HttpGet("{id}/stats")]
        public async Task<IActionResult> GetStats(string id)
        {
            var user = await _context.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound();

            if (user.UserType == "Developer")
            {
                var games = await _context.Games.Find(g => g.DeveloperId == id).ToListAsync();
                var totalTesters = games.SelectMany(g => g.BetaTesters ?? new()).Count();
                var ratings = await _context.Feedback
                    .Find(f => games.Select(g => g.Id).Contains(f.GameId)).ToListAsync();
                var avgRating = ratings.Any() ? ratings.Average(r => r.Rating) : 0;
                return Ok(new { gamesPublished = games.Count, betaTesters = totalTesters, avgRating = Math.Round(avgRating, 1) });
            }
            else
            {
                var feedbacks = await _context.Feedback.Find(f => f.GamerId == id).ToListAsync();
                return Ok(new
                {
                    gamesTested = feedbacks.Select(f => f.GameId).Distinct().Count(),
                    reportsField = feedbacks.Count,
                    reputation = feedbacks.Count >= 10 ? "Pro Tester" : feedbacks.Count >= 5 ? "Active" : "Newcomer"
                });
            }
        }
    }
}
