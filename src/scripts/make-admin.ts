import db from '../db.js';

const username = process.argv[2];

if (!username) {
    console.error('Usage: npm run make-admin <username>');
    process.exit(1);
}

const user = db.prepare('SELECT id, role FROM users WHERE username = ?').get(username) as
    | { id: number; role: string }
    | undefined;

if (!user) {
    console.error(`User "${username}" not found.`);
    process.exit(1);
}

if (user.role === 'admin') {
    console.log(`${username} is already an admin.`);
    process.exit(0);
}

db.prepare('UPDATE users SET role = ? WHERE username = ?').run('admin', username);
console.log(`${username} is now an admin.`);
