import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '..', 'data.db'));

// WAL mode makes SQLite much faster for concurrent reads/writes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user');
    `);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id))
    `);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);

db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    creator_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')))
    `);

db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_content TEXT NOT NULL,
    message_creator INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    room_id INTEGER NOT NULL REFERENCES rooms(id))
    `);

db.exec(`
    CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    last_read_id INTEGER NOT NULL DEFAULT 0)
    `);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_unique ON members(room_id, user_id)`);

// Migration: add last_read_id to existing databases that predate this column
try {
    db.exec('ALTER TABLE members ADD COLUMN last_read_id INTEGER NOT NULL DEFAULT 0');
} catch {
    // column already exists
}

export default db;
