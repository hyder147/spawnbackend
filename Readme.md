## 🎬 Project Demo

[![SpawnPoint Demo](https://img.youtube.com/vi/dh6YjS-m93w/hqdefault.jpg)](https://youtu.be/dh6YjS-m93w)





# SpawnPoint

SpawnPoint is a social platform for gamers — find squads, scout players, join communities, track games, and connect with other players. It has a React (TypeScript) frontend and an ASP.NET Core backend backed by MongoDB.

## Features

- User accounts with JWT-based authentication (register, login, email verification, password reset)
- Social feed, communities, and friends system
- Squad management and scout mode for finding teammates
- Game listing and tracking
- Ghost mode (privacy/visibility control)
- Admin panel for managing users, posts, games, and communities
- Feedback and bug bounty ("crash bounty") submission
- Card payments via LemonSqueezy

## Tech Stack

**Frontend** — `SpawnPointFrontend/`
- React 19 + TypeScript
- Vite
- React Router
- Axios

**Backend** — `SpawnPointBackend/`
- ASP.NET Core (.NET 8)
- MongoDB (via `MongoDB.Driver`)
- JWT authentication (`Microsoft.AspNetCore.Authentication.JwtBearer`)
- BCrypt for password hashing
- Swagger / OpenAPI

## Project Structure
CompleteSpawn/
├── SpawnPointFrontend/ # React + Vite client
└── SpawnPointBackend/ # ASP.NET Core API

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [MongoDB](https://www.mongodb.com/try/download/community) (local instance or MongoDB Atlas)

### Backend Setup

```bash
cd SpawnPointBackend
cp appsettings.example.json appsettings.json
```

Open `appsettings.json` and fill in your own values:

- `ConnectionStrings:MongoDb` — your MongoDB connection string
- `Jwt:Key` — a long, random secret string (used to sign login tokens)
- `Email:SmtpUser` / `Email:SmtpPass` — an email account for sending verification/reset emails (for Gmail, use an [App Password](https://myaccount.google.com/apppasswords), not your regular password)
- `Anthropic:ApiKey` — only needed if AI features are used
- `LemonSqueezy:ApiKey` / `StoreId` — only needed for payments

Then run:

```bash
dotnet restore
dotnet run
```

### Frontend Setup

```bash
cd SpawnPointFrontend
npm install
cp .env.example .env.local
```

Edit `.env.local` and point `VITE_API_BASE` at your running backend (e.g. `http://localhost:5077/api`).

```bash
npm run dev
```

## Environment & Secrets

This repo does **not** contain real credentials. Files like `appsettings.json` and `.env.local` are git-ignored on purpose — copy the provided `.example` files and fill in your own values. Never commit real API keys, database credentials, or JWT secrets.

In production, prefer setting secrets as environment variables (e.g. `Jwt__Key`, `ConnectionStrings__MongoDb`, `Email__SmtpPass`) rather than committing them to any config file.

## Admin Setup

See [`SpawnPointBackend/ADMIN_SETUP.md`](SpawnPointBackend/ADMIN_SETUP.md) for instructions on creating the first admin user.

## License

This project currently has no license specified — all rights reserved by the author unless stated otherwise.
