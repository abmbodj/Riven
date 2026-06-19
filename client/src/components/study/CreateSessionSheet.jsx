import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue } from 'motion/react';
import { BookOpen, Check, FileText, Leaf, Sparkles, Target, Upload, X, Zap } from 'lucide-react';
import RiverMascot from './RiverMascot.jsx';
import { useToast } from '../../hooks/useToast.js';

// ─── constants ──────────────────────────────────────────────────────────────

const GEN_CAPTIONS = [
  'Planning your session…',
  'Writing your examples…',
  'Adding practice questions…',
  'Almost ready…',
];

const TONES = [
  { value: 'calm review', Icon: Leaf,   label: 'Chill' },
  { value: 'focused',     Icon: Target, label: 'Focused' },
  { value: 'challenge',   Icon: Zap,    label: 'Challenge' },
];

// Lucide icons for cross-platform consistency — emoji render differently on iOS/Android/desktop
const SOURCE_CARDS = [
  { id: 'note', Icon: BookOpen, label: 'From notes'  },
  { id: 'file', Icon: Upload,   label: 'Upload file' },
  { id: 'none', Icon: Sparkles, label: 'Topic only'  },
];

const ACCEPTED_FILES = '.pdf,.docx,.doc,.txt,image/*';
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ─── helpers ─────────────────────────────────────────────────────────────────

function extractTextFromNote(note) {
  if (!note?.content?.content) return '';
  const texts = [];
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.text) texts.push(node.text);
      if (node.content) walk(node.content);
    }
  };
  walk(note.content.content);
  return texts.join('\n');
}

function parseListInput(value) {
  return String(value || '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
}

// ─── sub-components ──────────────────────────────────────────────────────────

function ProgressDots({ step }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {[1, 2].map((n) => (
        <div
          key={n}
          className={`rounded-full transition-all duration-300 ${
            (step === n) || (step === 'generating' && n === 2)
              ? 'w-4 h-2 bg-claude-accent'
              : 'w-2 h-2 bg-claude-border'
          }`}
        />
      ))}
    </div>
  );
}

