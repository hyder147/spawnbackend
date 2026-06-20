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
            var smtpHost = _config["Email:SmtpHost"]!;
            var smtpPort = int.Parse(_config["Email:SmtpPort"]!);
            var smtpUser = _config["Email:SmtpUser"]!;
            var smtpPass = _config["Email:SmtpPass"]!;
            var fromName = _config["Email:FromName"] ?? "SpawnPoint";

            var subject = purpose == "EmailVerification"
                ? "SpawnPoint - Verify Your Email"
                : "SpawnPoint - Reset Your Password";

            var body = purpose == "EmailVerification"
                ? $@"
                    <div style='font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e0e0e0;border-radius:10px;'>
                        <h2 style='color:#6c63ff;'>Welcome to SpawnPoint! 🎮</h2>
                        <p>Thanks for signing up! Use the OTP below to verify your email address.</p>
                        <div style='background:#f4f4f4;padding:20px;text-align:center;border-radius:8px;margin:20px 0;'>
                            <h1 style='letter-spacing:10px;color:#333;'>{otp}</h1>
                        </div>
                        <p style='color:#888;font-size:13px;'>This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
                    </div>"
                : $@"
                    <div style='font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e0e0e0;border-radius:10px;'>
                        <h2 style='color:#6c63ff;'>SpawnPoint - Password Reset 🔐</h2>
                        <p>We received a request to reset your password. Use the OTP below.</p>
                        <div style='background:#f4f4f4;padding:20px;text-align:center;border-radius:8px;margin:20px 0;'>
                            <h1 style='letter-spacing:10px;color:#333;'>{otp}</h1>
                        </div>
                        <p style='color:#888;font-size:13px;'>This OTP expires in <strong>10 minutes</strong>. If you didn't request this, ignore this email.</p>
                    </div>";

            using var client = new SmtpClient(smtpHost, smtpPort)
            {
                EnableSsl = true,
                Credentials = new NetworkCredential(smtpUser, smtpPass)
            };

            var mail = new MailMessage
            {
                From = new MailAddress(smtpUser, fromName),
                Subject = subject,
                Body = body,
                IsBodyHtml = true
            };
            mail.To.Add(toEmail);

            await client.SendMailAsync(mail);
        }
    }
}