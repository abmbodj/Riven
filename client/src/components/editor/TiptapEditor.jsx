import React, { useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Extension } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import tippy from 'tippy.js';
import SlashCommandMenu, { COMMANDS } from './SlashCommandMenu';
import { LatexMath } from './LatexMathExtension';
import { EMPTY_RICH_TEXT_DOC, extractTextFromDoc, normalizeRichTextDoc } from '../../utils/sharedResources';
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

class TiptapEditorErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidUpdate(prevProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
            this.setState({ hasError: false });
        }
    }

    render() {
        if (this.state.hasError) {
            return <EditorFallback content={this.props.fallbackContent} />;
        }

        return this.props.children;
    }
}

function EditorFallback({ content }) {
    const text = extractTextFromDoc(normalizeRichTextDoc(content)).trim();

    return (
        <div className="riven-editor">
            <div className="whitespace-pre-wrap text-claude-text">
                {text}
            </div>
        </div>
    );
}

function TiptapEditorInner({ content, onUpdate, editable = true, placeholder = 'Start writing, or type / for commands...' }) {
    const normalizedContent = useMemo(() => normalizeRichTextDoc(content), [content]);
    const [fallbackContent, setFallbackContent] = useState(null);

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
        content: normalizedContent,
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
        let cancelled = false;
        if (editor && normalizedContent && !editor.isFocused) {
            const currentJson = JSON.stringify(editor.getJSON());
            const newJson = JSON.stringify(normalizedContent);
            if (currentJson !== newJson) {
                let nextFallback = null;
                try {
                    editor.commands.setContent(normalizedContent, { emitUpdate: false });
                } catch {
                    nextFallback = normalizedContent;
                    try {
                        editor.commands.setContent(EMPTY_RICH_TEXT_DOC, { emitUpdate: false });
                    } catch {
                        // The local fallback below keeps the note page usable.
                    }
                }
                queueMicrotask(() => {
                    if (!cancelled) setFallbackContent(nextFallback);
                });
            }
        }

        return () => {
            cancelled = true;
        };
    }, [normalizedContent, editor]);

    useEffect(() => {
        if (editor) {
            editor.setEditable(editable, false);
        }
    }, [editable, editor]);

    if (fallbackContent) {
        return <EditorFallback content={fallbackContent} />;
    }

    return (
        <div className="riven-editor">
            <EditorContent editor={editor} />
        </div>
    );
}

export default function TiptapEditor(props) {
    const fallbackContent = normalizeRichTextDoc(props.content);
    const resetKey = JSON.stringify(fallbackContent);

    return (
        <TiptapEditorErrorBoundary resetKey={resetKey} fallbackContent={fallbackContent}>
            <TiptapEditorInner {...props} />
        </TiptapEditorErrorBoundary>
    );
}
