import React, { useState } from 'react';
import { X } from 'lucide-react';

function EditableList({ items, onChange, placeholder, testIdPrefix }) {
    const handleChange = (index, value) => {
        const next = items.map((item, i) => (i === index ? value : item));
        onChange(next);
    };

    const handleRemove = (index) => {
        onChange(items.filter((_, i) => i !== index));
    };

    const handleAdd = () => {
        onChange([...items, '']);
    };

    return (
        <div className="flex flex-col gap-1.5">
            {items.map((item, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={index} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={item}
                        onChange={(e) => handleChange(index, e.target.value)}
                        className="flex-1 rounded-lg border border-claude-border bg-claude-surface px-3 py-2 text-sm text-claude-text focus:outline-none focus:ring-1 focus:ring-claude-accent"
                    />
                    <button
                        type="button"
                        data-testid={`remove-${testIdPrefix}`}
                        onClick={() => handleRemove(index)}
                        className="text-claude-secondary hover:text-red-500 transition-colors"
                        aria-label="Remove"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={handleAdd}
                className="text-left text-xs text-claude-accent hover:underline"
            >
                + Add {placeholder}
            </button>
        </div>
    );
}

export default function SectionEditor({ section, onSave, onCancel }) {
    const [title, setTitle] = useState(section.title);
    const [recallPrompt, setRecallPrompt] = useState(section.recall_prompt);
    const [answerPoints, setAnswerPoints] = useState(section.answer_points);
    const [commonTraps, setCommonTraps] = useState(section.common_traps);
    const [keyTerms, setKeyTerms] = useState(section.key_terms);

    const handleSave = () => {
        onSave({
            title,
            recall_prompt: recallPrompt,
            answer_points: answerPoints.filter(Boolean),
            common_traps: commonTraps.filter(Boolean),
            key_terms: keyTerms.filter(Boolean),
        });
    };

    return (
        <div className="flex flex-col gap-5">
            <div>
                <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                    Section Title
                </p>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-claude-border bg-claude-surface px-3 py-2.5 text-sm font-semibold text-claude-text focus:outline-none focus:ring-1 focus:ring-claude-accent"
                />
            </div>

            <div>
                <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                    Recall Prompt
                </p>
                <textarea
                    value={recallPrompt}
                    onChange={(e) => setRecallPrompt(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-claude-border bg-claude-surface px-3 py-2.5 text-sm text-claude-text focus:outline-none focus:ring-1 focus:ring-claude-accent"
                />
            </div>

            <div>
                <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                    Answer Points
                </p>
                <EditableList
                    items={answerPoints}
                    onChange={setAnswerPoints}
                    placeholder="answer point"
                    testIdPrefix="answer-point"
                />
            </div>

            <div>
                <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                    Common Traps
                </p>
                <EditableList
                    items={commonTraps}
                    onChange={setCommonTraps}
                    placeholder="common trap"
                    testIdPrefix="common-trap"
                />
            </div>

            <div>
                <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                    Key Terms
                </p>
                <EditableList
                    items={keyTerms}
                    onChange={setKeyTerms}
                    placeholder="key term"
                    testIdPrefix="key-term"
                />
            </div>

            <div className="flex gap-3">
                <button
                    type="button"
                    data-testid="section-editor-save"
                    onClick={handleSave}
                    className="flex-1 rounded-2xl bg-claude-accent px-4 py-3 text-sm font-bold text-white transition-opacity active:opacity-80"
                >
                    Save Changes
                </button>
                <button
                    type="button"
                    data-testid="section-editor-cancel"
                    onClick={onCancel}
                    className="rounded-2xl border border-claude-border bg-claude-surface px-4 py-3 text-sm text-claude-secondary"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
