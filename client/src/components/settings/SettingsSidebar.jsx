import React, { useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import useHaptics from '../../hooks/useHaptics';

export default function SettingsSidebar({ sections, activeSection, onSectionChange, expanded, onToggleExpanded }) {
    const haptics = useHaptics();
    const itemRefs = useRef({});

    const handleKeyDown = useCallback((e) => {
        const currentIndex = sections.findIndex(s => s.id === activeSection);
        let nextIndex = currentIndex;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            nextIndex = (currentIndex + 1) % sections.length;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            nextIndex = (currentIndex - 1 + sections.length) % sections.length;
        } else if (e.key === 'Home') {
            e.preventDefault();
            nextIndex = 0;
        } else if (e.key === 'End') {
            e.preventDefault();
            nextIndex = sections.length - 1;
        } else {
            return;
        }

        onSectionChange(sections[nextIndex].id);
        itemRefs.current[sections[nextIndex].id]?.focus();
    }, [activeSection, sections, onSectionChange]);

    return (
        <motion.nav
            aria-label="Settings sections"
            className="sticky top-28 self-start flex flex-col rounded-[1.5rem] border border-claude-border/70 bg-claude-surface/95 shadow-[0_18px_42px_rgba(0,0,0,0.16)] backdrop-blur overflow-hidden"
            animate={{ width: expanded ? 220 : 64 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
            <div
                role="tablist"
                aria-orientation="vertical"
                aria-label="Settings navigation"
                className="flex flex-col py-2"
                onKeyDown={handleKeyDown}
            >
                {sections.map((section) => {
                    const Icon = section.icon;
                    const isActive = section.id === activeSection;

                    return (
                        <button
                            key={section.id}
                            ref={el => { itemRefs.current[section.id] = el; }}
                            role="tab"
                            id={`${section.id}-tab`}
                            aria-selected={isActive}
                            aria-controls={`${section.id}-panel`}
                            tabIndex={isActive ? 0 : -1}
                            title={!expanded ? section.label : undefined}
                            onClick={() => {
                                haptics.light();
                                onSectionChange(section.id);
                            }}
                            className={`group relative flex items-center gap-3 px-4 py-3 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 tap-action ${
                                isActive
                                    ? 'bg-claude-accent/[0.06] text-claude-accent'
                                    : 'text-claude-secondary hover:text-claude-text hover:bg-claude-bg/35'
                            }`}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r-full bg-claude-accent" />
                            )}
                            <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-xl transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 ${
                                isActive
                                    ? 'bg-claude-accent/10 text-claude-accent'
                                    : 'text-claude-secondary/70 group-hover:text-claude-text'
                            }`}>
                                <Icon className="w-4.5 h-4.5" />
                            </div>
                            <motion.span
                                className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] whitespace-nowrap overflow-hidden"
                                animate={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0 }}
                                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            >
                                {section.label}
                            </motion.span>
                        </button>
                    );
                })}
            </div>

            <div className="border-t border-claude-border/50 p-2">
                <button
                    onClick={() => {
                        haptics.light();
                        onToggleExpanded();
                    }}
                    aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
                    className="flex w-full items-center justify-center rounded-xl p-2 text-claude-secondary/60 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:bg-claude-bg/35 hover:text-claude-text tap-action"
                >
                    {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
            </div>
        </motion.nav>
    );
}
