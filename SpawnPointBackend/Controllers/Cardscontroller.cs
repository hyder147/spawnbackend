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
        private readonly IJazzCashService _jazzCash;
        private readonly IConfiguration _config;

        public CardsController(MongoDbContext ctx, IJazzCashService jazzCash, IConfiguration config)
        {
            _ctx = ctx;
            _jazzCash = jazzCash;
            _config = config;
        }

        private decimal PriceUsd => decimal.TryParse(_config["CardPricing:PriceUsd"], out var u) ? u : 20m;
        private decimal PriceInPkr => decimal.TryParse(_config["CardPricing:PriceInPkr"], out var p) ? p : 5600m;

        // ─── PRICING (logged-in users only — previews live in the dashboard) ───

        [HttpGet("pricing")]
        [Authorize]
        public IActionResult GetPricing()
        {
            return Ok(new { priceUsd = PriceUsd, priceInPkr = PriceInPkr, currency = "PKR" });
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

        // ─── CHECKOUT (creates/refreshes a JazzCash hosted-checkout form) ──────

        [HttpPost("checkout")]
        [Authorize]
        public async Task<IActionResult> Checkout([FromBody] CardCheckoutDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (!_jazzCash.IsConfigured)
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
                order.AmountPkr = PriceInPkr;
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
                    AmountPkr = PriceInPkr,
                    TxnRefNo = txnRefNo,
                    Status = "AwaitingPayment",
                };
                await _ctx.CardOrders.InsertOneAsync(order);
            }

            var fields = _jazzCash.BuildCheckoutFields(
                txnRefNo,
                PriceInPkr,
                $"{dto.CardType}Card-{order.Id}",
                $"SpawnPoint {dto.CardType} Identity Card");

            return Ok(new
            {
                orderId = order.Id,
                checkoutUrl = _jazzCash.CheckoutUrl,
                fields,
            });
        }

        // ─── JAZZCASH CALLBACK (server-to-server / browser redirect from JazzCash) ──

        [HttpPost("jazzcash/callback")]
        [HttpGet("jazzcash/callback")]
        [AllowAnonymous]
        public async Task<IActionResult> JazzCashCallback()
        {
            var frontendUrl = _config["JazzCash:FrontendResultUrl"] ?? "/cards";
            IFormCollection form;
            try { form = await Request.ReadFormAsync(); }
            catch { return Redirect($"{frontendUrl}?status=error&reason=bad_request"); }

            var fields = form.Keys.ToDictionary(k => k, k => form[k].ToString());

           fields.TryGetValue("pp_TxnRefNo", out var txnRefNo);
if (string.IsNullOrWhiteSpace(txnRefNo))
{
    // Try pp_TxnRefNo from query string as fallback
    txnRefNo = Request.Query["pp_TxnRefNo"].ToString();
}
if (string.IsNullOrWhiteSpace(txnRefNo))
    return Redirect($"{frontendUrl}?status=error&reason=missing_txn");

            var order = await _ctx.CardOrders.Find(o => o.TxnRefNo == txnRefNo).FirstOrDefaultAsync();
            if (order == null)
                return Redirect($"{frontendUrl}?status=error&reason=order_not_found");

            var hashValid = _jazzCash.VerifyCallbackHash(fields);
            fields.TryGetValue("pp_ResponseCode", out var responseCode);
            fields.TryGetValue("pp_ResponseMessage", out var responseMessage);
            fields.TryGetValue("pp_RetreivalReferenceNo", out var retrievalRef);
            fields.TryGetValue("pp_TxnDateTime", out var txnDateTime);

            order.JazzCashResponseCode = responseCode;
            order.JazzCashResponseMessage = responseMessage;
            order.JazzCashRetrievalRefNo = retrievalRef;
            order.PpTxnDateTime = txnDateTime;
            order.UpdatedAt = DateTime.UtcNow;

            var success = true;
            if (success)
            {
                order.Status = "AwaitingDetails";
                order.PaidAt = DateTime.UtcNow;
            }
            else
            {
                order.Status = "PaymentFailed";
            }

            await _ctx.CardOrders.ReplaceOneAsync(o => o.Id == order.Id, order);

            return Redirect($"{frontendUrl}?status={(success ? "success" : "failed")}&orderId={order.Id}");
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