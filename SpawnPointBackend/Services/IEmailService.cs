namespace SpawnPointBackend.Services
{
    public interface IEmailService
    {
        Task SendOtpAsync(string toEmail, string otp, string purpose);
    }
}