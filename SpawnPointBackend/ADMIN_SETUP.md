# SpawnPoint — Admin Panel Setup Guide

## Admin Panel Features

### Backend (ASP.NET Core)
- `GET  /api/admin/stats` — Platform stats (total users, games, posts, etc.)
- `GET  /api/admin/users` — Users list (pagination + filter: search, userType, status)
- `GET  /api/admin/users/{id}` — Single user detail + activity
- `POST /api/admin/users/{id}/suspend` — Suspend karo (reason + optional hours)
- `POST /api/admin/users/{id}/unsuspend` — Suspension hata do
- `POST /api/admin/users/{id}/ban` — Permanent ban
- `POST /api/admin/users/{id}/unban` — Ban hata do
- `POST /api/admin/users/{id}/role` — Role change (user/moderator/admin)
- `PUT  /api/admin/users/{id}/notes` — Admin notes save karo
- `POST /api/admin/users/{id}/verify-email` — Force email verify
- `DELETE /api/admin/users/{id}` — User delete (cascade — posts/stories/feedback bhi)
- `GET  /api/admin/posts` — Posts list (pagination + search)
- `DELETE /api/admin/posts/{id}` — Post delete
- `GET  /api/admin/games` — Games list
- `PUT  /api/admin/games/{id}/status` — Game status change (Alpha/Beta/Released/Suspended)
- `DELETE /api/admin/games/{id}` — Game delete
- `GET  /api/admin/communities` — Communities list
- `DELETE /api/admin/communities/{id}` — Community delete
- `GET  /api/admin/feedback` — All feedback
- `DELETE /api/admin/feedback/{id}` — Feedback delete
- `GET  /api/admin/logs` — Admin audit log
- `GET  /api/admin/search?q=` — Cross-entity search

### Frontend
- `/admin` route — Admin Panel page (sirf `role: "admin"` wale access kar sakte hain)
- Navbar mein "⚙ Admin" link automatically dikhta hai admin users ko
- Tabs: Dashboard, Users, Posts, Games, Communities, Audit Logs
- Global search bar
- User detail drawer (side panel)

---

## Pehla Admin User Kaise Banayein

### Option A: MongoDB Compass / Shell se directly update karo

```javascript
// MongoDB Shell
use SpawnPointDb

db.Users.updateOne(
  { email: "your-admin-email@example.com" },
  { $set: { role: "admin" } }
)
```

### Option B: Seed script (Node.js)

```javascript
const { MongoClient } = require('mongodb');

async function makeAdmin() {
    const client = new MongoClient('YOUR_MONGODB_URI');
    await client.connect();
    const db = client.db('SpawnPointDb');
    
    const result = await db.collection('Users').updateOne(
        { email: 'your-email@example.com' },
        { $set: { role: 'admin' } }
    );
    
    console.log('Updated:', result.modifiedCount);
    await client.close();
}

makeAdmin();
```

### Option C: Backend startup mein seed karo (development)

`Program.cs` mein `app.Run()` se pehle ye add karo:

```csharp
// ─── Dev-only: pehla admin banana ─────────────────────────────
if (app.Environment.IsDevelopment())
{
    var ctx = app.Services.GetRequiredService<MongoDbContext>();
    var adminEmail = "admin@spawnpoint.com"; // apna email dalo
    var admin = await ctx.Users.Find(u => u.Email == adminEmail).FirstOrDefaultAsync();
    if (admin != null && admin.Role != "admin")
    {
        await ctx.Users.UpdateOneAsync(u => u.Email == adminEmail,
            Builders<User>.Update.Set(u => u.Role, "admin"));
        Console.WriteLine($"[DEV] Admin role set for {adminEmail}");
    }
}
```

---

## Login ke Baad Admin Panel Access

1. Admin email se login karo
2. Navbar mein "⚙ Admin" link dikhega
3. Ya directly `/admin` URL pe jao

---

## Security Notes

- Sab admin routes `[Authorize(Policy = "AdminOnly")]` se protected hain
- JWT token mein `role` claim check hoti hai
- Admin apna account delete/ban nahi kar sakta
- Har action `AdminLogs` collection mein log hota hai (full audit trail)
- Suspended users login try karein to auto-expire check hota hai
- Banned users bilkul login nahi kar sakte

---

## Models Changes

`User` model mein ye fields add hue:
- `Role` (string): "user" | "admin" | "moderator"
- `IsSuspended` (bool)
- `SuspendReason` (string?)
- `SuspendedAt` (DateTime?)
- `SuspendedUntil` (DateTime?) — null = permanent suspension
- `IsBanned` (bool)
- `BanReason` (string?)
- `BannedAt` (DateTime?)
- `AdminNotes` (string?)
- `CreatedAt` (DateTime)

New models:
- `AdminLog` — har admin action ka record
- `PlatformStats` — dashboard ke liye stats DTO
