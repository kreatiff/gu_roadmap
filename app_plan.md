Gemini said
Here is the comprehensively revised development plan. It incorporates better-sqlite3 for robust data concurrency and @fastify/cookie for secure, XSS-resistant session management.

These architectural upgrades cascade beautifully through the stack, actually simplifying the frontend by entirely eliminating the need to manually manage tokens or build a dedicated callback page.

Context & Key Decisions
A public-facing Roadmap & Feature Request app for a university.

Auth: University OAuth2/OIDC SSO.

Session Security: [UPDATED] HttpOnly, Secure, SameSite=Lax cookies. The frontend never touches a JWT.

Database: [UPDATED] better-sqlite3 running in WAL (Write-Ahead Logging) mode to safely handle high-concurrency read/writes when many students vote simultaneously.

Admin: Whitelisted emails via ADMIN_EMAILS env var.

Deployment: Single Node.js Fastify process serving both API and static React files.

Architecture Overview
Tech Stack
Backend: Fastify v5 (Node.js, ESM)

Database: better-sqlite3 (SQLite relational flat-file)

Frontend: React 19 + Vite 6

Routing: React Router v7

SSO: openid-client v6

Session tokens: @fastify/jwt + @fastify/cookie

Styling: Plain CSS with BEM/CSS Variables (or CSS Modules, Vite supports them out of the box).

Data Models (SQLite Schema)
features: id (TEXT UUID), title (TEXT), slug (TEXT UNIQUE), description (TEXT), status (TEXT), category_id (TEXT NULL), vote_count (INTEGER DEFAULT 0), tags (TEXT JSON), pinned (INTEGER DEFAULT 0), created_at (TEXT), updated_at (TEXT).

categories: id (TEXT UUID), name (TEXT), description (TEXT), color (TEXT), order_idx (INTEGER).

votes: user_id (TEXT - SHA-256 hashed sub), feature_id (TEXT). Primary Key: (user_id, feature_id) (Enforces 1 vote per user natively).

API Surface
Method Path Auth Purpose
GET /api/auth/login — Redirect to university OIDC provider
GET /api/auth/callback — OIDC exchange → Set HttpOnly Cookie → Redirect to frontend /
GET /api/auth/me user Return { email, isAdmin } based on cookie
POST /api/auth/logout user [UPDATED] Clear HttpOnly cookie → 200 OK
GET /api/features public List + filter; adds userVoted if valid cookie present
POST /api/features/:id/vote user Cast vote (Uses SQL Transaction)
DELETE /api/features/:id/vote user Remove vote (Uses SQL Transaction)
CRUD /api/features/_ admin Create, Update, Delete (cascades votes via SQL FOREIGN KEY)
CRUD /api/categories/_ admin Category management
Complete File Structure (Updated)
Code snippet
├── package.json
├── .env.example
├── server/
│ ├── package.json
│ └── src/
│ ├── index.js # Registers cors, cookie, jwt, static, routes
│ ├── config.js
│ ├── db.js # better-sqlite3 init + PRAGMA journal_mode = WAL
│ ├── auth.js # Middleware: reads token from cookie
│ ├── oidc.js
│ ├── seed.js # SQL INSERT statements
│ └── routes/
│ ├── auth.js # Sets/clears cookies
│ ├── features.js # SQL queries
│ ├── categories.js
│ └── votes.js # SQL Transactions
│ └── data/
│ └── .gitkeep # database.sqlite will be created here
├── client/
│ ├── package.json
│ ├── vite.config.js
│ ├── index.html
│ └── src/
│ ├── main.jsx
│ ├── App.jsx
│ ├── router.jsx
│ ├── api/
│ │ ├── client.js # [UPDATED] fetch wrapper uses credentials: 'include'
│ │ └── ...
│ ├── contexts/
│ │ └── AuthContext.jsx
│ ├── hooks/
│ ├── components/ # (UI components remain the same)
│ ├── pages/
│ │ ├── RoadmapPage/
│ │ └── admin/ # (Admin pages remain the same)
│ └── styles/
Notice: AuthCallbackPage is completely deleted from the client folder. The backend now handles the entire callback and redirect.

