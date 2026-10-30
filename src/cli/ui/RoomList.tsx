import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getRooms, joinRoom, createRoom, Room } from '../commands/chat.js';

type Tab = 'all' | 'my';

interface RoomListProps {
    onEnterRoom: (room: Room) => void;
    onBack: () => void;
}

export const RoomList = ({ onEnterRoom, onBack }: RoomListProps) => {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [tab, setTab] = useState<Tab>('all');
    const [selected, setSelected] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');

    useEffect(() => {
        getRooms()
            .then(setRooms)
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    // Rooms shown in the active tab
    const visible = tab === 'my' ? rooms.filter(r => r.is_member) : rooms;

    useInput(async (input, key) => {
        if (creating) return;
        if (key.upArrow) setSelected(i => Math.max(0, i - 1));
        if (key.downArrow) setSelected(i => Math.min(visible.length - 1, i + 1));
        if (key.escape) onBack();
        if (input === 'n') setCreating(true);
        // Left/right arrows switch tabs and reset the cursor to the top
        if (key.leftArrow || key.rightArrow) {
            setTab(t => t === 'all' ? 'my' : 'all');
            setSelected(0);
        }
        if (key.return && visible[selected]) {
            try {
                await joinRoom(visible[selected].id);
            } catch { }
            onEnterRoom(visible[selected]);
        }
    });

    const handleCreateRoom = async (name: string) => {
        if (!name.trim()) { setCreating(false); return; }
        try {
            await createRoom(name.trim());
            const updated = await getRooms();
            setRooms(updated);
            setSelected(updated.length - 1);
        } catch (err: any) {
            setError(err.message ?? 'Failed to create room.');
        }
        setNewRoomName('');
        setCreating(false);
    };

    if (loading) return <Text>Loading rooms...</Text>;

    return (
        <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
            {/* Tab headers */}
            <Box gap={2}>
                <Text bold={tab === 'all'} color={tab === 'all' ? 'cyan' : undefined}>All</Text>
                <Text bold={tab === 'my'} color={tab === 'my' ? 'cyan' : undefined}>My Rooms</Text>
            </Box>
            <Text> </Text>
            {error && <Text color="red">{error}</Text>}
            {visible.length === 0 && !creating ? (
                <Text dimColor>{tab === 'my' ? "You haven't joined any rooms yet." : 'No rooms yet. Press n to create one.'}</Text>
            ) : (
                visible.map((room, i) => (
                    <Text key={room.id} color={i === selected ? 'cyan' : 'white'}>
                        {i === selected ? '› ' : '  '}{room.name}
                    </Text>
                ))
            )}
            {creating && (
                <Box>
                    <Text color="cyan">New room name: </Text>
                    <TextInput value={newRoomName} onChange={setNewRoomName} onSubmit={handleCreateRoom} />
                </Box>
            )}
            <Text> </Text>
            <Text dimColor>↑↓ navigate   ←→ switch tab   enter open   n new room   esc back</Text>
        </Box>
    );
};
