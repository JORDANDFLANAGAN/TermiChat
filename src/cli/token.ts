import fs from 'fs';
import os from 'os';
import path from 'path';

const TOKEN_DIR = path.join(os.homedir(), '.plugandplaydb');
const TOKEN_PATH = path.join(TOKEN_DIR, 'token');

export function saveToken(token: string): void {
    fs.mkdirSync(TOKEN_DIR, { recursive: true });
    fs.writeFileSync(TOKEN_PATH, token, 'utf-8');
}

export function getToken(): string | null {
    try {
        return fs.readFileSync(TOKEN_PATH, 'utf-8');
    } catch {
        return null;
    }
}

export function deleteToken(): void {
    try {
        fs.unlinkSync(TOKEN_PATH);
    } catch(err) {
        console.log("Token doesn't exist");
    }
}