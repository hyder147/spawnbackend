using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SpawnPointBackend.Models;
using SpawnPointBackend.Services;

namespace SpawnPointBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MessagesController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public MessagesController(MongoDbContext context)
        {
            _context = context;
        }

        [HttpPost("send")]
        public async Task<IActionResult> SendMessage(string senderId, string receiverId, string content)
        {
            if (string.IsNullOrWhiteSpace(content))
                return BadRequest(new { message = "Message can't be empty." });

            var isBlocked = await _context.Blocks.Find(b =>
                (b.BlockerId == senderId && b.BlockedId == receiverId) ||
                (b.BlockerId == receiverId && b.BlockedId == senderId)).AnyAsync();
            if (isBlocked) return BadRequest(new { message = "Message can't be sent." });

            var conversation = await _context.Conversations.Find(c =>
                c.ParticipantIds.Contains(senderId) && c.ParticipantIds.Contains(receiverId))
                .FirstOrDefaultAsync();

            if (conversation == null)
            {
                conversation = new Conversation
                {
                    ParticipantIds = new List<string> { senderId, receiverId }
                };
                await _context.Conversations.InsertOneAsync(conversation);
            }

            var message = new Message
            {
                ConversationId = conversation.Id!,
                SenderId = senderId,
                Content = content,
                SentAt = DateTime.UtcNow
            };
            await _context.Messages.InsertOneAsync(message);
            return Ok(message);
        }

        [HttpGet("conversation/{conversationId}")]
        public async Task<IActionResult> GetMessages(string conversationId)
        {
            var messages = await _context.Messages
                .Find(m => m.ConversationId == conversationId)
                .SortBy(m => m.SentAt)
                .ToListAsync();
            return Ok(messages);
        }

        [HttpGet("conversations/{userId}")]
        public async Task<IActionResult> GetConversations(string userId)
        {
            var conversations = await _context.Conversations
                .Find(c => c.ParticipantIds.Contains(userId))
                .ToListAsync();
            return Ok(conversations);
        }
    }
}