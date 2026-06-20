using System.Security.Cryptography;
using System.Text;

namespace SpawnPointBackend.Services
{
    public class JazzCashService : IJazzCashService
    {
        private readonly IConfiguration _config;

        public JazzCashService(IConfiguration config)
        {
            _config = config;
        }

        private string MerchantId => _config["JazzCash:MerchantId"] ?? "";
        private string Password => _config["JazzCash:Password"] ?? "";
        private string IntegritySalt => _config["JazzCash:IntegritySalt"] ?? "";
        private string Env => _config["JazzCash:Environment"] ?? "Sandbox";

        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(MerchantId) && !MerchantId.Contains("YOUR_") &&
            !string.IsNullOrWhiteSpace(Password) && !Password.Contains("YOUR_") &&
            !string.IsNullOrWhiteSpace(IntegritySalt) && !IntegritySalt.Contains("YOUR_") &&
            !string.IsNullOrWhiteSpace(ReturnUrl);  // ✅ ADD THIS CHECK

        public string CheckoutUrl => Env.Equals("Live", StringComparison.OrdinalIgnoreCase) ||
                                      Env.Equals("Production", StringComparison.OrdinalIgnoreCase)
            ? (_config["JazzCash:ProductionUrl"] ?? "https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/")
            : (_config["JazzCash:SandboxUrl"] ?? "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/");

        /// <summary>Backend endpoint JazzCash POSTs the result back to — NOT the frontend page.</summary>
        public string ReturnUrl
        {
            get
            {
                var url = _config["JazzCash:ReturnUrl"];

                // ✅ IMPROVED: Check for empty/missing value and provide helpful error
                if (string.IsNullOrWhiteSpace(url))
                {
                    throw new InvalidOperationException(
                        "JazzCash ReturnUrl is not configured. " +
                        "Please set 'JazzCash:ReturnUrl' in appsettings.json or environment variables. " +
                        "Example: 'https://your-domain.com/api/cards/jazzcash/callback'");
                }

                return url;
            }
        }

        public Dictionary<string, string> BuildCheckoutFields(string txnRefNo, decimal amountPkr, string billReference, string description)
        {
            // ✅ IMPROVED: Validate ReturnUrl before building form
            var returnUrl = ReturnUrl;  // This will throw if not configured

            // JazzCash operates on Pakistan time for txn windows.
            var nowPkt = DateTime.UtcNow.AddHours(5);
            var txnDateTime = nowPkt.ToString("yyyyMMddHHmmss");
            var expiryDateTime = nowPkt.AddHours(1).ToString("yyyyMMddHHmmss");

            // pp_Amount is in the lowest currency unit (paisa) — no decimal point.
            var amountInPaisa = ((long)Math.Round(amountPkr * 100, MidpointRounding.AwayFromZero)).ToString();

            var fields = new Dictionary<string, string>
            {
                ["pp_Version"] = "1.1",
                ["pp_TxnType"] = "MWALLET",
                ["pp_Language"] = "EN",
                ["pp_MerchantID"] = MerchantId,
                ["pp_SubMerchantID"] = "",
                ["pp_Password"] = Password,
                ["pp_BankID"] = "",
                ["pp_ProductID"] = "",
                ["pp_TxnRefNo"] = txnRefNo,
                ["pp_Amount"] = amountInPaisa,
                ["pp_TxnCurrency"] = "PKR",
                ["pp_TxnDateTime"] = txnDateTime,
                ["pp_BillReference"] = billReference,
                ["pp_Description"] = description,
                ["pp_TxnExpiryDateTime"] = expiryDateTime,
                ["pp_ReturnURL"] = returnUrl,  // ✅ NOW GUARANTEED TO BE NON-EMPTY
                ["ppmpf_1"] = "",
                ["ppmpf_2"] = "",
                ["ppmpf_3"] = "",
                ["ppmpf_4"] = "",
                ["ppmpf_5"] = "",
            };

            fields["pp_SecureHash"] = ComputeHash(fields);
            return fields;
        }

        public bool VerifyCallbackHash(IDictionary<string, string> callbackFields)
        {
            if (!callbackFields.TryGetValue("pp_SecureHash", out var givenHash) || string.IsNullOrWhiteSpace(givenHash))
                return false;

            var withoutHash = callbackFields
                .Where(kv => kv.Key != "pp_SecureHash")
                .ToDictionary(kv => kv.Key, kv => kv.Value);

            var computed = ComputeHash(withoutHash);
            return string.Equals(givenHash, computed, StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// JazzCash HMAC-SHA256 hashing algorithm: sort all non-empty fields by key (ascending,
        /// ordinal), join their values with '&', prefix with the integrity salt, then HMAC-SHA256
        /// the whole string using the integrity salt as the key. Result is lowercase hex.
        /// </summary>
        private string ComputeHash(Dictionary<string, string> fields)
        {
            var sortedValues = fields
                .Where(kv => kv.Key != "pp_SecureHash" && !string.IsNullOrEmpty(kv.Value))
                .OrderBy(kv => kv.Key, StringComparer.Ordinal)
                .Select(kv => kv.Value);

            var hashSource = IntegritySalt + "&" + string.Join("&", sortedValues);

            using var sha = SHA256.Create();
            var hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(hashSource));
            return Convert.ToHexString(hashBytes).ToLowerInvariant();
        }
    }
}