function Step1({
  genSource, setGenSource,
  selectedNoteIds, setSelectedNoteIds,
  genFile, setGenFile,
  examLabel, setExamLabel,
  noteSearch, setNoteSearch,
  filteredNotes, allNotes,
  fileInputRef, onFileChange,
  hasSource, canContinue,
  onContinue, onClose,
}) {
  const badges = {
    note: selectedNoteIds.length || null,
    file: genFile ? 1 : null,
    none: null,
  };

  return (
    <div className="flex flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between px-5 pt-2 pb-4 sm:px-6">
        <ProgressDots step={1} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-claude-border text-claude-secondary transition-colors hover:border-claude-accent/40 hover:text-claude-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 pb-8 sm:px-6 space-y-5">
        {/* Warm heading — mirrors Step 2's "Tune your session" opening */}
        <div>
          <p className="font-serif italic text-2xl text-claude-text">What are we studying?</p>
          <p className="mt-1 text-sm text-claude-secondary">River will build the whole session around this.</p>
        </div>

        {/* Source cards */}
        <div>
          <p className="mb-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary">
            Source material
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {SOURCE_CARDS.map(({ id, Icon, label }) => {
              const isActive = genSource === id;
              const badge = badges[id];
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setGenSource(id);
                    setSelectedNoteIds([]);
                    setGenFile(null);
                  }}
                  className={[
                    'relative tap-action flex flex-col items-center gap-2.5 rounded-2xl border-2 py-4 px-2 text-center transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/50',
                    isActive
                      ? 'border-claude-accent bg-claude-accent/10 text-claude-accent'
                      : 'border-claude-border bg-claude-surface/30 text-claude-secondary hover:border-claude-accent/40 hover:text-claude-text',
                  ].join(' ')}
                >
                  {badge ? (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-claude-accent px-1 text-[10px] font-bold text-[#162a31]">
                      {badge}
                    </span>
                  ) : null}
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-xs font-mono font-semibold uppercase tracking-[0.08em] leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Expanded pickers */}
        <AnimatePresence mode="wait">
          {genSource === 'note' && (
            <motion.div
              key="note-picker"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-claude-border bg-claude-surface/30 p-3">
                {allNotes.length > 5 && (
                  <input
                    type="search"
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    placeholder="Search notes…"
                    className="mb-3 w-full rounded-xl border border-claude-border bg-claude-bg/40 px-3 py-2 text-sm text-claude-text outline-none placeholder:text-claude-secondary/50 focus:border-claude-accent"
                  />
                )}
                {filteredNotes.length === 0 ? (
                  <p className="py-4 text-center font-serif text-sm italic text-claude-secondary">
                    {allNotes.length === 0 ? 'Add notes to attach them here' : 'No notes match your search'}
                  </p>
                ) : (
                  <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                    {filteredNotes.map((note) => {
                      const sel = selectedNoteIds.includes(note.id);
                      return (
                        <button
                          key={note.id}
                          type="button"
                          onClick={() =>
                            setSelectedNoteIds((prev) =>
                              sel ? prev.filter((id) => id !== note.id) : [...prev, note.id]
                            )
                          }
                          className={[
                            'tap-action inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/50',
                            sel
                              ? 'border-claude-accent bg-claude-accent text-[#162a31] font-semibold'
                              : 'border-claude-border bg-claude-bg/30 text-claude-text hover:border-claude-accent/40',
                          ].join(' ')}
                        >
                          {sel && <Check className="h-3 w-3 shrink-0" />}
                          <span className="max-w-[140px] truncate font-serif italic">{note.title || 'Untitled'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {genSource === 'file' && (
            <motion.div
              key="file-picker"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              className="overflow-hidden"
            >
              {genFile ? (
                <div className="flex items-center gap-3 rounded-2xl border border-claude-border bg-claude-surface/30 p-3">
                  <FileText className="h-4 w-4 shrink-0 text-claude-accent" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-claude-text">{genFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setGenFile(null)}
                    aria-label="Remove file"
                    className="text-claude-secondary transition-colors hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-claude-border p-6 text-center transition-colors hover:border-claude-accent/40">
                  <Upload className="mx-auto mb-2 h-7 w-7 text-claude-secondary" />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-claude-secondary">Tap to upload</p>
                  <p className="mt-1 text-xs text-claude-secondary/60">PDF, DOCX, TXT, Image · max 5 MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILES}
                    onChange={onFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Topic field */}
        <div>
          <label
            htmlFor="css-exam-label"
            className="mb-2 block text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary"
          >
            What&rsquo;s the focus?
            {!hasSource && <span className="ml-1 text-claude-accent">*</span>}
          </label>
          <input
            id="css-exam-label"
            type="text"
            value={examLabel}
            onChange={(e) => setExamLabel(e.target.value)}
            placeholder={hasSource ? 'Optional: narrow the focus' : 'Biology midterm, Chapter 6, Mitosis…'}
            onKeyDown={(e) => { if (e.key === 'Enter' && canContinue) onContinue(); }}
            className="w-full rounded-2xl border-2 border-claude-border bg-claude-bg/40 px-4 py-3.5 font-mono text-sm text-claude-text outline-none placeholder:text-claude-secondary/50 transition-colors focus:border-claude-accent"
          />
        </div>

        {/* Continue */}
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="claude-button-primary w-full gap-2 py-3.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

function Step2({ genTone, setGenTone, weakTopics, setWeakTopics, onBack, onGenerate }) {
  return (
    <div className="flex flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between px-5 pt-2 pb-4 sm:px-6">
        <ProgressDots step={2} />
        <button
          type="button"
          onClick={onBack}
          className="tap-action text-xs font-mono uppercase tracking-widest text-claude-secondary transition-colors hover:text-claude-accent focus-visible:outline-none"
        >
          ← Back
        </button>
      </div>

      <div className="px-5 pb-8 sm:px-6 space-y-5">
        <div>
          <p className="font-serif italic text-2xl text-claude-text">Tune your session</p>
          <p className="mt-1 text-sm text-claude-secondary">Both optional — jump straight to Generate if you&rsquo;re ready.</p>
        </div>

        {/* Tone */}
        <div>
          <p className="mb-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary">Tone</p>
          <div className="flex gap-2.5">
            {TONES.map(({ value, Icon, label }) => {
              const isActive = genTone === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setGenTone(value)}
                  className={[
                    'tap-action flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 py-3.5 px-2 transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/50',
                    isActive
                      ? 'border-claude-accent bg-claude-accent/15 text-claude-accent'
                      : 'border-claude-border bg-claude-surface/30 text-claude-secondary hover:border-claude-accent/40 hover:text-claude-text',
                  ].join(' ')}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-xs font-mono font-semibold uppercase tracking-[0.08em]">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Weak spots */}
        <div>
          <label
            htmlFor="css-weak-topics"
            className="mb-2 block text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary"
          >
            Weak spots{' '}
            <span className="normal-case font-normal tracking-normal text-claude-secondary/60">
              (optional)
            </span>
          </label>
          <textarea
            id="css-weak-topics"
            value={weakTopics}
            onChange={(e) => setWeakTopics(e.target.value)}
            placeholder="Topics you want River to focus on, e.g. Mitosis, meiosis"
            rows={3}
            className="w-full resize-none rounded-2xl border-2 border-claude-border bg-claude-bg/40 px-4 py-3 font-mono text-sm text-claude-text outline-none placeholder:text-claude-secondary/50 transition-colors focus:border-claude-accent"
          />
        </div>

        {/* Generate */}
        <button
          type="button"
          onClick={onGenerate}
          className="claude-button-primary w-full gap-2 py-3.5 text-sm"
        >
          <Sparkles className="h-4 w-4" />
          Generate session
        </button>
      </div>
    </div>
  );
}

function GeneratingState({ captionIndex }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="w-48">
        <RiverMascot state="thinking" />
      </div>

      {/* aria-live so screen readers announce caption changes during generation */}
      <div role="status" aria-live="polite" aria-atomic="true" className="text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={captionIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="font-serif italic text-lg text-claude-text"
          >
            {GEN_CAPTIONS[captionIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="w-full max-w-xs overflow-hidden rounded-full bg-claude-surface/40" style={{ height: 3 }}>
        <motion.div
          className="h-full rounded-full bg-claude-accent"
          initial={{ width: '0%' }}
          animate={{ width: '85%' }}
          transition={{ duration: 25, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function CreateSessionSheet({
  open,
  onClose,
  onGenerate,
  onPricingRequired,
  notes = [],
  defaultTopics = [],
}) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [genSource, setGenSource] = useState('none');
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [genFile, setGenFile] = useState(null);
  const [examLabel, setExamLabel] = useState('');
  const [genTone, setGenTone] = useState('calm review');
  const [weakTopics, setWeakTopics] = useState('');
  const [noteSearch, setNoteSearch] = useState('');
  const [captionIndex, setCaptionIndex] = useState(0);

  const toast = useToast();
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const dragY = useMotionValue(0);
  // Captured on open — drag only active on mobile to avoid text-selection conflicts on desktop
  const isMobileRef = useRef(false);

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    isMobileRef.current = typeof window !== 'undefined' && window.innerWidth < 768;
    setStep(1);
    setDirection(1);
    setGenSource('none');
    setSelectedNoteIds([]);
    setGenFile(null);
    setExamLabel(defaultTopics.length > 0 ? defaultTopics.join(', ') : '');
    setGenTone('calm review');
    setWeakTopics('');
    setNoteSearch('');
    setCaptionIndex(0);
    dragY.set(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Caption rotation during generation
  useEffect(() => {
    if (step !== 'generating') return;
    const id = setInterval(() => setCaptionIndex((i) => (i + 1) % GEN_CAPTIONS.length), 4000);
    return () => clearInterval(id);
  }, [step]);

  // Escape key dismiss
  useEffect(() => {
    if (!open || step === 'generating') return;
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, step, onClose]);

  // Scroll to top when step changes
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [step]);

  const filteredNotes = useMemo(() => {
    if (!noteSearch.trim()) return notes;
    const q = noteSearch.toLowerCase();
    return notes.filter((n) => (n.title || '').toLowerCase().includes(q));
  }, [notes, noteSearch]);

  const hasSource = genSource === 'note'
    ? selectedNoteIds.length > 0
    : genSource === 'file'
    ? Boolean(genFile)
    : false;

  const canContinue = hasSource || examLabel.trim().length > 0;

  const goNext = () => { setDirection(1); setStep(2); };
  const goBack = () => { setDirection(-1); setStep(1); };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { toast.error('File must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setGenFile({ data: reader.result.split(',')[1], mimeType: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const buildParams = () => {
    let noteText = '';
    let file = null;
    let noteId = null;
    let classId = null;

    if (genSource === 'note' && selectedNoteIds.length > 0) {
      const selected = selectedNoteIds.map((id) => notes.find((n) => n.id === id)).filter(Boolean);
      noteText = selected
        .map((n) => `--- ${n.title || 'Untitled'} ---\n${extractTextFromNote(n)}`)
        .join('\n\n');
      noteId = selected.length === 1 ? selected[0].id : null;
      classId = selected[0]?.class_id || null;
    } else if (genSource === 'file' && genFile) {
      file = genFile;
    }

    const label = examLabel.trim();
    const weakArr = parseListInput(weakTopics);
    const hasSourceMaterial = Boolean(noteText.trim() || file);
    const hasSetup = Boolean(label || weakArr.length || genTone);

    const coachConfig = {
      creationMode: hasSourceMaterial && hasSetup ? 'hybrid' : hasSourceMaterial ? 'source' : 'setup',
      ...(label ? { examLabel: label } : {}),
      ...(weakArr.length ? { weakTopics: weakArr } : {}),
      ...(genTone ? { preferredTone: genTone } : {}),
    };

    return {
      noteText: noteText || null,
      file,
      title: label ? `${label} Tutor Session` : 'Tutor Session',
      noteId,
      classId,
      coachConfig,
    };
  };

  const doGenerate = async () => {
    if (!canContinue) { toast.error('Add a topic or attach source material first.'); return; }
    setDirection(1);
    setStep('generating');
    setCaptionIndex(0);
    try {
      await onGenerate(buildParams());
      onClose();
    } catch (err) {
      if (err?.status === 429) {
        onClose();
        onPricingRequired?.();
      } else {
        toast.error(err?.message || 'Failed to generate tutor session');
        setDirection(-1);
        setStep(2);
      }
    }
  };

  const handleDragEnd = (_, info) => {
    if (info.offset.y > 120) onClose();
    else dragY.set(0);
  };

  const stepVariants = {
    enter:  (d) => ({ x: `${d * 100}%`,  opacity: 0 }),
    center:      ({ x: 0,              opacity: 1 }),
    exit:   (d) => ({ x: `${-d * 100}%`, opacity: 0 }),
  };

  const STEP_KEY = { 1: 's1', 2: 's2', generating: 'sgen' };
  const isDraggable = step !== 'generating' && isMobileRef.current;

  return (
    <AnimatePresence>
      {open && (
        <div
          key="create-sheet-root"
          className="fixed inset-0 z-[100] flex items-end justify-center md:items-center md:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={step !== 'generating' ? onClose : undefined}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet / modal panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Create Tutor Session"
            drag={isDraggable ? 'y' : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            dragMomentum={false}
            style={{ y: dragY }}
            onDragEnd={isDraggable ? handleDragEnd : undefined}
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 48 }}
            transition={{ type: 'spring', damping: 32, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            className={[
              'relative z-10 flex w-full flex-col overflow-hidden',
              'max-h-[92dvh] md:max-h-[90dvh] md:max-w-2xl',
              'rounded-t-[1.75rem] md:rounded-[1.75rem]',
              // Mobile: top border only — sheet is edge-to-edge, side borders look wrong on a bottom sheet
              // Desktop: full 4-side border via md:border
              'border-t border-claude-border md:border',
              'bg-claude-bg',
              'shadow-[0_-20px_60px_rgba(0,0,0,0.45)] md:shadow-[0_30px_90px_rgba(0,0,0,0.45)]',
            ].join(' ')}
          >
            {/* Decorative top-right glow */}
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_80%_0%,rgba(222,185,106,0.09),transparent_40%)]" />

            {/* Drag handle — mobile only, hidden during generation */}
            {step !== 'generating' && (
              <div className="md:hidden flex justify-center pt-3 pb-0 shrink-0 touch-none">
                <div className="w-10 h-1 rounded-full bg-claude-border/60" />
              </div>
            )}

            {/* Step slides — overflow clip wrapper */}
            <div className="flex-1 overflow-hidden">
              <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={STEP_KEY[step]}
                    custom={direction}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'spring', damping: 30, stiffness: 260, mass: 0.85 }}
                  >
                    {step === 1 && (
                      <Step1
                        genSource={genSource}
                        setGenSource={setGenSource}
                        selectedNoteIds={selectedNoteIds}
                        setSelectedNoteIds={setSelectedNoteIds}
                        genFile={genFile}
                        setGenFile={setGenFile}
                        examLabel={examLabel}
                        setExamLabel={setExamLabel}
                        noteSearch={noteSearch}
                        setNoteSearch={setNoteSearch}
                        filteredNotes={filteredNotes}
                        allNotes={notes}
                        fileInputRef={fileInputRef}
                        onFileChange={handleFileChange}
                        hasSource={hasSource}
                        canContinue={canContinue}
                        onContinue={goNext}
                        onClose={onClose}
                      />
                    )}
                    {step === 2 && (
                      <Step2
                        genTone={genTone}
                        setGenTone={setGenTone}
                        weakTopics={weakTopics}
                        setWeakTopics={setWeakTopics}
                        onBack={goBack}
                        onGenerate={doGenerate}
                      />
                    )}
                    {step === 'generating' && (
                      <GeneratingState captionIndex={captionIndex} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
