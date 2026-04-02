import React, { useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import useHaptics from '../../hooks/useHaptics';

export default function SettingsPillTabs({ sections, activeSection, onSectionChange }) {
    const haptics = useHaptics();
    const scrollRef = useRef(null);
    const pillRefs = useRef({});

    // Auto-scroll active pill into view
    useEffect(() => {
        const activePill = pillRefs.current[activeSection];
        if (activePill && scrollRef.current) {
            activePill.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
        }
    }, [activeSection]);

    const handleKeyDown = useCallback((e) => {
        const currentIndex = sections.findIndex(s => s.id === activeSection);
        let nextIndex = currentIndex;

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            nextIndex = (currentIndex + 1) % sections.length;
        } else if (e.key === 'ArrowLeft') {
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
        pillRefs.current[sections[nextIndex].id]?.focus();
    }, [activeSection, sections, onSectionChange]);

    return (
        <div
            ref={scrollRef}
            role="tablist"
            aria-label="Settings sections"
            className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar px-1 py-2"
            onKeyDown={handleKeyDown}
        >
            {sections.map((section) => {
                const Icon = section.icon;
                const isActive = section.id === activeSection;

                return (
                    <button
                        key={section.id}
                        ref={el => { pillRefs.current[section.id] = el; }}
                        role="tab"
                        id={`${section.id}-tab`}
                        aria-selected={isActive}
                        aria-controls={`${section.id}-panel`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => {
                            haptics.light();
                            onSectionChange(section.id);
                        }}
                        className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.14em] whitespace-nowrap transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 tap-action active:scale-[0.97] ${
                            isActive
                                ? 'text-botanical-ink'
                                : 'text-claude-secondary hover:text-claude-text'
                        }`}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="settings-pill"
                                className="absolute inset-0 rounded-full bg-claude-accent shadow-botanical-glow"
                                style={{ zIndex: -1 }}
                                initial={false}
                                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                            />
                        )}
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{section.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
