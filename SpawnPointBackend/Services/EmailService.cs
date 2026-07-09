using System.Text;
using System.Text.Json;

namespace SpawnPointBackend.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly HttpClient _httpClient;

        public EmailService(IConfiguration config, IHttpClientFactory httpClientFactory)
        {
            _config = config;
            _httpClient = httpClientFactory.CreateClient();
        }

        public async Task SendOtpAsync(string toEmail, string otp, string purpose)
        {
            var apiKey = _config["Resend:ApiKey"]!;
            var subject = purpose == "EmailVerification"
                ? "SpawnPoint - Verify Your Email"
                : "SpawnPoint - Reset Your Password";

            var body = $"<h2>SpawnPoint</h2><p>Your OTP is: <strong>{otp}</strong></p><p>Expires in 10 minutes.</p>";

            var payload = new
            {
                from = "SpawnPoint <onboarding@resend.dev>",
                to = new[] { toEmail },
                subject = subject,
                html = body
            };

            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
            request.Headers.Add("Authorization", $"Bearer {apiKey}");
            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            var response = await