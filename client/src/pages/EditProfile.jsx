import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Save,
    User,
    Image as ImageIcon,
    Mail,
    Leaf,
    AtSign,
    Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import Avatar from '../components/Avatar';
import AvatarPicker from '../components/AvatarPicker';
import BannerPicker from '../components/BannerPicker';
import LoadingSpinner from '../components/LoadingSpinner';
import gsap from 'gsap';
import { EASE, DURATION, STAGGER } from '../utils/animations';
import { useGSAP } from '../hooks/useGSAP';
import { usernameSchema, displayNameSchema, bioSchema } from '../schemas/forms';

const MotionDiv = motion.div;

const EMPTY_FIELD_ERRORS = {
    username: '',
    displayName: '',
};

function StatusBadge({ tone = 'default', children }) {
    const toneClasses = tone === 'success'
        ? 'border-claude-accent/30 bg-claude-accent/10 text-claude-text'
        : tone === 'warning'
            ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
            : tone === 'info'
                ? 'border-sky-400/30 bg-sky-400/10 text-sky-100'
                : tone === 'accent'
                    ? 'border-white/15 bg-white/10 text-white'
                    : 'border-white/10 bg-black/20 text-white/75';

    return (
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${toneClasses}`}>
            {children}
        </span>
    );
}

function FieldSurface({ icon: Icon, label, htmlFor, hint, error, counter, children, className = '' }) {
    return (
        <div
            className={`rounded-[1.5rem] border p-4 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 ${
                error
                    ? 'border-red-400/35 bg-red-500/[0.05] shadow-[0_0_0_1px_rgba(248,113,113,0.12)]'
                    : 'border-white/[0.08] bg-claude-bg/55 hover:border-white/[0.12] focus-within:border-claude-accent/35 focus-within:bg-claude-bg/70'
            } ${className}`}
        >
            <div className="flex items-start gap-3">
                <div
                    className={`mt-0.5 rounded-[1rem] border p-3 ${
                        error
                            ? 'border-red-400/20 bg-red-500/10 text-red-200'
                            : 'border-white/[0.08] bg-white/[0.04] text-claude-secondary/80'
                    }`}
                >
                    <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <label
                                htmlFor={htmlFor}
                                className="block text-[10px] font-mono uppercase tracking-[0.2em] text-claude-secondary/70"
                            >
                                {label}
                            </label>
                            {hint ? (
                                <p className="mt-1 text-[11px] font-mono leading-relaxed text-claude-secondary/65">
                                    {hint}
                                </p>
                            ) : null}
                        </div>

                        {counter ? (
                            <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary/55">
                                {counter}
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-4">{children}</div>

                    {error ? (
                        <p role="alert" className="mt-3 text-[11px] font-mono text-red-300">
                            {error}
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function MediaActionButton({ icon: Icon, label, ariaLabel, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
            className="inline-flex min-w-[7.5rem] items-center justify-start gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-white shadow-sm transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:bg-black/30 active:scale-95 sm:min-w-[8rem] sm:text-[11px] md:backdrop-blur-md"
        >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
        </button>
    );
}

const getUsernameError = (value) => {
    const result = usernameSchema.safeParse(value.trim());
    return result.success ? '' : result.error.issues[0]?.message || 'Enter a valid username';
};

const getDisplayNameError = (value) => {
    const result = displayNameSchema.safeParse(value.trim());
    return result.success ? '' : result.error.issues[0]?.message || 'Enter a display name';
};

export default function EditProfile() {
    const { user, updateProfile } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();

    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [avatar, setAvatar] = useState('');
    const [banner, setBanner] = useState('');
    const [saving, setSaving] = useState(false);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [showBannerPicker, setShowBannerPicker] = useState(false);
    const [fieldErrors, setFieldErrors] = useState(EMPTY_FIELD_ERRORS);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const [mobileSaveBarHeight, setMobileSaveBarHeight] = useState(104);

    const containerRef = useRef(null);
    const mobileSaveBarRef = useRef(null);
    const usernameLimit = 30;
    const displayNameLimit = 100;
    const bioLimit = 160;

    useEffect(() => {
        if (!user) return;

        setUsername(user.username || '');
        setDisplayName(user.displayName || user.username || '');
        setBio(user.bio || '');
        setAvatar(user.avatar || '');
        setBanner(user.banner || '');
        setFieldErrors(EMPTY_FIELD_ERRORS);
    }, [user]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);

        syncPreference();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', syncPreference);
            return () => mediaQuery.removeEventListener('change', syncPreference);
        }

        mediaQuery.addListener(syncPreference);
        return () => mediaQuery.removeListener(syncPreference);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const node = mobileSaveBarRef.current;
        if (!node) return undefined;

        const syncHeight = (nextHeight) => {
            if (nextHeight > 0) {
                setMobileSaveBarHeight((currentHeight) => (
                    currentHeight === nextHeight ? currentHeight : nextHeight
                ));
            }
        };

        const measureHeight = () => {
            syncHeight(Math.ceil(node.getBoundingClientRect().height));
        };

        measureHeight();
        window.addEventListener('resize', measureHeight);

        if (typeof ResizeObserver === 'function') {
            const resizeObserver = new ResizeObserver((entries) => {
                const nextHeight = Math.ceil(
                    entries[0]?.contentRect?.height || node.getBoundingClientRect().height
                );
                syncHeight(nextHeight);
            });

            resizeObserver.observe(node);

            return () => {
                resizeObserver.disconnect();
                window.removeEventListener('resize', measureHeight);
            };
        }

        return () => window.removeEventListener('resize', measureHeight);
    }, []);

    useGSAP(() => {
        if (prefersReducedMotion || !containerRef.current) return;

        const items = containerRef.current.querySelectorAll('.gsap-edit-item');
        gsap.from(items, {
            y: 20,
            opacity: 0,
            duration: DURATION.normal,
            stagger: STAGGER.tight,
            ease: EASE.organic,
            clearProps: 'all',
        });
    }, [prefersReducedMotion, user]);

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-claude-bg">
                <LoadingSpinner />
            </div>
        );
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedDisplayName = displayName.trim();
    const trimmedBio = bio.trim();

    const usernameChanged = normalizedUsername !== (user.username || '');
    const displayNameChanged = normalizedDisplayName !== (user.displayName || user.username || '');
    const bioChanged = trimmedBio !== (user.bio || '');
    const avatarChanged = avatar !== (user.avatar || '');
    const bannerChanged = banner !== (user.banner || '');

    const hasChanges = usernameChanged || displayNameChanged || bioChanged || avatarChanged || bannerChanged;

    const usernameValue = normalizedUsername || user.username || 'username';
    const changeCount = [usernameChanged, displayNameChanged, bioChanged, avatarChanged, bannerChanged].filter(Boolean).length;

    const statusTone = saving ? 'saving' : hasChanges ? 'pending' : 'saved';
    const mobileBottomClearance = `calc(env(safe-area-inset-bottom, 0px) + ${mobileSaveBarHeight + 16}px)`;
    const mobileSaveBarInset = 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)';
    const statusMeta = statusTone === 'saving'
        ? {
            badgeTone: 'info',
            badgeLabel: 'Saving',
            title: 'Publishing your profile',
            detail: 'Your latest edits are being written now.',
        }
        : statusTone === 'pending'
            ? {
                badgeTone: 'warning',
                badgeLabel: `${changeCount} draft ${changeCount === 1 ? 'change' : 'changes'}`,
                title: `${changeCount} update${changeCount === 1 ? '' : 's'} ready to publish`,
                detail: 'Save when the public card looks right.',
            }
            : {
                badgeTone: 'success',
                badgeLabel: 'Live now',
                title: 'Profile is up to date',
                detail: 'Everything shown here matches what other people see.',
            };

    const canSave = hasChanges && !saving;

    const validateAndCollectErrors = () => {
        const nextErrors = {
            username: getUsernameError(normalizedUsername),
            displayName: getDisplayNameError(normalizedDisplayName),
        };

        setFieldErrors(nextErrors);
        return nextErrors;
    };

    const clearFieldError = (field) => {
        setFieldErrors((prev) => (
            prev[field]
                ? { ...prev, [field]: '' }
                : prev
        ));
    };

    const handleSave = async () => {
        const nextErrors = validateAndCollectErrors();
        const firstError = nextErrors.username || nextErrors.displayName;

        if (firstError) {
            haptics.error();
            toast.error(firstError);
            return;
        }

        if (!canSave) return;

        const bioResult = trimmedBio.length === 0
            ? { success: true, data: '' }
            : bioSchema.safeParse(trimmedBio);

        if (!bioResult.success) {
            haptics.error();
            toast.error(bioResult.error.issues[0]?.message || 'Enter a shorter bio');
            return;
        }

        setSaving(true);
        haptics.medium();

        try {
            await updateProfile({
                username: normalizedUsername,
                displayName: normalizedDisplayName,
                bio: bioResult.data,
                avatar,
                banner,
            });
            toast.success('Profile updated');
            haptics.success();
        } catch (err) {
            haptics.error();
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="min-h-screen bg-claude-bg pb-[var(--edit-profile-mobile-bottom-space)] font-sans text-claude-text lg:pb-24"
            style={{ '--edit-profile-mobile-bottom-space': mobileBottomClearance }}
        >
            <div className="mx-auto max-w-6xl px-3 pt-3 sm:px-4 sm:pt-4 lg:px-8 lg:pt-8">
                <section className="relative mx-auto max-w-6xl">
                    <div className="rounded-[2.4rem] bg-white/[0.02] p-1 shadow-[0_28px_90px_-36px_rgba(0,0,0,0.82)] sm:rounded-[3rem] sm:p-1.5 lg:bg-transparent lg:p-2 glass-shell">
                        <div className="relative h-[21rem] overflow-hidden rounded-[2.15rem] border border-white/15 shadow-sm sm:h-[21rem] sm:rounded-[2.65rem] md:shadow-lg lg:h-[24rem]">
                            {banner ? (
                                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${banner})` }}>
                                    <div className="absolute inset-0 bg-claude-bg/55" />
                                </div>
                            ) : (
                                <>
                                    <div className="absolute inset-0 bg-[#0f2026]" />
                                    <MotionDiv
                                        initial={{ opacity: 0.6, scale: 0.95 }}
                                        animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1.18 }}
                                        transition={
                                            prefersReducedMotion
                                                ? undefined
                                                : { duration: 4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }
                                        }
                                        className="absolute -left-[18%] -top-[45%] h-[140%] w-[140%] bg-[radial-gradient(circle_at_center,rgba(122,158,114,0.16),transparent_58%)] blur-3xl"
                                    />
                                    <div className="absolute inset-0 opacity-10 bg-[url('/textures/cubes.png')] md:mix-blend-overlay" />

                                    <MotionDiv
                                        animate={prefersReducedMotion ? undefined : { y: [0, -10, 0], rotate: [12, 15, 12] }}
                                        transition={prefersReducedMotion ? undefined : { duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                                    >
                                        <Leaf className="absolute -bottom-8 -right-8 h-40 w-40 text-claude-accent/5" />
                                    </MotionDiv>

                                    <MotionDiv
                                        animate={prefersReducedMotion ? undefined : { y: [0, 10, 0], rotate: [-12, -15, -12] }}
                                        transition={prefersReducedMotion ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                                    >
                                        <Leaf className="absolute -left-6 -top-4 h-32 w-32 text-claude-accent/5 opacity-40" />
                                    </MotionDiv>
                                </>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-claude-bg/95" />

                            <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-3 pb-3 pt-3 safe-area-top sm:gap-3 sm:p-4 lg:p-5">
                                <button
                                    onClick={() => navigate('/account')}
                                    aria-label="Back to account"
                                    className="rounded-full border border-white/10 bg-black/20 p-2.5 text-white/90 shadow-sm transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:bg-black/30 active:scale-95 sm:p-3 md:backdrop-blur-md"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </button>

                                <div className="hidden sm:flex sm:flex-col sm:items-end sm:gap-2">
                                    <div>
                                        <StatusBadge tone={statusMeta.badgeTone}>{statusMeta.badgeLabel}</StatusBadge>
                                    </div>

                                    <MediaActionButton
                                        icon={User}
                                        label="Avatar"
                                        ariaLabel="Change avatar"
                                        onClick={() => {
                                            haptics.light();
                                            setShowAvatarPicker(true);
                                        }}
                                    />

                                    <MediaActionButton
                                        icon={ImageIcon}
                                        label="Banner"
                                        ariaLabel="Change banner"
                                        onClick={() => {
                                            haptics.light();
                                            setShowBannerPicker(true);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="absolute inset-x-0 bottom-0 z-20 p-4 sm:p-5 lg:p-8">
                                <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-end lg:justify-between">
                                    <div className="flex self-end sm:hidden">
                                        <div className="flex flex-col items-end gap-2">
                                            <MediaActionButton
                                                icon={User}
                                                label="Avatar"
                                                ariaLabel="Change avatar"
                                                onClick={() => {
                                                    haptics.light();
                                                    setShowAvatarPicker(true);
                                                }}
                                            />

                                            <MediaActionButton
                                                icon={ImageIcon}
                                                label="Banner"
                                                ariaLabel="Change banner"
                                                onClick={() => {
                                                    haptics.light();
                                                    setShowBannerPicker(true);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-end gap-3 sm:gap-5">
                                        <div className="relative shrink-0">
                                            <div className="relative rounded-full border border-dashed border-white/15 bg-claude-bg/80 p-1 shadow-md md:shadow-2xl sm:p-1.5">
                                                <Avatar src={avatar} size="4xl" className="h-24 w-24 border-[4px] border-claude-bg sm:h-40 sm:w-40 sm:border-[6px]" />
                                            </div>
                                        </div>

                                        <div className="min-w-0 flex-1 pb-0.5 sm:pb-1">
                                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.18em] text-white/70 sm:px-3 sm:text-[10px] md:backdrop-blur-sm">
                                                <Sparkles className="h-3.5 w-3.5 text-claude-accent" />
                                                Profile Studio
                                            </div>

                                            <h1 className="mt-2.5 font-display text-[2.05rem] font-bold italic leading-[0.9] tracking-tight text-white sm:mt-3 sm:text-5xl">
                                                Edit Profile
                                            </h1>
                                            <p className="mt-1.5 max-w-[18rem] text-[13px] leading-relaxed text-white/75 sm:mt-2 sm:max-w-xl sm:text-[15px]">
                                                Tune the name, art, and line people remember when they land on your journal.
                                            </p>

                                            <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:mt-4 sm:gap-2">
                                                <StatusBadge tone="accent">@{usernameValue}</StatusBadge>
                                                <StatusBadge tone={statusMeta.badgeTone}>{statusMeta.badgeLabel}</StatusBadge>
                                                <StatusBadge tone="default">
                                                    {trimmedBio ? `${trimmedBio.length}/${bioLimit} bio` : 'Bio optional'}
                                                </StatusBadge>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="hidden min-w-[320px] items-center gap-4 rounded-[1.75rem] border border-white/10 bg-claude-bg/50 p-4 backdrop-blur-md lg:flex">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/55">
                                                Publish State
                                            </p>
                                            <p className="mt-1 font-display text-lg tracking-wide text-white">
                                                {statusMeta.title}
                                            </p>
                                            <p className="mt-1 text-[11px] font-mono text-white/55">
                                                {statusMeta.detail}
                                            </p>
                                        </div>

                                        <button
                                            onClick={handleSave}
                                            disabled={!canSave}
                                            className={`inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-full px-5 py-3 text-[11px] font-mono font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] ${
                                                canSave
                                                    ? 'bg-claude-accent text-claude-bg shadow-[0_14px_34px_rgba(222,185,106,0.2)] hover:bg-[#c9a24e] active:scale-95'
                                                    : 'cursor-not-allowed border border-white/10 bg-white/[0.05] text-white/40'
                                            }`}
                                        >
                                            {saving ? (
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-claude-bg/30 border-t-claude-bg" />
                                            ) : (
                                                <>
                                                    <Save className="h-4 w-4" />
                                                    Save
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div
                    ref={containerRef}
                    className="mt-6 space-y-4 sm:mt-8 sm:space-y-6"
                >
                    <section className="gsap-edit-item rounded-[1.75rem] border border-white/[0.08] p-4 shadow-sm glass-panel glass-shell sm:rounded-[2rem] sm:p-5 lg:p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-claude-secondary/70">
                                    Identity
                                </p>
                                <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-claude-text sm:text-2xl">
                                    Core profile details
                                </h2>
                                <p className="mt-1 text-[11px] font-mono text-claude-secondary/70">
                                    These appear across profile headers, messages, search, and shared content.
                                </p>
                            </div>
                            <StatusBadge tone="default">Public</StatusBadge>
                        </div>

                        <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-2">
                            <FieldSurface
                                icon={User}
                                label="Display Name"
                                htmlFor="display-name"
                                hint="Use the name you want people to recognize immediately."
                                error={fieldErrors.displayName}
                                counter={`${displayName.length}/${displayNameLimit}`}
                            >
                                <input
                                    id="display-name"
                                    type="text"
                                    value={displayName}
                                    maxLength={displayNameLimit}
                                    autoComplete="name"
                                    aria-invalid={Boolean(fieldErrors.displayName)}
                                    aria-describedby={fieldErrors.displayName ? 'display-name-error' : undefined}
                                    onChange={(event) => {
                                        setDisplayName(event.target.value);
                                        clearFieldError('displayName');
                                    }}
                                    onBlur={() => {
                                        const nextError = getDisplayNameError(displayName);
                                        setFieldErrors((prev) => ({ ...prev, displayName: nextError }));
                                    }}
                                    className="w-full bg-transparent font-display text-[1.15rem] leading-tight tracking-[0.01em] text-claude-text outline-none placeholder:text-claude-secondary/35"
                                    placeholder="Your chosen name"
                                />
                                {fieldErrors.displayName ? (
                                    <span id="display-name-error" className="sr-only">
                                        {fieldErrors.displayName}
                                    </span>
                                ) : null}
                            </FieldSurface>

                            <FieldSurface
                                icon={AtSign}
                                label="Username"
                                htmlFor="username"
                                hint="Lowercase letters, numbers, and underscores only."
                                error={fieldErrors.username}
                                counter={`${username.length}/${usernameLimit}`}
                            >
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    maxLength={usernameLimit}
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    aria-invalid={Boolean(fieldErrors.username)}
                                    aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                                    onChange={(event) => {
                                        setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                                        clearFieldError('username');
                                    }}
                                    onBlur={() => {
                                        const nextError = getUsernameError(username);
                                        setFieldErrors((prev) => ({ ...prev, username: nextError }));
                                    }}
                                    className="w-full bg-transparent font-mono text-[0.95rem] uppercase tracking-[0.16em] text-claude-text outline-none placeholder:text-claude-secondary/35"
                                    placeholder="forest_keeper"
                                />
                                {fieldErrors.username ? (
                                    <span id="username-error" className="sr-only">
                                        {fieldErrors.username}
                                    </span>
                                ) : null}
                            </FieldSurface>

                            <FieldSurface
                                icon={Mail}
                                label="Email"
                                hint="Your account email stays private and is read-only here."
                                className="lg:col-span-2"
                            >
                                <div className="font-display text-[1rem] leading-relaxed tracking-[0.01em] text-claude-text break-all">
                                    {user.email}
                                </div>
                            </FieldSurface>
                        </div>
                    </section>

                    <section className="gsap-edit-item relative overflow-hidden rounded-[1.75rem] p-4 shadow-sm glass-panel-premium sm:rounded-[2rem] sm:p-5 lg:p-6">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/5 to-transparent" />

                        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-claude-accent/80">
                                    Journal Note
                                </p>
                                <h2 className="mt-1 font-display text-xl font-semibold italic tracking-tight text-claude-text sm:text-2xl">
                                    Bio
                                </h2>
                                <p className="mt-1 text-[11px] font-mono text-claude-secondary/70">
                                    One short line is enough. Specific beats generic.
                                </p>
                            </div>
                            <StatusBadge tone="default">Optional</StatusBadge>
                        </div>

                        <div className="relative mt-4 overflow-hidden rounded-[1.35rem] border border-white/10 bg-claude-bg/55 px-3.5 py-3.5 backdrop-blur-sm sm:mt-5 sm:rounded-[1.75rem] sm:px-4 sm:py-4">
                            <div
                                className="pointer-events-none absolute inset-0 opacity-40 md:mix-blend-multiply"
                                style={{
                                    backgroundImage: 'linear-gradient(transparent 39px, rgba(143, 166, 168, 0.28) 40px)',
                                    backgroundSize: '100% 40px',
                                    marginTop: '4px',
                                }}
                            />

                            <textarea
                                id="bio"
                                value={bio}
                                maxLength={bioLimit}
                                rows={5}
                                onChange={(event) => setBio(event.target.value)}
                                placeholder="A line about what you are studying, building, or chasing."
                                className="relative z-10 min-h-[160px] w-full resize-none bg-transparent font-serif text-[17px] leading-[40px] text-claude-text outline-none placeholder:text-claude-secondary/35 sm:min-h-[180px] sm:text-[18px]"
                                style={{ lineHeight: '40px' }}
                            />
                        </div>

                        <div className="mt-3 flex flex-col gap-2.5 sm:mt-4 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-[10px] font-mono leading-relaxed text-claude-secondary/75 sm:text-[11px]">
                                Think of this like the first sentence in a journal entry. It should sound like you.
                            </p>

                            <div className="flex items-center gap-2">
                                <StatusBadge tone={trimmedBio ? 'success' : 'default'}>
                                    {trimmedBio ? 'Preview ready' : 'Optional'}
                                </StatusBadge>
                                <span className={`text-[11px] font-mono ${bio.length >= bioLimit - 20 ? 'text-amber-300' : 'text-claude-secondary/70'}`}>
                                    {bio.length}/{bioLimit}
                                </span>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <div
                ref={mobileSaveBarRef}
                data-testid="edit-profile-mobile-save-bar"
                className="fixed inset-x-0 bottom-0 z-50 px-3 sm:px-4 lg:hidden"
                style={{ paddingBottom: mobileSaveBarInset }}
            >
                <div className="mx-auto max-w-3xl rounded-[1.45rem] p-1 shadow-[0_28px_90px_-36px_rgba(0,0,0,0.85)] glass-panel glass-shell sm:rounded-[1.75rem] sm:p-1.5">
                    <div className="flex items-center gap-3 rounded-[1.2rem] border border-white/[0.08] bg-claude-bg/78 px-3.5 py-3 backdrop-blur-xl sm:rounded-[1.45rem] sm:px-4">
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-claude-secondary/70 sm:text-[10px]">
                                Publish State
                            </p>
                            <p className="mt-1 truncate font-display text-[0.95rem] tracking-wide text-claude-text sm:text-base">
                                {statusMeta.title}
                            </p>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={!canSave}
                            className={`inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-full px-3.5 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] sm:px-4 sm:text-[11px] ${
                                canSave
                                    ? 'bg-claude-accent text-claude-bg shadow-[0_14px_34px_rgba(222,185,106,0.2)] active:scale-95'
                                    : 'cursor-not-allowed border border-white/10 bg-white/[0.05] text-white/40'
                            }`}
                        >
                            {saving ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-claude-bg/30 border-t-claude-bg" />
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Save
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showAvatarPicker && (
                    <AvatarPicker
                        currentAvatar={avatar}
                        onSelect={(url) => {
                            setAvatar(url);
                            setShowAvatarPicker(false);
                            haptics.success();
                        }}
                        onClose={() => setShowAvatarPicker(false)}
                    />
                )}
                {showBannerPicker && (
                    <BannerPicker
                        currentBanner={banner}
                        onSelect={(url) => {
                            setBanner(url);
                            setShowBannerPicker(false);
                            haptics.success();
                        }}
                        onClose={() => setShowBannerPicker(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
