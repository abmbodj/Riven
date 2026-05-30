import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Mail, ScrollText } from 'lucide-react';
import { subscribeMediaQueryList } from '../../utils/matchMediaSubscribe';

const REDUCED_MOTION_MQ = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(cb) {
    if (typeof window === 'undefined') return () => {};
    const mq = window.matchMedia(REDUCED_MOTION_MQ);
    return subscribeMediaQueryList(mq, cb);
}

function getReducedMotionSnapshot() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(REDUCED_MOTION_MQ).matches;
}

function LegalSectionContent({ blocks }) {
    return blocks.map((block, index) => {
        if (block.type === 'paragraph') {
            return (
                <p key={`paragraph-${index}`} className="text-sm leading-7 text-claude-secondary sm:text-[15px]">
                    {block.text}
                </p>
            );
        }

        if (block.type === 'list') {
            return (
                <ul
                    key={`list-${index}`}
                    className="space-y-3 pl-5 text-sm leading-7 text-claude-secondary marker:text-claude-accent sm:text-[15px]"
                >
                    {block.items.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            );
        }

        if (block.type === 'subsections') {
            return (
                <div key={`subsections-${index}`} className="space-y-5">
                    {block.items.map((item) => (
                        <div key={item.title} className="rounded-2xl border border-claude-border/60 bg-claude-surface/35 p-4 sm:p-5">
                            <h3 className="text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-accent-gold sm:text-xs">
                                {item.title}
                            </h3>
                            <p className="mt-2 text-sm leading-7 text-claude-secondary sm:text-[15px]">
                                {item.text}
                            </p>
                            {Array.isArray(item.bullets) && item.bullets.length > 0 ? (
                                <ul className="mt-3 space-y-2 pl-5 text-sm leading-7 text-claude-secondary marker:text-claude-accent sm:text-[15px]">
                                    {item.bullets.map((bullet) => (
                                        <li key={bullet}>{bullet}</li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    ))}
                </div>
            );
        }

        return null;
    });
}

export default function LegalDocumentPage({ document, icon: Icon }) {
    const navigate = useNavigate();
    const prefersReducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
    const sectionRefs = useRef({});
    const [activeSection, setActiveSection] = useState(document.sections[0]?.id ?? null);

    const sections = useMemo(() => document.sections, [document.sections]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const hash = window.location.hash.replace(/^#/, '');
        if (!hash) return undefined;

        const target = sectionRefs.current[hash];
        if (!target) return undefined;

        requestAnimationFrame(() => {
            target.scrollIntoView({ behavior: 'auto', block: 'start' });
            setActiveSection(hash);
        });

        return undefined;
    }, [document.sections]);

    useEffect(() => {
        if (typeof window === 'undefined' || !sections.length) return undefined;

        const observer = new window.IntersectionObserver((entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

            const nextId = visible?.target?.id;
            if (nextId) setActiveSection(nextId);
        }, {
            rootMargin: '-22% 0px -58% 0px',
            threshold: [0.2, 0.45, 0.7],
        });

        sections.forEach((section) => {
            const element = sectionRefs.current[section.id];
            if (element) observer.observe(element);
        });

        return () => observer.disconnect();
    }, [sections]);

    const handleSectionSelect = (sectionId) => {
        const target = sectionRefs.current[sectionId];
        if (!target) return;
        setActiveSection(sectionId);
        if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', `#${sectionId}`);
        }
        target.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start',
        });
    };

    return (
        <div className="min-h-dvh bg-claude-bg text-claude-text">
            <div className="sticky top-0 z-50 border-b border-botanical-sepia/10 bg-claude-bg/90 backdrop-blur-xl safe-area-top">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3 py-3.5">
                        <button
                            onClick={() => navigate(-1)}
                            className="tap-action rounded-full border border-botanical-sepia/10 bg-claude-surface/60 p-2.5 transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-95"
                            aria-label={`Go back from ${document.title}`}
                        >
                            <ArrowLeft className="h-5 w-5 text-claude-text" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-claude-secondary">
                                Legal
                            </p>
                            <h1 className="truncate font-display text-lg font-bold sm:text-[1.55rem]">
                                {document.title}
                            </h1>
                            <p className="mt-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary sm:text-[11px]">
                                Last updated: {document.lastUpdated}
                            </p>
                        </div>
                        <div className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-claude-border/70 bg-claude-surface/60 text-accent-gold sm:flex">
                            <Icon className="h-5 w-5" />
                        </div>
                    </div>

                    <nav
                        aria-label={`${document.title} sections`}
                        className="flex gap-2 overflow-x-auto pb-3 hide-scrollbar lg:hidden"
                    >
                        {sections.map((section) => {
                            const isActive = activeSection === section.id;
                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => handleSectionSelect(section.id)}
                                    className={`tap-action shrink-0 rounded-full border px-3 py-2 text-left text-[10px] font-mono font-bold uppercase tracking-[0.15em] transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] ${
                                        isActive
                                            ? 'border-claude-accent/40 bg-claude-accent/14 text-claude-text'
                                            : 'border-claude-border/70 bg-claude-surface/45 text-claude-secondary'
                                    }`}
                                >
                                    {section.title.replace(/^\d+\.\s*/, '')}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-14 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-10 lg:px-8">
                <main className="min-w-0">
                    <section className="relative overflow-hidden rounded-[32px] border border-claude-border/70 bg-[linear-gradient(180deg,rgba(17,32,36,0.94),rgba(13,20,30,0.96))] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:px-7 sm:py-7 lg:px-8">
                        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(222,185,106,0.18), transparent 40%)' }} />
                        <div className="relative">
                            <div className="inline-flex items-center gap-2 rounded-full border border-claude-accent/20 bg-claude-accent/10 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-accent">
                                <ScrollText className="h-3.5 w-3.5" />
                                Current Riven
                            </div>
                            <p className="mt-4 max-w-3xl text-sm leading-7 text-claude-secondary sm:text-[15px]">
                                {document.overview}
                            </p>
                        </div>
                    </section>

                    <div className="mt-6 space-y-5 sm:space-y-6">
                        {sections.map((section) => {
                            const isActive = activeSection === section.id;
                            return (
                                <section
                                    key={section.id}
                                    id={section.id}
                                    ref={(element) => {
                                        sectionRefs.current[section.id] = element;
                                    }}
                                    className={`scroll-mt-40 rounded-[30px] border px-5 py-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] transition-[border-color,box-shadow,background-color] sm:px-6 sm:py-6 lg:scroll-mt-28 ${
                                        isActive
                                            ? 'border-claude-accent/35 bg-claude-surface/85'
                                            : 'border-claude-border/70 bg-claude-surface/65'
                                    }`}
                                >
                                    <div className="mb-4 border-b border-claude-border/50 pb-4">
                                        <h2 className="font-display text-xl font-semibold text-claude-text sm:text-[1.4rem]">
                                            {section.title}
                                        </h2>
                                    </div>
                                    <div className="space-y-4">
                                        <LegalSectionContent blocks={section.blocks} />
                                    </div>
                                </section>
                            );
                        })}
                    </div>

                    <div className="mt-6 rounded-[28px] border border-claude-border/70 bg-claude-surface/75 p-5 sm:p-6">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary">
                            Related document
                        </p>
                        <Link
                            to={document.sibling.href}
                            className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-claude-border/70 bg-claude-bg/30 px-4 py-4 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                        >
                            <div className="min-w-0">
                                <p className="font-medium text-claude-text">{document.sibling.label}</p>
                                <p className="mt-1 text-sm leading-6 text-claude-secondary">
                                    {document.sibling.description}
                                </p>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent-gold">
                                {document.sibling.cta}
                                <ArrowRight className="h-4 w-4" />
                            </span>
                        </Link>
                    </div>
                </main>

                <aside className="hidden lg:block">
                    <div className="sticky top-[6.5rem] space-y-4">
                        <div className="rounded-[28px] border border-claude-border/70 bg-claude-surface/75 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-claude-border/70 bg-claude-bg/35 text-accent-gold">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                        Navigate
                                    </p>
                                    <p className="truncate font-medium text-claude-text">{document.title}</p>
                                </div>
                            </div>

                            <nav aria-label={`${document.title} table of contents`} className="mt-5 space-y-1.5">
                                {sections.map((section) => {
                                    const isActive = activeSection === section.id;
                                    return (
                                        <button
                                            key={section.id}
                                            type="button"
                                            onClick={() => handleSectionSelect(section.id)}
                                            className={`w-full rounded-2xl border px-3 py-3 text-left text-sm leading-5 transition-[transform,opacity,color,background-color,border-color,box-shadow] ${
                                                isActive
                                                    ? 'border-claude-accent/35 bg-claude-accent/12 text-claude-text'
                                                    : 'border-transparent bg-transparent text-claude-secondary hover:border-claude-border/70 hover:bg-claude-bg/25 hover:text-claude-text'
                                            }`}
                                        >
                                            {section.title}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="rounded-[28px] border border-claude-border/70 bg-claude-surface/75 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                Need help?
                            </p>
                            <p className="mt-3 text-sm leading-6 text-claude-secondary">
                                If anything in this document is unclear, contact the Riven team and we will point you in the right direction.
                            </p>
                            <a
                                href={`mailto:${document.contactEmail}`}
                                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-claude-accent/25 bg-claude-accent/10 px-4 py-2 text-sm font-medium text-claude-text transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5"
                            >
                                <Mail className="h-4 w-4 text-accent-gold" />
                                {document.contactEmail}
                            </a>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
