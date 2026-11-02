# TermiChat

A real-time terminal chat application. Users register, create or join rooms, and exchange messages that appear instantly for everyone in the room — all from the command line.

Built with Node.js, TypeScript, Express, SQLite, and Ink (React for the terminal).

---

## Features

- Register and login with secure bcrypt-hashed passwords
- Create and join chat rooms
- Real-time messaging via Server-Sent Events (SSE) with automatic reconnect
- Scrollable message history with automatic prefetch
- Unread message indicators per room
- Admin controls — view active users, kick sessions, delete rooms
- Rate limiting on auth endpoints
- Token rotation on every login
- Automatic stale session cleanup on login
- Graceful shutdown — flushes SSE connections and checkpoints the database cleanly

---

## Prerequisites

- Node.js v18 or higher
- npm

---

## Local Setup

**1. Clone the repo**

```bash
git clone https://github.com/JORDANDFLANAGAN/TermiChat.git
cd TermiChat
```

**2. Install dependencies**

```bash
npm install
```

**3. Start the server**

```bash
npm start
```

The API will be listening on `http://localhost:3000`.

**4. Run the CLI** (in a separate terminal)

```bash
npx tsx src/cli/index.ts
```

---

## Admin Setup

After registering your account, promote it to admin with:

```bash
npm run make-admin <username>
```

The server must not be running when you do this (or you can run it while the server is up — SQLite WAL mode handles concurrent access fine). Admins can view active sessions, kick users, and delete rooms from within the CLI.

---

## Connecting Remotely

If the server is running on another machine or exposed via a tunnel (e.g. VS Code port forwarding), point the CLI at it using the `BASE_URL` environment variable:

```bash
BASE_URL=https://your-tunnel-url.example.com npx tsx src/cli/index.ts
```

---

## Project Structure

```
src/
  server.ts              # Express entry point
  db.ts                  # SQLite setup and schema
  routes/
    auth.ts              # Register, login, logout, /me
    chat.ts              # Rooms, messages, SSE stream
    admin.ts             # Admin-only endpoints
  middleware/
    auth.ts              # Token validation
    requireAdmin.ts      # Admin role check
  cli/
    index.ts             # CLI entry point
    commands/            # API call functions (auth, chat, admin)
    ui/                  # Ink components (App, Chatroom, RoomList, ...)
```

---

## How It Works

### Rate Limiting

Defined in `src/routes/auth.ts`. Two `express-rate-limit` instances are created at the top of the file:

```ts
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, ... });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, ... });
```

Each is passed as middleware directly on its route — `router.post('/login', loginLimiter, ...)` — so the check runs before any of the route logic. The limiter tracks a hit counter per IP address in memory. When the counter exceeds `max` within the `windowMs`, it short-circuits the request and returns the error message instead of reaching the handler. `app.set('trust proxy', 1)` in `src/server.ts` tells Express to read the real client IP from the `X-Forwarded-For` header set by the tunnel, otherwise every request would appear to come from the same proxy IP and the counter would be shared across all users.

---

### Stale Token Auto-Logout

Split across two files. In `src/cli/ui/App.tsx`, on every mount and re-login, a `useEffect` calls `getMe()` to verify the saved token is still valid:

```ts
getMe()
    .then(user => { setIsAdmin(user.role === 'admin'); setUsername(user.username); })
    .catch(() => { deleteToken(); setLoggedIn(false); });
```

If the server returns a 401 (expired session, wiped database, etc.), `getMe()` throws and the catch block deletes the token file from `~/.termichat/token` and flips `loggedIn` to false, dropping the UI back to the login menu.

In `src/cli/commands/auth.ts`, the `logout` function always deletes the local token in a `finally` block regardless of whether the server accepted the request:

```ts
try {
    await instance.post('/auth/logout', ...);
} catch {
    // server rejection is fine — token may already be invalid
} finally {
    deleteToken();
}
```

This means logout can never get stuck — even if the session no longer exists on the server.

---

### SSE Live Messages

The server side lives in `src/routes/chat.ts`. A `Map` at the top of the file holds all open SSE connections, keyed by room ID:

```ts
const subscribers = new Map<number, Set<Response>>();
```

When a client hits `GET /chat/rooms/:roomId/stream`, the response object is added to that room's Set and kept open (headers set to `text/event-stream`, connection never closed by the server). When a message is posted via `POST /chat/rooms/:roomId/messages`, after inserting it into the database the `broadcast()` function writes the message to every response in that room's Set:

