# ── Build stage ──────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj first so Docker can cache the restore layer
COPY *.csproj ./
RUN dotnet restore

# Copy the rest of the source and publish
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

# ── Runtime stage ────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Render injects $PORT at runtime — bind Kestrel to whatever port
# Render assigns instead of the hardcoded 5077 from appsettings.json.
# Default to 8080 for local `docker run` testing.
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://0.0.0.0:${PORT} dotnet SpawnPointBackend.dll"]