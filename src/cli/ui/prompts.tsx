import React, { useState } from 'react';
import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';

interface LoginPromptProps {
    onSubmit: (username: string, password: string) => Promise<void>;
}

export const LoginPrompt = ({ onSubmit }: LoginPromptProps) => {
    const { exit } = useApp();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [step, setStep] = useState<'username' | 'password' | 'done'>('username');
    const [message, setMessage] = useState('');

    const handleUsernameSubmit = (value: string) => {
        setUsername(value);
        setStep('password');
    };

    const handlePasswordSubmit = async (value: string) => {
        try {
            await onSubmit(username, value);
            setMessage('Logged in successfully!');
        } catch (err: any) {
            setMessage(err.message ?? 'Login failed');
        }
        setStep('done');
        exit();
    };

    return (
        <Box flexDirection="column">
            <Text>-- Login --</Text>
            {step === 'username' && (
                <Box>
                    <Text>Username: </Text>
                    <TextInput value={username} onChange={setUsername} onSubmit={handleUsernameSubmit} />
                </Box>
            )}
            {step === 'password' && (
                <Box>
                    <Text>Password: </Text>
                    <TextInput value={password} onChange={setPassword} onSubmit={handlePasswordSubmit} mask="*" />
                </Box>
            )}
            {step === 'done' && <Text>{message}</Text>}
        </Box>
    );
};