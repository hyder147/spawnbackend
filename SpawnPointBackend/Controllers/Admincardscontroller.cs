using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SpawnPointBackend.Dtos;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;
using System.Security.Claims;

namespace SpawnPointBackend.Controllers
{
    [ApiController]
    [Route("api/admin/cards")]
    [Authorize(Policy = "AdminOnly")]
    public class AdminCardsController : ControllerBase
    {
        private readonly MongoDbContext _ctx;

        public AdminCardsController(MongoDbContext ctx)
        {
            _ctx = ctx;
        }

        private string AdminId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        private string AdminUsername => User.FindFirstValue("username") ?? "admin";

        private async Task LogAsync(string action, string targetId, string? reason = null, string? details = null)
        {
            var log = new AdminLog
            {
                AdminId = AdminId,
                AdminUsername = AdminUsername,
                Action = action,
                TargetType = "card_order",
                TargetId = targetId,
                Reason = reason,
                Details = details,
            };
            await _ctx.AdminLogs.InsertOneAsync(log);
        }

        // ─── LIST ────────────────────────────────────────────────────────────

        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 20,
            [FromQuery] string? status = null,
            [FromQuery] string? cardType = null)
        {
            var filter = Builders<CardOrder>.Filter.Empty;
            if (!string.IsNullOrWhiteSpace(status))
                filter &= Builders<CardOrder>.Filter.Eq(o => o.Status, status);
            if (!string.IsNullOrWhiteSpace(cardType))
                filter &= Builders<CardOrder>.Filter.Eq(o => o.CardType, cardType);

            var total = await _ctx.CardOrders.CountDocumentsAsync(filter);
            var orders = await _ctx.CardOrders.Find(filter)
                .SortByDescending(o => o.CreatedAt)
                .Skip((page - 1) * limit)
                .Limit(limit)
                .ToListAsync();

            var pendingCount = await _ctx.CardOrders.CountDocumentsAsync(
                Builders<CardOrder>.Filter.Eq(o => o.Status, "Submitted"));

            return Ok(new { total, page, limit, pendingCount, orders });
        }

        // ─── DETAIL ──────────────────────────────────────────────────────────

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var order = await _ctx.CardOrders.Find(o => o.Id == id).FirstOrDefaultAsync();
            if (order == null) return NotFound(new { message = "Card request not found." });
            return Ok(order);
        }

        // ─── UPDATE STATUS (move into progress, or reject) ──────────────────

        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] AdminCardStatusDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var order = await _ctx.CardOrders.Find(o => o.Id == id).FirstOrDefaultAsync();
            if (order == null) return NotFound(new { message = "Card request not found." });

            if (order.Status is "AwaitingPayment" or "PaymentFailed" or "AwaitingDetails")
                return BadRequest(new { message = "This card hasn't had its details submitted yet." });
            if (order.Status == "Completed")
                return BadRequest(new { message = "This card has already been delivered." });

            await _ctx.CardOrders.UpdateOneAsync(o => o.Id == id,
                Builders<CardOrder>.Update
                    .Set(o => o.Status, dto.Status)
                    .Set(o => o.AdminNote, dto.AdminNote)
                    .Set(o => o.HandledByAdminUsername, AdminUsername)
                    .Set(o => o.UpdatedAt, DateTime.UtcNow));

            await LogAsync("card_status_update", id, dto.AdminNote, $"Status -> {dto.Status} | {order.CardType} card for @{order.Username}");

            return Ok(new { message = $"Card request marked as '{dto.Status}'." });
        }

        // ─── DELIVER (upload final front/back images, mark completed) ──────────

        [HttpPost("{id}/deliver")]
        public async Task<IActionResult> Deliver(string id, [FromBody] AdminCardDeliverDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var order = await _ctx.CardOrders.Find(o => o.Id == id).FirstOrDefaultAsync();
            if (order == null) return NotFound(new { message = "Card request not found." });

            if (order.Status is "AwaitingPayment" or "PaymentFailed" or "AwaitingDetails")
                return BadRequest(new { message = "This card hasn't had its details submitted yet." });

            await _ctx.CardOrders.UpdateOneAsync(o => o.Id == id,
                Builders<CardOrder>.Update
                    .Set(o => o.FrontImageUrl, dto.FrontImageUrl)
                    .Set(o => o.BackImageUrl, dto.BackImageUrl)
                    .Set(o => o.AdminNote, dto.AdminNote)
                    .Set(o => o.Status, "Completed")
                    .Set(o => o.HandledByAdminUsername, AdminUsername)
                    .Set(o => o.DeliveredAt, DateTime.UtcNow)
                    .Set(o => o.UpdatedAt, DateTime.UtcNow));

            await LogAsync("card_delivered", id, dto.AdminNote, $"{order.CardType} card delivered to @{order.Username}");

            return Ok(new { message = "Card delivered to the user." });
        }

        // ─── MANUAL PAYMENT OVERRIDE (fallback if the JazzCash callback is missed) ──

        [HttpPut("{id}/payment-override")]
        public async Task<IActionResult> PaymentOverride(string id, [FromBody] AdminCardPaymentOverrideDto dto)
        {
            var order = await _ctx.CardOrders.Find(o => o.Id == id).FirstOrDefaultAsync();
            if (order == null) return NotFound(new { message = "Card request not found." });

            if (order.Status != "AwaitingPayment" && order.Status != "PaymentFailed")
                return BadRequest(new { message = "Payment status can only be overridden before details are submitted." });

            var newStatus = dto.Paid ? "AwaitingDetails" : "PaymentFailed";
            var update = Builders<CardOrder>.Update
                .Set(o => o.Status, newStatus)
                .Set(o => o.AdminNote, dto.Note)
                .Set(o => o.UpdatedAt, DateTime.UtcNow);
            if (dto.Paid) update = update.Set(o => o.PaidAt, DateTime.UtcNow);

            await _ctx.CardOrders.UpdateOneAsync(o => o.Id == id, update);
            await LogAsync("card_payment_override", id, dto.Note, $"Manually marked {(dto.Paid ? "PAID" : "UNPAID")} for @{order.Username}");

            return Ok(new { message = $"Payment manually marked as {(dto.Paid ? "paid" : "unpaid")}." });
        }

        // ─── DELETE ──────────────────────────────────────────────────────────

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            await _ctx.CardOrders.DeleteOneAsync(o => o.Id == id);
            await LogAsync("card_order_deleted", id);
            return Ok(new { message = "Card request deleted." });
        }
    }
}