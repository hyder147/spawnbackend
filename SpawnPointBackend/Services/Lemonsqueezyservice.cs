using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SpawnPointBackend.Services
{
    public class LemonSqueezyService : ILemonSqueezyService
    {
        private readonly HttpClient _http;
        private readonly IConfiguration _config;

        private const string ApiBase = "https://api.lemonsqueezy.com/v1";

        public LemonSqueezyService(HttpClient http, IConfiguration config)
        {
            _http = http;
            _config = config;
        }

        private string ApiKey => _config["LemonSqueezy:ApiKey"] ?? "";
        private string StoreId => _config["LemonSqueezy:StoreId"] ?? "";
        private string WebhookSecret => _config["LemonSqueezy:WebhookSecret"] ?? "";
        private string VariantId => _config["LemonSqueezy:VariantId"] ?? "";

        /// <summary>Where Lemon Squeezy sends the customer back after a successful checkout.</summary>
        private string FrontendResultUrl => _config["LemonSqueezy:FrontendResultUrl"] ?? "http://localhost:5173/cards/payment-result";

        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(ApiKey) && !ApiKey.Contains("YOUR_") &&
            !string.IsNullOrWhiteSpace(StoreId) && !StoreId.Contains("YOUR_") &&
            !string.IsNullOrWhiteSpace(WebhookSecret) && !WebhookSecret.Contains("YOUR_") &&
            !string.IsNullOrWhiteSpace(VariantId) && !VariantId.Contains("YOUR_");

        private string VariantIdFor(string cardType) => VariantId;

        public async Task<(string checkoutId, string checkoutUrl)> CreateCheckoutAsync(
            string cardType, string txnRefNo, string customerEmail, string customerName, string orderId)
        {
            if (!IsConfigured)
                throw new InvalidOperationException("Lemon Squeezy is not configured. Set ApiKey, StoreId, WebhookSecret and variant ids.");

            var variantId = VariantIdFor(cardType);

            var payload = new
            {
                data = new
                {
                    type = "checkouts",
                    attributes = new
                    {
                        checkout_data = new
                        {
                            email = customerEmail,
                            name = customerName,
                            custom = new
                            {
                                order_id = orderId,
                                txn_ref_no = txnRefNo,
                                card_type = cardType,
                            }
                        },
                        product_options = new
                        {
                            redirect_url = FrontendResultUrl,
                        }
                    },
                    relationships = new
                    {
                        store = new { data = new { type = "stores", id = StoreId } },
                        variant = new { data = new { type = "variants", id = variantId } },
                    }
                }
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, $"{ApiBase}/checkouts");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ApiKey);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.api+json"));
            request.Content = JsonContent.Create(payload, options: new JsonSerializerOptions(JsonSerializerDefaults.Web));
            request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.api+json");

            var response = await _http.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"Lemon Squeezy checkout creation failed ({(int)response.StatusCode}): {body}");

            using var doc = JsonDocument.Parse(body);
            var data = doc.RootElement.GetProperty("data");
            var checkoutId = data.GetProperty("id").GetString() ?? "";
            var checkoutUrl = data.GetProperty("attributes").GetProperty("url").GetString() ?? "";

            return (checkoutId, checkoutUrl);
        }

        public bool VerifyWebhookSignature(string rawBody, string? signatureHeader)
        {
            if (string.IsNullOrWhiteSpace(signatureHeader) || string.IsNullOrWhiteSpace(WebhookSecret))
                return false;

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(WebhookSecret));
            var computedBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody));
            var computedHex = Convert.ToHexString(computedBytes).ToLowerInvariant();

            // Constant-time comparison to avoid timing attacks.
            var given = Encoding.UTF8.GetBytes(signatureHeader.ToLowerInvariant());
            var computed = Encoding.UTF8.GetBytes(computedHex);
            return given.Length == computed.Length && CryptographicOperations.FixedTimeEquals(given, computed);
        }
    }

    // ─── Minimal shape of the Lemon Squeezy "order_created" / "order_refunded" webhook payload ───

    public class LemonSqueezyWebhookPayload
    {
        [JsonPropertyName("meta")]
        public LemonSqueezyWebhookMeta Meta { get; set; } = new();

        [JsonPropertyName("data")]
        public LemonSqueezyWebhookData Data { get; set; } = new();
    }

    public class LemonSqueezyWebhookMeta
    {
        [JsonPropertyName("event_name")]
        public string EventName { get; set; } = "";

        [JsonPropertyName("custom_data")]
        public LemonSqueezyCustomData? CustomData { get; set; }
    }

    public class LemonSqueezyCustomData
    {
        [JsonPropertyName("order_id")]
        public string? OrderId { get; set; }

        [JsonPropertyName("txn_ref_no")]
        public string? TxnRefNo { get; set; }

        [JsonPropertyName("card_type")]
        public string? CardType { get; set; }
    }

    public class LemonSqueezyWebhookData
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("attributes")]
        public LemonSqueezyOrderAttributes Attributes { get; set; } = new();
    }

    public class LemonSqueezyOrderAttributes
    {
        [JsonPropertyName("order_number")]
        public long OrderNumber { get; set; }

        [JsonPropertyName("status")]
        public string Status { get; set; } = ""; // "paid", "refunded", "failed", ...

        [JsonPropertyName("user_email")]
        public string? UserEmail { get; set; }

        [JsonPropertyName("total")]
        public long Total { get; set; } // in cents

        [JsonPropertyName("currency")]
        public string? Currency { get; set; }

        [JsonPropertyName("urls")]
        public LemonSqueezyOrderUrls? Urls { get; set; }
    }

    public class LemonSqueezyOrderUrls
    {
        [JsonPropertyName("receipt")]
        public string? Receipt { get; set; }
    }
}