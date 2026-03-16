import React, { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import {
    Heading1, Heading2, Heading3, List, ListOrdered, Quote, Minus, Type
} from 'lucide-react';

const COMMANDS = [
    { title: 'Text', subtitle: 'paragraph', icon: Type, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run() },
    { title: 'Heading 1', subtitle: 'h1', icon: Heading1, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run() },
    { title: 'Heading 2', subtitle: 'h2', icon: Heading2, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run() },
    { title: 'Heading 3', subtitle: 'h3', icon: Heading3, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run() },
    { title: 'Bullet List', subtitle: 'list', icon: List, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
    { title: 'Numbered List', subtitle: 'ordered', icon: ListOrdered, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
    { title: 'Quote', subtitle: 'blockquote', icon: Quote, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
    { title: 'Divider', subtitle: 'hr', icon: Minus, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
];

const SlashCommandMenu = forwardRef((props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const filteredCommands = COMMANDS.filter(item =>
        item.title.toLowerCase().includes((props.query || '').toLowerCase())
    );

    const selectItem = useCallback((index) => {
        const item = filteredCommands[index];
        if (item) {
            props.command(item);
        }
    }, [filteredCommands, props]);

    const upHandler = useCallback(() => {
        setSelectedIndex((prev) => (prev + filteredCommands.length - 1) % filteredCommands.length);
    }, [filteredCommands.length]);

    const downHandler = useCallback(() => {
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    }, [filteredCommands.length]);

    const enterHandler = useCallback(() => {
        selectItem(selectedIndex);
    }, [selectItem, selectedIndex]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [props.query]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }) => {
            if (event.key === 'ArrowUp') {
                upHandler();
                return true;
            }
            if (event.key === 'ArrowDown') {
                downHandler();
                return true;
            }
            if (event.key === 'Enter') {
                enterHandler();
                return true;
            }
            return false;
        },
    }));

    if (filteredCommands.length === 0) return null;

    return (
        <div className="slash-command-menu">
            {filteredCommands.map((item, index) => {
                const Icon = item.icon;
                return (
                    <button
                        key={item.title}
                        className={`slash-command-item ${index === selectedIndex ? 'is-selected' : ''}`}
                        onClick={() => selectItem(index)}
                        type="button"
                    >
                        <div className="slash-command-item-icon">
                            <Icon size={16} />
                        </div>
                        <div>
                            <div className="slash-command-item-title">{item.title}</div>
                            <div className="slash-command-item-subtitle">{item.subtitle}</div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
});

SlashCommandMenu.displayName = 'SlashCommandMenu';

export default SlashCommandMenu;
export { COMMANDS };
