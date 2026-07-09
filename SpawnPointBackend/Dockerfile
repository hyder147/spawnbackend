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

# Railway injects its own port variable (HTTP_PORTS) and .NET 8
# reads it automatically — no need to manually set ASPNETCORE_URLS
# or hardcode a port like the old Render setup did.
EXPOSE 8080

ENTRYPOINT ["dotnet", "SpawnPointBackend.dll"]