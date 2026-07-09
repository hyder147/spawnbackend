namespace SpawnPointBackend.Services
{
    /// <summary>
    /// Wraps Lemon Squeezy's hosted Checkout API + webhook verification.
    /// Docs: https://docs.lemonsqueezy.com/api/checkouts
    /// Lemon Squeezy acts as merchant of record — we never touch card details.
    /// We create a checkout session server-side, redirect the user to the
    /// hosted checkout URL Lemon Squeezy gives us, and they POST a signed
    /// webhook back to us once the order is paid.
    /// </summary>
    public interface ILemonSqueezyService
    {
        /// <summary>True once a real (non-placeholder) API key, store id and variant ids are configured.</summary>
        bool IsConfigured { get; }

        /// <summary>
        /// Creates a hosted checkout for the given card type and returns the checkout id
        /// plus the URL to redirect the user to.
        /// </summary>
        Task<(string checkoutId, string checkoutUrl)> CreateCheckoutAsync(
            string cardType, string txnRefNo, string customerEmail, string customerName, string orderId);

        /// <summary>
        /// Verifies the X-Signature header Lemon Squeezy sends with every webhook request:
        /// HMAC-SHA256 of the raw request body, keyed with the webhook signing secret.
        /// </summary>
        bool VerifyWebhookSignature(string rawBody, string? signatureHeader);
    }
}