```ts
client.write(`data: ${JSON.stringify(data)}\n\n`);
```

On the client side in `src/cli/commands/chat.ts`, `streamMessages` opens a persistent `http.get` request with the auth token in the header. Incoming chunks are buffered as a string and split on `\n\n` (the SSE frame boundary). Each frame is scanned for a `data: ` line, parsed as JSON, and passed to the `onMessage` callback. Back in `Chatroom.tsx` that callback calls `setMessages(prev => [...prev, msg])`, which triggers a React re-render and the new message appears.

If the connection drops (network blip, server restart, tunnel timeout), `streamMessages` reconnects automatically using exponential backoff — 1 s, 2 s, 4 s, up to 30 s. The delay resets to 1 s on each successful reconnect. A `stopped` flag set by the cleanup function prevents any further attempts after the user leaves the room.

`Chatroom.tsx` tracks the connection status and shows a `reconnecting...` indicator next to the room name while the stream is down. On reconnect it also fetches the latest message batch and merges it by ID into the existing list, so any messages that arrived during the outage appear without duplication.

---

### Stale Session Cleanup

Expired sessions are pruned from the database at the start of every login request, before the new session is created:

```ts
db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
```

This runs at the natural point where the database is already being written to, so there's no background timer or cron job to manage. Sessions expire after 24 hours, so in a low-traffic deployment the table stays small without any extra infrastructure.

---

### Graceful Shutdown

`src/server.ts` registers handlers for `SIGTERM` and `SIGINT`:

```ts
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

The `shutdown` function does three things in order. First it calls `closeAllConnections()`, which iterates every open SSE response in the subscribers map, calls `.end()` on each one (so connected clients get a clean EOF rather than a broken pipe), and clears the map. Then it calls `server.close()` to stop accepting new HTTP connections and waits for in-flight requests to drain. Finally, inside the `server.close()` callback, it calls `db.close()` — this triggers SQLite's WAL checkpoint, flushing the write-ahead log back into the main database file before the process exits.

`SIGTERM` is what process managers like PM2 send on a restart or deploy. `SIGINT` is Ctrl-C in development. Both are handled identically.

---

### Unread Message Indicators

Each room in the list shows a yellow `·N` count next to its name when there are messages you haven't seen. The count only appears for rooms you're a member of.

The server tracks reads with a `last_read_id` column on the `members` table — one integer per user per room, defaulting to `0`. The `GET /chat/rooms` query computes the unread count inline for each room:

```sql
SELECT COUNT(*) FROM messages
WHERE messages.room_id = rooms.id
AND messages.id > members.last_read_id
```

When you open a room, the client calls `POST /chat/rooms/:roomId/read`, which advances your `last_read_id` to the current `MAX(id)` in that room:

```sql
UPDATE members SET last_read_id = COALESCE(
    (SELECT MAX(id) FROM messages WHERE room_id = ?), 0
) WHERE room_id = ? AND user_id = ?
```

This call happens twice per visit — once on mount (clears the badge immediately when you enter) and once on unmount (catches any SSE messages that arrived while you were in the room). A failed mark is silently swallowed since it's best-effort and shouldn't interrupt the user.

Because `RoomList` is unmounted and remounted each time you navigate back to it from a chatroom, it always refetches the full room list with fresh unread counts.

---

### Message Pagination with Prefetch

The server side is a single query change in `src/routes/chat.ts`. If a `?before=<id>` query param is present, the SQL adds `AND messages.id < ?` to return only messages older than that ID, still ordered newest-first and limited to 50, then reversed before sending.

On the client, `Chatroom.tsx` maintains three pieces of state beyond the message list:

- `scrollOffset` — how many messages from the bottom are currently hidden
- `hasMore` — flips to false when a fetch returns fewer than 50 results (beginning of history)
- `loadingMore` — prevents duplicate simultaneous fetches

The visible slice is computed on every render:

```ts
const endIdx = messages.length - scrollOffset;
const startIdx = Math.max(0, endIdx - WINDOW_SIZE); // WINDOW_SIZE = 20
const visibleMessages = messages.slice(startIdx, endIdx);
```

The prefetch is triggered inside the `↑` key handler. After bumping `scrollOffset`, the new `startIdx` is calculated — if it falls within 5 of the start of the loaded buffer and `hasMore` is true, `getMessages` is called with `messages[0].id` as the `before` cursor. When the batch arrives it is prepended to the array and `scrollOffset` is increased by the batch size, which keeps `endIdx` unchanged so the visible window doesn't jump.
