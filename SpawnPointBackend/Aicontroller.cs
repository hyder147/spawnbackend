using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SpawnPointBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AiController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly HttpClient _http;

        public AiController(IConfiguration config, IHttpClientFactory httpClientFactory)
        {
            _config = config;
            _http = httpClientFactory.CreateClient();
        }

        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] AiChatRequest request)
        {
            var apiKey = _config["Anthropic:ApiKey"];

            if (string.IsNullOrEmpty(apiKey))
            {
                return Ok(new
                {
                    content = new[] { new { type = "text", text = "SPAWN.AI is currently offline. Please configure the Anthropic API key to enable AI features." } }
                });
            }

            var payload = new
            {
                model = "claude-sonnet-4-6",
                max_tokens = 1000,
                system = "You are SPAWN.AI, an intelligent assistant inside SpawnPoint — a platform for indie game developers and beta testers. Be concise, data-aware, and slightly futuristic in tone.",
                messages = new[] { new { role = "user", content = request.Message } }
            };

            _http.DefaultRequestHeaders.Clear();
            _http.DefaultRequestHeaders.Add("x-api-key", apiKey);
            _http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(20));
                var res = await _http.PostAsJsonAsync("https://api.anthropic.com/v1/messages", payload, cts.Token);

                if (!res.IsSuccessStatusCode)
                {
                    return Ok(new
                    {
                        content = new[] { new { type = "text", text = "SPAWN.AI is currently unavailable. Please check the Anthropic API key configuration." } }
                    });
                }

                var data = await res.Content.ReadFromJsonAsync<object>(cancellationToken: cts.Token);
                return Ok(data);
            }
            catch (Exception)
            {
                // Network failure, DNS issue, timeout, or any other transport-level
                // problem talking to Anthropic — fail soft instead of a 500.
                return Ok(new
                {
                    content = new[] { new { type = "text", text = "SPAWN.AI is currently offline (connection issue). Please try again in a moment." } }
                });
            }
        }
    }

    public class AiChatRequest
    {
        public string Message { get; set; } = null!;
    }
}