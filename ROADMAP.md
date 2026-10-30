# PlugAndPlayDB — Roadmap

## Security (Priority: High)

- [x] **Rate limiting** — add `express-rate-limit` to `/auth/login` and `/auth/register` to prevent brute force attacks
- [x] **Input length validation** — enforce max length on room names, message content, usernames and passwords
- [x] **Password minimum length** — enforce a minimum (e.g. 8 chars) on `/auth/register`
- [x] **Token rotation** — generate a new token on each login rather than reusing the same UUID for the full 24hr window
- [ ] **Admin promotion flow** — CLI/API endpoint to promote a user to admin rather than doing it directly in the DB

## Features (Priority: High)

- [x] **SSE live messages** — wire up the `/chat/rooms/:roomId/stream` endpoint in the Chatroom UI so messages appear in real time without re-entering the room
- [x] **Show current username** — display the logged-in username somewhere persistent in the UI (e.g. App header or chatroom header)
- [x] **My rooms vs all rooms** — differentiate between rooms the user has joined and rooms they haven't yet

## Features (Priority: Medium)

- [ ] **Leave a room** — allow a user to remove themselves from a room's members
- [ ] **Delete a room** — admin-only ability to delete a room and its messages
- [ ] **Message pagination** — currently capped at last 50, consider scroll-based loading for active rooms
- [ ] **Unread message indicator** — show which rooms have messages since you last visited

## Nice to Have

- [ ] **Invite-only rooms** — rooms that require an invite from the creator to join
- [ ] **Direct messaging** — one-to-one messaging between users
- [ ] **Posts/threads board** — Reddit-style threads with comments as an alternative to live chat
- [ ] **Deployment** — host the Express API (Railway/Fly.io), swap SQLite for PostgreSQL, point CLI at remote URL