Package Dependencies (Updated)
server/package.json

JSON
{
"type": "module",
"dependencies": {
"fastify": "^5.3.3",
"@fastify/cors": "^10.0.2",
"@fastify/jwt": "^9.0.1",
"@fastify/cookie": "^11.0.1",
"@fastify/static": "^8.0.0",
"openid-client": "^6.1.0",
"better-sqlite3": "^11.8.1",
"uuid": "^11.1.0",
"slugify": "^1.6.6",
"dotenv": "^16.4.7"
}
}
Implementation Phases
Phase 1 — Project Scaffolding & DB
Environment: Add COOKIE_SECRET to .env.

Database (server/src/db.js):

Initialize better-sqlite3 at server/data/database.sqlite.

CRITICAL: Execute db.pragma('journal_mode = WAL'); immediately after connection to enable high-concurrency reads/writes.

Execute CREATE TABLE IF NOT EXISTS statements for features, categories, and votes. Ensure votes.feature_id has REFERENCES features(id) ON DELETE CASCADE.

Phase 2 — Secure Backend Auth & API
Plugins (server/src/index.js):

Register @fastify/cookie with the COOKIE_SECRET.

Register @fastify/jwt and configure it to look for the cookie: { cookie: { cookieName: 'roadmap_session', signed: true } }.

Register @fastify/cors with { origin: process.env.CLIENT_ORIGIN, credentials: true }.

OIDC Callback (server/src/routes/auth.js):

After exchanging tokens and hashing the sub, issue the JWT.

Instead of returning the token in the URL, set it directly on the response:
reply.setCookie('roadmap_session', token, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', signed: true })

Redirect the user cleanly to process.env.CLIENT_ORIGIN.

Logout Route: Create POST /api/auth/logout that simply executes reply.clearCookie('roadmap_session', { path: '/' }).send({ ok: true }).

Voting API (server/src/routes/votes.js):

Use a SQLite transaction to ensure data integrity:

JavaScript
const voteTx = db.transaction((userId, featureId) => {
db.prepare('INSERT INTO votes (user_id, feature_id) VALUES (?, ?)').run(userId, featureId);
db.prepare('UPDATE features SET vote_count = vote_count + 1 WHERE id = ?').run(featureId);
});
// Run it safely: voteTx(req.user.sub, req.params.id);
Phase 3 — Frontend Auth (Simplified)
API Client (client/src/api/client.js):

Remove all localStorage logic.

Update fetch options to universally include credentials: 'include'. This tells the browser to automatically attach the roadmap_session cookie to every request.

Auth Context (client/src/contexts/AuthContext.jsx):

On mount, simply call GET /api/auth/me.

If it returns 200 with the user object, isAuthenticated is true. If it returns 401, they are a guest.

login() still redirects to GET /api/auth/login.

logout() now calls POST /api/auth/logout, then sets the local React user state to null. No token cleanup required.

Phase 4 & 5 — Public UI and Admin Dashboard
(These phases remain largely identical to your original plan, as the UI logic does not care whether the backend uses SQLite or lowdb, nor does it care how the browser stores the cookie).

Ensure the Admin UI leverages the simplified AuthContext. Since credentials: 'include' is set, admin mutations (POST, PUT, DELETE to /api/features) will automatically be authenticated.

Phase 6 — Deployment & Gotchas
CORS in Development: Because Vite runs on 5173 and Fastify on 3001, credentials: true in Fastify's CORS config is strictly required for the cookie to be accepted by the browser during local development.

SQL Injection Prevention: Remind your AI agents to never use template literals for SQL queries. Always use better-sqlite3's prepared statements: db.prepare('SELECT \* FROM features WHERE status = ?').all(status).

Production Cookie Flags: Ensure secure: true is set on the cookie when running in production (served over HTTPS), but it must be false (or conditionally set) when testing locally on http://localhost.
