import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Message, Room, StreamStatus, getMessages, sendMessage, streamMessages, leaveRoom, markRoomRead } from '../commands/chat.js';

// How many messages are rendered at once, and how close to the top of the
// loaded buffer we get before silently fetching the next batch of older messages.
const WINDOW_SIZE = 20;
const PREFETCH_THRESHOLD = 5;

interface ChatroomProps {
    room: Room;
    onBack: () => void;
}

export const Chatroom = ({ room, onBack }: ChatroomProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [confirmLeave, setConfirmLeave] = useState(false);

    // scrollOffset = how many messages from the bottom are hidden.
    // 0 = pinned to the newest message. Increases as the user scrolls up.
    const [scrollOffset, setScrollOffset] = useState(0);
    const [streamStatus, setStreamStatus] = useState<StreamStatus>('connected');

    // hasMore = whether there are older messages on the server we haven't loaded yet.
    // Set to false when a fetch returns fewer than 50 results (reached the beginning).
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Tracks whether the SSE stream has connected at least once, so we can
    // distinguish a reconnect (needs gap-fill) from the initial connect.
    const hasConnectedOnce = useRef(false);

    // One-time fetch to populate message history when entering the room.
    // Also marks the room as read immediately (clears the unread badge in the room list)
    // and again on unmount to catch any SSE messages that arrived during the visit.
    useEffect(() => {
        getMessages(room.id)
            .then(msgs => {
                setMessages(msgs);
                if (msgs.length < 50) setHasMore(false);
            })
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false));
        markRoomRead(room.id);
        return () => { markRoomRead(room.id); };
    }, []);

    // SSE stream — appends incoming messages in real time.
    // If the user is scrolled up, bump the offset by 1 so their view stays
    // on the same messages rather than drifting toward the new arrival.
    // On reconnect, fetches the latest batch and deduplicates by ID to fill
    // any gap that occurred while the connection was down.
    useEffect(() => {
        const stop = streamMessages(
            room.id,
            (msg) => {
                setMessages(prev => [...prev, msg]);
                setScrollOffset(prev => prev > 0 ? prev + 1 : 0);
            },
            (status) => {
                setStreamStatus(status);
                if (status === 'connected') {
                    if (hasConnectedOnce.current) {
                        getMessages(room.id).then(latest => {
                            setMessages(prev => {
                                const existingIds = new Set(prev.map(m => m.id));
                                const missed = latest.filter(m => !existingIds.has(m.id));
                                return missed.length > 0 ? [...prev, ...missed] : prev;
                            });
                        }).catch(() => {});
                    }
                    hasConnectedOnce.current = true;
                }
            },
        );
        return stop;
    }, []);

    // Slice the full messages array down to the visible window.
    // endIdx is the exclusive upper bound; startIdx is WINDOW_SIZE behind it.
    const endIdx = messages.length - scrollOffset;
    const startIdx = Math.max(0, endIdx - WINDOW_SIZE);
    const visibleMessages = messages.slice(startIdx, endIdx);

    useInput(async (inputChar, key) => {
        if (confirmLeave) {
            if (key.return) {
                try { await leaveRoom(room.id); } catch {}
                onBack();
            }
            if (key.escape) setConfirmLeave(false);
            return;
        }

        if (key.upArrow) {
            const newOffset = Math.min(scrollOffset + 1, messages.length - 1);
            setScrollOffset(newOffset);

            // After updating the offset, check if the new startIdx is within the
            // prefetch threshold. If so, kick off a background fetch for older messages
            // using the current oldest message's id as the "before" cursor.
            const newStartIdx = Math.max(0, (messages.length - newOffset) - WINDOW_SIZE);
            if (newStartIdx <= PREFETCH_THRESHOLD && hasMore && !loadingMore && messages.length > 0) {
                setLoadingMore(true);
                getMessages(room.id, messages[0].id)
                    .then(batch => {
                        if (batch.length < 50) setHasMore(false);
                        if (batch.length > 0) {
                            // Prepend the older batch. Bump scrollOffset by the batch
                            // size so the visible window doesn't jump.
                            setMessages(prev => [...batch, ...prev]);
                            setScrollOffset(prev => prev + batch.length);
                        }
                    })
                    .catch(() => {})
                    .finally(() => setLoadingMore(false));
            }
            return;
        }

        if (key.downArrow) {
            setScrollOffset(prev => Math.max(prev - 1, 0));
            return;
        }

        if (key.escape) { onBack(); return; }

        // Only trigger leave when the input box is empty to avoid firing while typing.
        if (inputChar === 'l' && !input) setConfirmLeave(true);
    });

    const handleSend = async (value: string) => {
        if (!value.trim()) return;
        setInput('');
        setScrollOffset(0); // snap back to bottom on send
        try {
            await sendMessage(room.id, value.trim());
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to send.');
        }
    };

    if (loading) return <Text>Loading messages...</Text>;

    return (
        <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
            <Box gap={2}>
                <Text bold color="cyan">#{room.name}</Text>
                {streamStatus === 'reconnecting' && <Text color="yellow">reconnecting...</Text>}
            </Box>
            <Text> </Text>
            <Box flexDirection="column">
                {loadingMore && <Text dimColor>Loading older messages...</Text>}
                {!hasMore && startIdx === 0 && <Text dimColor>Beginning of chat history.</Text>}
                {visibleMessages.length === 0 ? (
                    <Text dimColor>No messages yet. Say something!</Text>
                ) : (
                    visibleMessages.map(msg => (
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
            {confirmLeave
                ? <Text color="yellow">Leave this room? Your messages will stay. enter confirm   esc cancel</Text>
                : <Text dimColor>↑↓ scroll   esc back   l leave room</Text>
            }
        </Box>
    );
};
