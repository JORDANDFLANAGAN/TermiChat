import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Message, Room, getMessages, sendMessage, streamMessages } from '../commands/chat.js';

interface ChatroomProps {
    room: Room;
    onBack: () => void;
}

export const Chatroom = ({ room, onBack }: ChatroomProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    // One-time fetch to populate message history when entering the room.
    useEffect(() => {
        getMessages(room.id)
            .then(setMessages)
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    // Opens the SSE stream for this room. Any message broadcast by the server
    // (including ones we send ourselves) gets appended to the list in real time.
    // The returned cleanup function closes the connection when we leave the room.
    useEffect(() => {
        const stop = streamMessages(room.id, (msg) => {
            setMessages(prev => [...prev, msg]);
        });
        return stop;
    }, []);

    useInput((_, key) => {
        if (key.escape) onBack();
    });

    const handleSend = async (value: string) => {
        if (!value.trim()) return;
        setInput('');
        try {
            await sendMessage(room.id, value.trim());
        } catch (err: any) {
            setError(err.message ?? 'Failed to send.');
        }
    };

    if (loading) return <Text>Loading messages...</Text>;

    return (
        <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
            <Text bold color="cyan">#{room.name}</Text>
            <Text> </Text>
            <Box flexDirection="column">
                {messages.length === 0 ? (
                    <Text dimColor>No messages yet. Say something!</Text>
                ) : (
                    messages.map(msg => (
                        <Text key={msg.id}>
                            <Text dimColor>{msg.created_at.slice(11, 16)} </Text>
                            <Text bold color="cyan">{msg.username}: </Text>
                            <Text>{msg.message_content}</Text>
                        </Text>
                    ))
                )}
            </Box>
            <Text> </Text>
            {error && <Text color="red">{error}</Text>}
            <Box>
                <Text color="cyan">› </Text>
                <TextInput value={input} onChange={setInput} onSubmit={handleSend} />
            </Box>
            <Text dimColor>esc to leave room</Text>
        </Box>
    );
};
