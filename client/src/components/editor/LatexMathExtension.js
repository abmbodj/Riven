import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { findMathSpans, renderKatexHtml } from '../../utils/richTextMath';

export const latexMathPluginKey = new PluginKey('latexMath');

const hasCodeMark = (node) => node.marks?.some((mark) => mark.type.name === 'code');

const createMathWidget = (tex, displayMode) => {
  const element = document.createElement(displayMode ? 'div' : 'span');
  element.className = displayMode ? 'riven-math-block' : 'riven-math-inline';
  element.setAttribute('contenteditable', 'false');
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = renderKatexHtml(tex, displayMode);
  return element;
};

export const buildLatexMathDecorations = (doc) => {
  const decorations = [];

  doc.descendants((node, pos) => {
    if (!node.isText || hasCodeMark(node)) return;

    const spans = findMathSpans(node.text);
    for (const span of spans) {
      const from = pos + span.start;
      const to = pos + span.end;
      const widgetKey = `math:${from}:${to}:${span.displayMode ? 'block' : 'inline'}`;

      decorations.push(
        Decoration.inline(from, to, { class: 'riven-math-source' }),
        Decoration.widget(
          from,
          () => createMathWidget(span.tex, span.displayMode),
          {
            side: -1,
            key: widgetKey,
            ...(span.displayMode ? { stopEvent: () => true } : {}),
          },
        ),
      );
    }
  });

  return decorations.length > 0
    ? DecorationSet.create(doc, decorations)
    : DecorationSet.empty;
};

export const LatexMath = Extension.create({
  name: 'latexMath',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: latexMathPluginKey,
        props: {
          decorations(state) {
            return buildLatexMathDecorations(state.doc);
          },
        },
      }),
    ];
  },
});
