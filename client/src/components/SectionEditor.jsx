import React, { useState } from 'react';
import { Plus, Sparkles, Tag, TriangleAlert, Type, X } from 'lucide-react';

function EditableList({ items, onChange, placeholder, testIdPrefix }) {
    const handleChange = (index, value) => {
        const next = items.map((item, itemIndex) => (itemIndex === index ? value : item));
        onChange(next);
    };

    const handleRemove = (index) => {
        onChange(items.filter((_, itemIndex) => itemIndex !== index));
    };

    const handleAdd = () => {
        onChange([...items, '']);
    };

    return (
        <div className="flex flex-col gap-3">
            {items.map((item, index) => (
                <div key={`${testIdPrefix}-${index}`} className="guide-sheet rounded-[1.2rem] p-3">
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={item}
                            onChange={(event) => handleChange(index, event.target.value)}
                            className="min-h-[44px] flex-1 rounded-[1rem] border border-white/10 bg-black/10 px-3 py-2 text-sm text-claude-text focus:outline-none focus:ring-1 focus:ring-claude-accent"
                        />
                        <button
                            type="button"
                            data-testid={`remove-${testIdPrefix}`}
                            onClick={() => handleRemove(index)}
                            className="guide-cta guide-cta--ghost guide-focus-ring shrink-0 px-3"
                            aria-label="Remove"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ))}
            <button
                type="button"
                onClick={handleAdd}
                className="guide-cta guide-cta--ghost guide-focus-ring w-full sm:w-auto"
            >
                <Plus className="h-4 w-4" />
                <span>{`Add ${placeholder}`}</span>
            </button>
        </div>
    );
}

function FieldShell({ icon: Icon, label, children }) {
    return (
        <section className="guide-shell rounded-[1.5rem] p-4 sm:p-5">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-claude-accent">
                    <Icon className="h-4 w-4" />
                </div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                    {label}
                </p>
            </div>
            <div className="mt-4">{children}</div>
        </section>
    );
}

export default function SectionEditor({ section, onSave, onCancel }) {
    const [title, setTitle] = useState(section.title ?? '');
    const [recallPrompt, setRecallPrompt] = useState(section.recall_prompt ?? '');
    const [answerPoints, setAnswerPoints] = useState(section.answer_points ?? []);
    const [commonTraps, setCommonTraps] = useState(section.common_traps ?? []);
    const [keyTerms, setKeyTerms] = useState(section.key_terms ?? []);

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
        <div data-testid="section-editor" className="flex flex-col gap-4">
            <div className="guide-hero rounded-[1.7rem] p-5">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-accent">
                    Section editor
                </p>
                <h2 className="mt-3 font-display text-[1.75rem] font-bold italic leading-none text-claude-text">
                    Tune the guide by hand
                </h2>
                <p className="mt-3 text-sm leading-6 text-claude-secondary">
                    Tighten weak prompts, fix fuzzy answers, and make the study flow feel exam-ready.
                </p>
            </div>

            <FieldShell icon={Type} label="Section title">
                <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="min-h-[48px] w-full rounded-[1.2rem] border border-white/10 bg-black/10 px-4 py-3 text-sm font-medium text-claude-text focus:outline-none focus:ring-1 focus:ring-claude-accent"
                />
            </FieldShell>

            <FieldShell icon={Sparkles} label="Recall prompt">
                <textarea
                    value={recallPrompt}
                    onChange={(event) => setRecallPrompt(event.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-[1.2rem] border border-white/10 bg-black/10 px-4 py-3 text-sm leading-6 text-claude-text focus:outline-none focus:ring-1 focus:ring-claude-accent"
                />
            </FieldShell>

            <FieldShell icon={Plus} label="Answer points">
                <EditableList
                    items={answerPoints}
                    onChange={setAnswerPoints}
                    placeholder="answer point"
                    testIdPrefix="answer-point"
                />
            </FieldShell>

            <FieldShell icon={TriangleAlert} label="Common traps">
                <EditableList
                    items={commonTraps}
                    onChange={setCommonTraps}
                    placeholder="common trap"
                    testIdPrefix="common-trap"
                />
            </FieldShell>

            <FieldShell icon={Tag} label="Key terms">
                <EditableList
                    items={keyTerms}
                    onChange={setKeyTerms}
                    placeholder="key term"
                    testIdPrefix="key-term"
                />
            </FieldShell>

            <div className="grid gap-3 sm:grid-cols-2">
                <button
                    type="button"
                    data-testid="section-editor-save"
                    onClick={handleSave}
                    className="guide-cta guide-cta--primary guide-focus-ring w-full"
                >
                    <Sparkles className="h-4 w-4" />
                    <span>Save Changes</span>
                </button>
                <button
                    type="button"
                    data-testid="section-editor-cancel"
                    onClick={onCancel}
                    className="guide-cta guide-cta--secondary guide-focus-ring w-full"
                >
                    <X className="h-4 w-4" />
                    <span>Cancel</span>
                </button>
            </div>
        </div>
    );
}
