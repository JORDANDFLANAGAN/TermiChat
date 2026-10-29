# User Auth & Admin Session Management

**Status:** Draft · **Owner:** jordanflanagan · **Date:** 2026-10-28 · **Source:** conversation

## 1. Problem

- No system exists yet — this is greenfield.
- The project needs a foundation that other features (e.g. user messaging) can build on top of.
- Without proper auth, any future user-facing feature has no security boundary.
- Managing active sessions manually (e.g. kicking a user) is a common admin need that most starter projects skip, leaving a gap in production-readiness.
- As a public GitHub project, the codebase should demonstrate real-world engineering patterns clearly.

## 2. Goals & Non-goals

### Goals
- A user can register with a username and password and receive a session token.
- A registered user can log in and receive a session token, or log out to invalidate it.
- Protected API routes reject requests without a valid token.
- An admin can view all currently active sessions and forcibly expire any one of them.
- A CLI provides a clean terminal interface for all of the above operations.

### Non-goals
- User-to-user messaging (thinking out loud — not in this spec).
- OAuth / social login (e.g. Google, GitHub).
- Password reset / forgot password flow.
- Email verification.
- Multi-factor authentication.
- Fine-grained permissions beyond `user` vs `admin` roles.
- Rate limiting or brute-force protection (could be added later).
- Horizontal scaling / distributed session stores.

## 3. Functional Requirements

### AUTH

- **REQ-AUTH-01** · WHEN a client submits a unique username and a password, THE SYSTEM SHALL create a new user account and return a session token.
  *Verified by:* happy-path registration test

- **REQ-AUTH-02** · WHEN a username is submitted for registration that already exists, THE SYSTEM SHALL reject the request with a clear error.
  *Verified by:* duplicate-username test

- **REQ-AUTH-03** · WHEN a client submits valid credentials (username + password), THE SYSTEM SHALL return a session token valid for the duration of the session.
  *Verified by:* login happy-path test

- **REQ-AUTH-04** · WHEN a client submits invalid credentials, THE SYSTEM SHALL reject the request with a 401 response and no token.
  *Verified by:* bad-credentials test

- **REQ-AUTH-05** · WHEN a logged-in user logs out, THE SYSTEM SHALL invalidate their session token immediately.
  *Verified by:* logout + subsequent-request-rejected test

- **REQ-AUTH-06** · WHILE a protected route is accessed, THE SYSTEM SHALL validate the session token before granting access and return 401 if it is missing, invalid, or expired.
  *Verified by:* middleware unit test

### USER

- **REQ-USER-01** · THE SYSTEM SHALL store each user with at minimum: username (unique), hashed password, role (`user` | `admin`), and created-at timestamp.
  *Verified by:* schema inspection

- **REQ-USER-02** · THE SYSTEM SHALL never store or return a plaintext password at any point.
  *Verified by:* SEC review + test asserting no plaintext in DB

### SESSION

- **REQ-SESS-01** · THE SYSTEM SHALL store active sessions in the database, associating each token with a user and an expiry.
  *Verified by:* schema inspection

- **REQ-SESS-02** · WHEN a session token's expiry is reached, THE SYSTEM SHALL treat it as invalid on next use.
  *Verified by:* expiry boundary test

### ADMIN

- **REQ-ADMIN-01** · THE SYSTEM SHALL expose admin-only API endpoints that reject non-admin tokens with a 403 response.
  *Verified by:* role-guard middleware test

- **REQ-ADMIN-02** · WHEN an admin requests active sessions, THE SYSTEM SHALL return a list of all users with a currently valid (non-expired, non-revoked) session.
  *Verified by:* active-sessions endpoint test

- **REQ-ADMIN-03** · WHEN an admin targets a specific user's session for expiry, THE SYSTEM SHALL immediately invalidate that token.
  *Verified by:* kick-user test (subsequent request by that user returns 401)

### CLI

- **REQ-CLI-01** · THE SYSTEM SHALL provide CLI commands for: `register`, `login`, `logout`.
  *Verified by:* CLI integration test / manual smoke test

- **REQ-CLI-02** · THE SYSTEM SHALL provide CLI commands for admin operations: `admin:users` (list active), `admin:kick <username>`.
  *Verified by:* CLI integration test / manual smoke test

- **REQ-CLI-03** · WHEN a user logs in via the CLI, THE SYSTEM SHALL persist the returned token locally so subsequent CLI commands send it automatically.
  *Verified by:* login-then-protected-command test

- **REQ-CLI-04** · WHEN a user logs out via the CLI, THE SYSTEM SHALL remove the locally stored token.
  *Verified by:* logout-then-protected-command test

## 4. Non-functional Requirements

- **Security:** Passwords hashed with bcrypt (cost factor ≥ 10). Tokens must be unguessable (cryptographically random or JWT-signed).
- **Clarity:** Code structure should be readable by someone new to Node.js — no clever abstractions that obscure intent.
- **Portability:** SQLite acceptable at this scale (dozens of users). Schema and queries should be written in a way that allows future migration to PostgreSQL without rewriting business logic (i.e. via an ORM or query builder).
- **Observability:** API errors return structured JSON with a human-readable `message` field.

## 5. Constraints

- **Express.js** is frozen as the API framework.
- Target scale: dozens of concurrent users — no distributed systems needed.
- Must work as a public GitHub repository — no secrets hardcoded, `.env.example` provided.

## 6. Open Questions

1. **CLI library:** Ink (React-based TUI, Ratatui-like) is the leading candidate. Design phase to confirm or propose an alternative if complexity is too high for a first project. *User leans toward visual richness over simplicity.*
2. **Token format:** JWT (stateless, signed) vs. opaque random token (stored in DB). JWT is more common in tutorials; opaque tokens stored in DB are simpler to revoke (REQ-AUTH-05, REQ-ADMIN-03). Design to decide.
3. **Database:** No constraint set. SQLite (no server, just a file) recommended for this scale; design phase to confirm.
4. **Admin seeding:** How is the first admin created? Options: (a) CLI `seed:admin` command, (b) env var promoting a username to admin on first run, (c) manually via a DB script. Design to decide.
5. **Session expiry duration:** Not specified. Design to propose a sensible default (e.g. 24 hours).
