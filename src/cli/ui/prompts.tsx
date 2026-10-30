import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface LoginPromptProps {
    title?: string;
    onSubmit: (username: string, password: string) => Promise<void>;
    onComplete: (success: boolean) => void;
}

export const LoginPrompt = ({ title = 'Login', onSubmit, onComplete }: LoginPromptProps) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [step, setStep] = useState<'username' | 'password' | 'done'>('username');
    const [message, setMessage] = useState('');
    const [succeeded, setSucceeded] = useState(false);

    useInput((_, key) => {
        if (step === 'done' && key.return) onComplete(succeeded);
    });

    const handleUsernameSubmit = (value: string) => {
        setUsername(value);
        setStep('password');
    };

    const handlePasswordSubmit = async (value: string) => {
        try {
            await onSubmit(username, value);
            setMessage('Success!');
            setSucceeded(true);
        } catch (err: any) {
            setMessage(err.message ?? 'Failed.');
            setSucceeded(false);
        }
        setStep('done');
    };

    return (
        <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
            <Text bold color="cyan">-- {title} --</Text>
            <Text> </Text>
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
            {step === 'done' && (
                <>
                    <Text color={succeeded ? 'green' : 'red'}>{message}</Text>
                    <Text dimColor>press enter to continue</Text>
                </>
            )}
        </Box>
    );
};

interface KickUserPromptProps {
    onKick: (username: string) => Promise<void>;
    onComplete: (success: boolean) => void;
}

export const KickUserPrompt = ({ onKick, onComplete }: KickUserPromptProps) => {
    const [username, setUsername] = useState('');
    const [message, setMessage] = useState('');
    const [done, setDone] = useState(false);
    const [succeeded, setSucceeded] = useState(false);

    useInput((_, key) => {
        if (done && key.return) onComplete(succeeded);
    });

    const handleSubmit = async (value: string) => {
        try {
            await onKick(value);
            setMessage(`Session expired for ${value}.`);
            setSucceeded(true);
        } catch (err: any) {
            setMessage(err.message ?? 'Failed.');
            setSucceeded(false);
        }
        setDone(true);
    };

    return (
        <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
            <Text bold color="cyan">-- Kick User --</Text>
            <Text> </Text>
            {!done ? (
                <Box>
                    <Text>Username: </Text>
                    <TextInput value={username} onChange={setUsername} onSubmit={handleSubmit} />
                </Box>
            ) : (
                <>
                    <Text color={succeeded ? 'green' : 'red'}>{message}</Text>
                    <Text dimColor>press enter to continue</Text>
                </>
            )}
        </Box>
    );
};
