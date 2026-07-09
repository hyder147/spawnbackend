using System.Text.Json;
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
    public class CardsController : ControllerBase
    {
        private readonly MongoDbContext _ctx;
        private readonly ILemonSqueezyService _lemonSqueezy;
        private readonly IConfiguration _config;
        private readonly ILogger<CardsController> _logger;

        public CardsController(MongoDbContext ctx, ILemonSqueezyService lemonSqueezy, IConfiguration config, ILogger<CardsController> logger)
        {
            _ctx = ctx;
            _lemonSqueezy = lemonSqueezy;
            _config = config;
            _logger = logger;
        }

        private decimal PriceUsd => decimal.TryParse(_config["CardPricing:PriceUsd"], out var u) ? u : 20m;

        // ─── PRICING (logged-in users only — previews live in the dashboard) ───

        [HttpGet("pricing")]
        [Authorize]
        public IActionResult GetPricing()
        {
            return Ok(new { priceUsd = PriceUsd, currency = "USD" });
        }

        // ─── MY ORDERS ───────────────────────────────────────────────────────

        [HttpGet("my")]
        [Authorize]
        public async Task<IActionResult> GetMyOrders()
        {
            var userId = User.GetUserId();
            var orders = await _ctx.CardOrders.Find(o => o.UserId == userId)
                .SortByDescending(o => o.CreatedAt)
                .ToListAsync();
            return Ok(orders);
        }

        // ─── CHECKOUT (creates a Lemon Squeezy hosted checkout session) ────────

        [HttpPost("checkout")]
        [Authorize]
        public async Task<IActionResult> Checkout([FromBody] CardCheckoutDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (!_lemonSqueezy.IsConfigured)
                return BadRequest(new { message = "Payments are not configured yet. Please contact support." });

            var userId = User.GetUserId();
            var user = await _ctx.Users.Find(u => u.Id == userId).FirstOrDefaultAsync();
            if (user == null) return Unauthorized(new { message = "User not found." });

            // Reuse an existing order if one is mid-flow for this card type.
            var existing = await _ctx.CardOrders.Find(o =>
                    o.UserId == userId && o.CardType == dto.CardType &&
                    (o.Status == "AwaitingPayment" || o.Status == "PaymentFailed"))
                .FirstOrDefaultAsync();

            var alreadyActive = await _ctx.CardOrders.Find(o =>
                    o.UserId == userId && o.CardType == dto.CardType &&
                    o.Status != "AwaitingPayment" && o.Status != "PaymentFailed" && o.Status != "Rejected")
                .FirstOrDefaultAsync();

            if (alreadyActive != null)
                return BadRequest(new { message = $"You already have a {dto.CardType} card request in progress (status: {alreadyActive.Status}).", orderId = alreadyActive.Id });

            var txnRefNo = "SPCARD" + DateTime.UtcNow.ToString("yyyyMMddHHmmss") + new Random().Next(1000, 9999);

            CardOrder order;
            if (existing != null)
            {
                order = existing;
                order.TxnRefNo = txnRefNo;
                order.Status = "AwaitingPayment";
                order.PriceUsd = PriceUsd;
                order.UpdatedAt = DateTime.UtcNow;
                await _ctx.CardOrders.ReplaceOneAsync(o => o.Id == order.Id, order);
            }
            else
            {
                order = new CardOrder
                {
                    UserId = userId,
                    Username = user.Username,
                    Email = user.Email,
                    CardType = dto.CardType,
                    PriceUsd = PriceUsd,
                    TxnRefNo = txnRefNo,
                    Status = "AwaitingPayment",
                };
                await _ctx.CardOrders.InsertOneAsync(order);
            }

            try
            {
                var (checkoutId, checkoutUrl) = await _lemonSqueezy.CreateCheckoutAsync(
                    dto.CardType, txnRefNo, user.Email, user.Username, order.Id!);

                order.LsCheckoutId = checkoutId;
                order.UpdatedAt = DateTime.UtcNow;
                await _ctx.CardOrders.ReplaceOneAsync(o => o.Id == order.Id, order);

                return Ok(new { orderId = order.Id, checkoutUrl });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create Lemon Squeezy checkout for order {OrderId}", order.Id);
                return StatusCode(502, new { message = "Could not start checkout with our payment provider. Please try again shortly." });
            }
        }

        // ─── LEMON SQUEEZY WEBHOOK (server-to-server order notifications) ──────

        [HttpPost("lemonsqueezy/webhook")]
        [AllowAnonymous]
        public async Task<IActionResult> LemonSqueezyWebhook()
        {
            Request.EnableBuffering();
            using var reader = new StreamReader(Request.Body, leaveOpen: true);
            var rawBody = await reader.ReadToEndAsync();
            Request.Body.Position = 0;

            var signature = Request.Headers["X-Signature"].FirstOrDefault();
            if (!_lemonSqueezy.VerifyWebhookSignature(rawBody, signature))
            {
                _logger.LogWarning("Rejected Lemon Squeezy webhook with invalid signature.");
                return Unauthorized();
            }

            LemonSqueezyWebhookPayload? payload;
            try
            {
                payload = JsonSerializer.Deserialize<LemonSqueezyWebhookPayload>(rawBody,
                    new JsonSerializerOptions(JsonSerializerDefaults.Web));
            }
            catch (JsonException)
            {
                return BadRequest(new { message = "Malformed webhook payload." });
            }

            if (payload == null) return BadRequest();

            var txnRefNo = payload.Meta.CustomData?.TxnRefNo;
            var orderIdFromCustomData = payload.Meta.CustomData?.OrderId;

            var order = !string.IsNullOrWhiteSpace(txnRefNo)
                ? await _ctx.CardOrders.Find(o => o.TxnRefNo == txnRefNo).FirstOrDefaultAsync()
                : null;

            order ??= !string.IsNullOrWhiteSpace(orderIdFromCustomData)
                ? await _ctx.CardOrders.Find(o => o.Id == orderIdFromCustomData).FirstOrDefaultAsync()
                : null;

            if (order == null)
            {
                _logger.LogWarning("Lemon Squeezy webhook for unknown order (txnRefNo={TxnRefNo}).", txnRefNo);
                return Ok(); // Acknowledge so Lemon Squeezy doesn't keep retrying an order we'll never find.
            }

            var attrs = payload.Data.Attributes;
            order.LsOrderId = payload.Data.Id;
            order.LsOrderNumber = attrs.OrderNumber.ToString();
            order.LsOrderStatus = attrs.Status;
            order.LsReceiptUrl = attrs.Urls?.Receipt;
            order.UpdatedAt = DateTime.UtcNow;

            switch (payload.Meta.EventName)
            {
                case "order_created" when attrs.Status == "paid":
                    order.Status = "AwaitingDetails";
                    order.PaidAt = DateTime.UtcNow;
                    break;
                case "order_created":
                    // Created but not yet paid (e.g. pending bank transfer) — leave as AwaitingPayment.
                    break;
                case "order_refunded":
                    order.Status = "PaymentFailed";
                    break;
                default:
                    // Ignore event types we don't act on (subscription events, etc. don't apply to one-off cards).
                    break;
            }

            await _ctx.CardOrders.ReplaceOneAsync(o => o.Id == order.Id, order);
            return Ok();
        }

        // ─── SUBMIT CARD DETAILS (only once payment has cleared) ───────────────

        [HttpPost("{orderId}/details")]
        [Authorize]
        public async Task<IActionResult> SubmitDetails(string orderId, [FromBody] CardDetailsDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = User.GetUserId();
            var order = await _ctx.CardOrders.Find(o => o.Id == orderId).FirstOrDefaultAsync();
            if (order == null) return NotFound(new { message = "Card request not found." });
            if (order.UserId != userId) return Forbid();

            if (order.Status != "AwaitingDetails")
                return BadRequest(new
                {
                    message = order.Status == "AwaitingPayment" || order.Status == "PaymentFailed"
                    ? "Please complete payment before submitting your card details."
                    : "Details have already been submitted for this card."
                });

            order.Details = new CardDetails
            {
                FullName = dto.FullName,
                RoleTitle = dto.RoleTitle,
                Specialization = dto.Specialization,
                Location = dto.Location,
                Age = dto.Age,
                Motto = dto.Motto,
                ProfilePicture = dto.ProfilePicture,
                Skills = dto.Skills ?? new(),
                ProficiencyStats = (dto.ProficiencyStats ?? new()).Select(s => new CardStat { Label = s.Label, Percent = s.Percent }).ToList(),
                QuickStats = (dto.QuickStats ?? new()).Select(k => new CardKeyValue { Key = k.Key, Value = k.Value }).ToList(),
                Experience = (dto.Experience ?? new()).Select(k => new CardKeyValue { Key = k.Key, Value = k.Value }).ToList(),
                Achievements = dto.Achievements ?? new(),
                Tools = dto.Tools ?? new(),
                PersonalInfo = (dto.PersonalInfo ?? new()).Select(k => new CardKeyValue { Key = k.Key, Value = k.Value }).ToList(),
                GithubHandle = dto.GithubHandle,
                InstagramHandle = dto.InstagramHandle,
                LinkedInHandle = dto.LinkedInHandle,
                TwitterHandle = dto.TwitterHandle,
                AdditionalNotes = dto.AdditionalNotes,
            };
            order.Status = "Submitted";
            order.DetailsSubmittedAt = DateTime.UtcNow;
            order.UpdatedAt = DateTime.UtcNow;

            await _ctx.CardOrders.ReplaceOneAsync(o => o.Id == order.Id, order);

            return Ok(new { message = "Your card details have been submitted! Our team will start designing your card.", order });
        }
    }
}