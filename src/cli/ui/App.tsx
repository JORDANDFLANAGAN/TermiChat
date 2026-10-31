import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import { Menu } from './Menu.js';
import { LoginPrompt, KickUserPrompt } from './prompts.js';
import { AdminUsers } from './AdminUsers.js';
import { RoomList } from './RoomList.js';
import { Chatroom } from './Chatroom.js';
import { login, register, logout, getMe } from '../commands/auth.js';
import { kickUser } from '../commands/admin.js';
import { Room } from '../commands/chat.js';
import { getToken, deleteToken } from '../token.js';

type Screen = 'main' | 'login' | 'register' | 'admin-users' | 'kick-user' | 'rooms' | 'chat';

export const App = () => {
    const { exit } = useApp();
    const [screen, setScreen] = useState<Screen>('main');
    const [loggedIn, setLoggedIn] = useState(!!getToken());
    const [isAdmin, setIsAdmin] = useState(false);
    const [username, setUsername] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [statusColor, setStatusColor] = useState<'green' | 'red'>('green');
    const [activeRoom, setActiveRoom] = useState<Room | null>(null);

    useEffect(() => {
        if (getToken()) {
            getMe()
                .then(user => {
                    setIsAdmin(user.role === 'admin');
                    setUsername(user.username);
                })
                .catch(() => {
                    deleteToken();
                    setLoggedIn(false);
                });
        }
    }, [loggedIn]);

    const status = (msg: string, color: 'green' | 'red' = 'green') => {
        setStatusMessage(msg);
        setStatusColor(color);
    };

    const handleLogout = async () => {
        try {
            await logout();
            setLoggedIn(false);
            setIsAdmin(false);
            status('Logged out.');
        } catch (err: unknown) {
            status(err instanceof Error ? err.message : 'Logout failed.', 'red');
        }
    };

    const mainMenuItems = loggedIn ? [
        { label: 'Chat Rooms', action: () => setScreen('rooms') },
        ...(isAdmin ? [
            { label: 'View Active Users', action: () => setScreen('admin-users') },
            { label: 'Kick User',         action: () => setScreen('kick-user') },
        ] : []),
        { label: 'Logout', action: handleLogout },
        { label: 'Exit',   action: exit },
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
                minPasswordLength={8}
                onComplete={(success) => {
                    if (success) status('Account created. You can now log in.');
                    setScreen('main');
                }}
            />
        );
    }

    if (screen === 'rooms') {
        return (
            <RoomList
                onEnterRoom={(room) => { setActiveRoom(room); setScreen('chat'); }}
                onBack={() => setScreen('main')}
                isAdmin={isAdmin}
            />
        );
    }

    if (screen === 'chat' && activeRoom) {
        return <Chatroom room={activeRoom} onBack={() => setScreen('rooms')} />;
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
            <Menu title={username ? `TermiChat  (${username})` : 'TermiChat'} items={mainMenuItems} />
        </Box>
    );
};
