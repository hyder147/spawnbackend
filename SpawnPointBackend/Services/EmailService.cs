using System.Net;
using System.Net.Mail;

namespace SpawnPointBackend.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;

        public EmailService(IConfiguration config)
        {
            _config = config;
        }

        public async Task SendOtpAsync(string toEmail, string otp, string purpose)
        {
            // Sent via SMTP using credentials already configured in Railway
            // (Email:SmtpHost / SmtpPort / SmtpUser / SmtpPass / FromName) —
            // replaces the old Resend integration which was blocked by its
            // sandbox sender restriction.
            var smtpHost = _config["Email:SmtpHost"]!;
            var smtpPort = int.Parse(_config["Email:SmtpPort"] ?? "587");
            var smtpUser = _config["Email:SmtpUser"]!;
            var smtpPass = _config["Email:SmtpPass"]!;
            var fromName = _config["Email:FromName"] ?? "SpawnPoint";

            var subject = purpose == "EmailVerification"
                ? "SpawnPoint - Verify Your Email"
                : "SpawnPoint - Reset Your Password";

            var body = $"<h2>SpawnPoint</h2><p>Your OTP is: <strong>{otp}</strong></p><p>Expires in 10 minutes.</p>";

            using var message = new MailMessage
            {
                From = new MailAddress(smtpUser, fromName),
                Subject = subject,
                Body = body,
                IsBodyHtml = true
            };
            message.To.Add(toEmail);

            using var client = new SmtpClient(smtpHost, smtpPort)
            {
                Credentials = new NetworkCredential(smtpUser, smtpPass),
                EnableSsl = true
            };

            await client.SendMailAsync(message);
        }
    }
}