import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { listUsers } from '../commands/admin.js';

interface ActiveUser {
    username: string;
    expires_at: string;
}

interface AdminUsersProps {
    onBack: () => void;
}

export const AdminUsers = ({ onBack }: AdminUsersProps) => {
    const [users, setUsers] = useState<ActiveUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        listUsers()
            .then(setUsers)
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useInput((_, key) => {
        if (!loading && (key.escape || key.return)) onBack();
    });

    if (loading) return <Text>Loading...</Text>;

    return (
        <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
            <Text bold color="cyan">Active Users</Text>
            <Text> </Text>
            {error ? (
                <Text color="red">{error}</Text>
            ) : users.length === 0 ? (
                <Text dimColor>No active users.</Text>
            ) : (
                users.map(user => (
                    <Text key={user.username}>
                        {'  '}{user.username}{' '}
                        <Text dimColor>(expires: {user.expires_at})</Text>
                    </Text>
                ))
            )}
            <Text> </Text>
            <Text dimColor>press enter or esc to go back</Text>
        </Box>
    );
};
