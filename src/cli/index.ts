import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { LoginPrompt } from './ui/prompts.js';
import { register, login, logout } from './commands/auth.js';
import { listUsers, kickUser } from './commands/admin.js';

const program = new Command();

program
    .command('register')
    .description('Register a new user')
    .action(() => {
        render(React.createElement(LoginPrompt, { onSubmit: register }));
    });

program
    .command('login')
    .description('Login to your account')
    .action(() => {
        render(React.createElement(LoginPrompt, { onSubmit: login }));
    });

program
    .command('logout')
    .description('Logout of your account')
    .action(async () => {
        await logout();
    });

program
    .command('admin:users')
    .description('List all active users (admin only)')
    .action(async () => {
        await listUsers();
    });

program
    .command('admin:kick <username>')
    .description('Expire a user\'s session (admin only)')
    .action(async (username: string) => {
        await kickUser(username);
    });

program.parse();
