import React, { useEffect } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { Extension } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import tippy from 'tippy.js';
import SlashCommandMenu, { COMMANDS } from './SlashCommandMenu';
import { LatexMath } from './LatexMathExtension';
import 'katex/dist/katex.min.css';
import './editorStyles.css';

const SlashCommandPluginKey = new PluginKey('slashCommand');

const SlashCommand = Extension.create({
    name: 'slashCommand',

    addOptions() {
        return {
            suggestion: {
                char: '/',
                pluginKey: SlashCommandPluginKey,
                command: ({ editor, range, props }) => {
                    props.command({ editor, range });
                },
                items: ({ query }) =>
                    COMMANDS.filter(item =>
                        item.title.toLowerCase().includes(query.toLowerCase())
                    ),
                render: () => {
                    let component;
                    let popup;

                    return {
                        onStart: (props) => {
                            component = new ReactRenderer(SlashCommandMenu, {
                                props,
                                editor: props.editor,
                            });

                            if (!props.clientRect) return;

                            popup = tippy('body', {
                                getReferenceClientRect: props.clientRect,
                                appendTo: () => document.body,
                                content: component.element,
                                showOnCreate: true,
                                interactive: true,
                                trigger: 'manual',
                                placement: 'bottom-start',
                                animation: false,
                            });
                        },
                        onUpdate: (props) => {
                            component?.updateProps(props);
                            if (popup?.[0] && props.clientRect) {
                                popup[0].setProps({
                                    getReferenceClientRect: props.clientRect,
                                });
                            }
                        },
                        onKeyDown: (props) => {
                            if (props.event.key === 'Escape') {
                                popup?.[0]?.hide();
                                return true;
                            }
                            return component?.ref?.onKeyDown(props) ?? false;
                        },
                        onExit: () => {
                            popup?.[0]?.destroy();
                            component?.destroy();
                        },
                    };
                },
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ];
    },
});

export default function TiptapEditor({ content, onUpdate, editable = true, placeholder = 'Start writing, or type / for commands...' }) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                horizontalRule: false,
                heading: { levels: [1, 2, 3] },
            }),
            HorizontalRule,
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            Placeholder.configure({ placeholder }),
            LatexMath,
            ...(editable ? [SlashCommand] : []),
        ],
        content: content || undefined,
        editable,
        editorProps: {
            attributes: {
                class: 'focus:outline-none',
            },
        },
        onUpdate: ({ editor: e }) => {
            onUpdate?.(e.getJSON());
        },
    });

    useEffect(() => {
        if (editor && content && !editor.isFocused) {
            const currentJson = JSON.stringify(editor.getJSON());
            const newJson = JSON.stringify(content);
            if (currentJson !== newJson) {
                editor.commands.setContent(content, { emitUpdate: false });
            }
        }
    }, [content, editor]);

    useEffect(() => {
        if (editor) {
            editor.setEditable(editable, false);
        }
    }, [editable, editor]);

    return (
        <div className="riven-editor">
            <EditorContent editor={editor} />
        </div>
    );
}
