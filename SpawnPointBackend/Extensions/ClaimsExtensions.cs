using System.Security.Claims;

namespace SpawnPointBackend.Extensions
{
    public static class ClaimsExtensions
    {
        public static string GetUserId(this ClaimsPrincipal user)
        {
            return user.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? user.FindFirstValue("sub")
                ?? throw new UnauthorizedAccessException("User ID token not found.");
        }

        public static bool IsOwner(this ClaimsPrincipal user, string resourceOwnerId)
        {
            return user.GetUserId() == resourceOwnerId;
        }
    }
}
