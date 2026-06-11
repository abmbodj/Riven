/* eslint-disable react-hooks/refs --
 * This component intentionally reads/writes prevLengthRef during render to remember the
 * previous section count so only newly-added sections play the entry animation. */
import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import TiptapEditor from '../editor/TiptapEditor';

// Impeccable animation constants — ease-out only, no bounce
const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.1, 0.25, 1],
      // Cap stagger at 6 sections so late sections don't wait 800ms+
      delay: Math.min(i, 6) * 0.06,
    },
  }),
  exit: { opacity: 0, y: 12, transition: { duration: 0.2 } },
};

/**
 * SectionedPreview
 *
 * Shows lecture note sections as they complete, animating each one in.
 *
 * Props:
 *   sections      — array of Tiptap doc objects (grows as sections complete)
 *   sectionsTotal — total number of sections expected (0 = unknown)
 *   statusText    — current phase label from the job
 */
export default function SectionedPreview({ sections = [], sectionsTotal = 0, statusText = '' }) {
  const prevLengthRef = useRef(0);

  // Track which sections are newly added so only new ones animate. Reading/writing this
  // ref during render is an intentional "previous value" idiom for the entry animation
  // (see the file-level eslint-disable for react-hooks/refs at the top of this file).
  const newFromIndex = prevLengthRef.current;
  prevLengthRef.current = sections.length;

  const progressLabel = sectionsTotal > 0
    ? `${sections.length} of ${sectionsTotal} sections complete`
    : `${sections.length} section${sections.length !== 1 ? 's' : ''} complete`;

  return (
    <div className="rounded-2xl border border-claude-accent/20 bg-claude-surface/60 overflow-hidden mb-5">
      {/* Header */}
      <div className="px-4 py-3 border-b border-claude-border/20 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-accent">
            Enhancement Preview
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-claude-secondary mt-1">
            {progressLabel}
          </p>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-widest text-claude-secondary shrink-0">
          {statusText}
        </span>
      </div>

      {/* Sections */}
      <div className="px-4 py-4 space-y-0">
        <AnimatePresence initial={false}>
          {sections.map((section, index) => (
            <motion.div
              key={index}
              custom={index - newFromIndex}
              variants={SECTION_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <TiptapEditor content={section} editable={false} placeholder="" />
              {index < sections.length - 1 && (
                <div className="my-4 border-t border-claude-border/20" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {sections.length === 0 && (
          <p className="font-mono text-[11px] text-claude-secondary py-2">
            Generating first section…
          </p>
        )}
      </div>
    </div>
  );
}
