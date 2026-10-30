import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getRooms, joinRoom, createRoom, Room } from '../commands/chat.js';

interface RoomListProps {
    onEnterRoom: (room: Room) => void;
    onBack: () => void;
}

export const RoomList = ({ onEnterRoom, onBack }: RoomListProps) => {
    const [rooms, setRooms] = useState<Room[]>([]);
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

    useInput(async (input, key) => {
        if (creating) return;
        if (key.upArrow) setSelected(i => Math.max(0, i - 1));
        if (key.downArrow) setSelected(i => Math.min(rooms.length - 1, i + 1));
        if (key.escape) onBack();
        if (input === 'n') setCreating(true);
        if (key.return && rooms[selected]) {
            try {
                await joinRoom(rooms[selected].id);
            } catch { }
            onEnterRoom(rooms[selected]);
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
            <Text bold color="cyan">Rooms</Text>
            <Text> </Text>
            {error && <Text color="red">{error}</Text>}
            {rooms.length === 0 && !creating ? (
                <Text dimColor>No rooms yet. Press n to create one.</Text>
            ) : (
                rooms.map((room, i) => (
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
            <Text dimColor>↑↓ navigate   enter open   n new room   esc back</Text>
        </Box>
    );
};
