using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using SpawnPointBackend.Middleware;
using SpawnPointBackend.Repositories;
using SpawnPointBackend.Services;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// ─── Startup Validation ───────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("JWT Key not found in appsettings!");
var mongoConn = builder.Configuration["ConnectionStrings:MongoDb"]
    ?? throw new InvalidOperationException("MongoDB connection string is missing!");
if (jwtKey.Length < 32)
    throw new InvalidOperationException("JWT Key minimum 12 characters!");

// ─── Core Services ────────────────────────────────────────────
builder.Services.AddSingleton<MongoDbContext>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpClient(); // Required by AiController and BountyController

// ─── Repositories ─────────────────────────────────────────────
builder.Services.AddScoped<IPostsRepository, PostsRepository>();
builder.Services.AddScoped<IBlocksRepository, BlocksRepository>();

// ─── Services ─────────────────────────────────────────────────
builder.Services.AddScoped<IPostsService, PostsService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddHttpClient<ILemonSqueezyService, LemonSqueezyService>();

// ─── Ghost Mode Background Service ────────────────────────────
// Runs every 2 minutes, marks abandoned testing sessions as ghosted
builder.Services.AddHostedService<GhostCheckerService>();

// ─── Rate Limiting ────────────────────────────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("api", opt =>
    {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });

    options.RejectionStatusCode = 429;
});

// ─── JWT Authentication ───────────────────────────────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.Zero,
            RoleClaimType = System.Security.Claims.ClaimTypes.Role
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("admin"));
    options.AddPolicy("ModOrAdmin", policy => policy.RequireRole("admin", "moderator"));
});

// ─── Swagger with JWT ─────────────────────────────────────────
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "SpawnPoint API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter JWT token: Bearer {token}"
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ─── CORS ─────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevPolicy", policy =>
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader());

    options.AddPolicy("ProdPolicy", policy =>
        policy.WithOrigins(builder.Configuration["AllowedOrigins"] ?? "https://yourdomain.com")
              .AllowAnyMethod()
              .AllowAnyHeader());
});

// ─── Health Check ─────────────────────────────────────────────
builder.Services.AddHealthChecks();

// ─── Build ────────────────────────────────────────────────────
var app = builder.Build();

// ─── Exception Middleware ─────────────────────────────────────
app.UseMiddleware<GlobalExceptionMiddleware>();

// ─── Pipeline ─────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseCors("DevPolicy");
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
    app.UseCors("ProdPolicy");
}

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");
app.Run();