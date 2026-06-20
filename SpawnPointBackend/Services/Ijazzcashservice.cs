namespace SpawnPointBackend.Services
{
    /// <summary>
    /// Wraps JazzCash's Hosted Checkout / Page Redirection API (v1.1).
    /// Docs: https://sandbox.jazzcash.com.pk/SandboxDocumentation/
    /// The merchant never collects card/wallet details directly — we build a signed
    /// set of pp_* fields, the frontend auto-submits them as a POST form to
    /// <see cref="CheckoutUrl"/>, and JazzCash redirects the customer back to our
    /// server-side callback once payment finishes.
    /// </summary>
    public interface IJazzCashService
    {
        /// <summary>Sandbox or production hosted-checkout form action URL.</summary>
        string CheckoutUrl { get; }

        /// <summary>The backend callback URL we hand to JazzCash as pp_ReturnURL.</summary>
        string ReturnUrl { get; }

        /// <summary>Builds the full pp_* field set (incl. pp_SecureHash) for a hosted-checkout POST.</summary>
        Dictionary<string, string> BuildCheckoutFields(string txnRefNo, decimal amountPkr, string billReference, string description);

        /// <summary>Recomputes the secure hash over the callback fields and compares it to pp_SecureHash.</summary>
        bool VerifyCallbackHash(IDictionary<string, string> callbackFields);

        /// <summary>True once real (non-placeholder) JazzCash credentials have been configured.</summary>
        bool IsConfigured { get; }
    }
}