import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface MenuItem {
    label: string;
    action: () => void | Promise<void>;
}

interface MenuProps {
    title: string;
    items: MenuItem[];
}

export const Menu = ({ title, items }: MenuProps) => {
    const [selected, setSelected] = useState(0);

    useInput((_, key) => {
        if (key.upArrow) setSelected(i => Math.max(0, i - 1));
        if (key.downArrow) setSelected(i => Math.min(items.length - 1, i + 1));
        if (key.return) items[selected]?.action();
    });

    return (
        <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
            <Text bold color="cyan">{title}</Text>
            <Text> </Text>
            {items.map((item, i) => (
                <Text key={item.label} color={i === selected ? 'cyan' : 'white'}>
                    {i === selected ? '› ' : '  '}{item.label}
                </Text>
            ))}
            <Text> </Text>
            <Text dimColor>↑↓ navigate   enter select</Text>
        </Box>
    );
};
