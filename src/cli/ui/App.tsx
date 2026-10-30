import React, { useState } from 'react';
import { Box, Text, useApp } from 'ink';
import { Menu } from './Menu.js';
import { LoginPrompt, KickUserPrompt } from './prompts.js';
import { AdminUsers } from './AdminUsers.js';
import { login, register, logout } from '../commands/auth.js';
import { kickUser } from '../commands/admin.js';
import { getToken } from '../token.js';

type Screen = 'main' | 'login' | 'register' | 'admin-users' | 'kick-user';

export const App = () => {
    const { exit } = useApp();
    const [screen, setScreen] = useState<Screen>('main');
    const [loggedIn, setLoggedIn] = useState(!!getToken());
    const [statusMessage, setStatusMessage] = useState('');
    const [statusColor, setStatusColor] = useState<'green' | 'red'>('green');

    const status = (msg: string, color: 'green' | 'red' = 'green') => {
        setStatusMessage(msg);
        setStatusColor(color);
    };

    const handleLogout = async () => {
        try {
            await logout();
            setLoggedIn(false);
            status('Logged out.');
        } catch (err: any) {
            status(err.message ?? 'Logout failed.', 'red');
        }
    };

    const mainMenuItems = loggedIn ? [
        { label: 'View Active Users', action: () => setScreen('admin-users') },
        { label: 'Kick User',         action: () => setScreen('kick-user') },
        { label: 'Logout',            action: handleLogout },
        { label: 'Exit',              action: exit },
    ] : [
        { label: 'Login',    action: () => setScreen('login') },
        { label: 'Register', action: () => setScreen('register') },
        { label: 'Exit',     action: exit },
    ];

    if (screen === 'login') {
        return (
            <LoginPrompt
                title="Login"
                onSubmit={login}
                onComplete={(success) => {
                    if (success) { setLoggedIn(true); status('Welcome back!'); }
                    setScreen('main');
                }}
            />
        );
    }

    if (screen === 'register') {
        return (
            <LoginPrompt
                title="Register"
                onSubmit={register}
                onComplete={(success) => {
                    if (success) status('Account created. You can now log in.');
                    setScreen('main');
                }}
            />
        );
    }

    if (screen === 'admin-users') {
        return <AdminUsers onBack={() => setScreen('main')} />;
    }

    if (screen === 'kick-user') {
        return (
            <KickUserPrompt
                onKick={kickUser}
                onComplete={() => setScreen('main')}
            />
        );
    }

    return (
        <Box flexDirection="column">
            {statusMessage && <Text color={statusColor}>{statusMessage}</Text>}
            <Menu title="PlugAndPlayDB" items={mainMenuItems} />
        </Box>
    );
};
