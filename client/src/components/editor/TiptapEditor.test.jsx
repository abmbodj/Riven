import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TiptapEditor from './TiptapEditor.jsx';

const { fakeEditor, useEditorMock } = vi.hoisted(() => ({
  fakeEditor: {
    isFocused: false,
    getJSON: vi.fn(),
    commands: {
      setContent: vi.fn(),
    },
    setEditable: vi.fn(),
  },
  useEditorMock: vi.fn(),
}));

vi.mock('@tiptap/react', () => ({
  useEditor: useEditorMock,
  EditorContent: ({ editor }) => <div data-testid="editor-content" data-editable={String(Boolean(editor))} />,
  ReactRenderer: class {
    constructor() {
      this.element = document.createElement('div');
      this.ref = null;
    }
    updateProps() {}
    destroy() {}
  },
  Extension: {
    create: (config) => config,
  },
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: () => ({ name: 'starter-kit' }),
  },
}));

vi.mock('@tiptap/extension-placeholder', () => ({
  default: {
    configure: () => ({ name: 'placeholder' }),
  },
}));

vi.mock('@tiptap/extension-horizontal-rule', () => ({
  default: { name: 'horizontal-rule' },
}));

vi.mock('@tiptap/suggestion', () => ({
  default: () => ({}),
}));

vi.mock('@tiptap/pm/state', () => ({
  PluginKey: class {
    constructor(name) {
      this.name = name;
    }
  },
}));

vi.mock('tippy.js', () => ({
  default: () => [{
    setProps: vi.fn(),
    hide: vi.fn(),
    destroy: vi.fn(),
  }],
}));

vi.mock('./SlashCommandMenu', () => ({
  default: () => null,
  COMMANDS: [],
}));

const firstDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Original content' }],
    },
  ],
};

const nextDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Imported content' }],
    },
  ],
};

describe('TiptapEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorMock.mockReturnValue(fakeEditor);
    fakeEditor.isFocused = false;
    fakeEditor.getJSON.mockReturnValue(firstDoc);
  });

  it('syncs external content without emitting an update event', () => {
    const onUpdate = vi.fn();
    const view = render(
      <TiptapEditor
        content={firstDoc}
        onUpdate={onUpdate}
      />,
    );

    expect(fakeEditor.commands.setContent).not.toHaveBeenCalled();

    fakeEditor.getJSON.mockReturnValue(firstDoc);
    view.rerender(
      <TiptapEditor
        content={nextDoc}
        onUpdate={onUpdate}
      />,
    );

    expect(fakeEditor.commands.setContent).toHaveBeenCalledWith(nextDoc, { emitUpdate: false });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('updates editability without emitting a synthetic update', () => {
    const view = render(
      <TiptapEditor
        content={firstDoc}
        editable
      />,
    );

    expect(fakeEditor.setEditable).toHaveBeenLastCalledWith(true, false);

    view.rerender(
      <TiptapEditor
        content={firstDoc}
        editable={false}
      />,
    );

    expect(fakeEditor.setEditable).toHaveBeenLastCalledWith(false, false);
  });
});
