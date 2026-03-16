import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Camera, User, Mail, Leaf, PenTool, AtSign, CheckCircle2 } from 'lucide-react';
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

export default function EditProfile() {
    const { user, updateProfile } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();

    const [username, setUsername] = useState(user?.username || '');
    const [displayName, setDisplayName] = useState(user?.displayName || user?.username || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [avatar, setAvatar] = useState(user?.avatar || '');
    const [banner, setBanner] = useState(user?.banner || '');
    const [saving, setSaving] = useState(false);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [showBannerPicker, setShowBannerPicker] = useState(false);
    const [bioError, setBioError] = useState(false);

    const containerRef = useRef(null);
    const bioContainerRef = useRef(null);
    const bioLimit = 160;
    const usernameLimit = 30;

    useGSAP(() => {
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches) return;

        if (containerRef.current) {
            const items = containerRef.current.querySelectorAll('.gsap-edit-item');
            gsap.from(items, {
                y: 20,
                opacity: 0,
                duration: DURATION.normal,
                stagger: STAGGER.tight,
                ease: EASE.organic,
                clearProps: 'all'
            });
        }
    }, [user]);

    useEffect(() => {
        if (bioError && bioContainerRef.current) {
            const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            if (motionQuery.matches) return;

            gsap.fromTo(
                bioContainerRef.current,
                { x: 0 },
                { x: 5, duration: 0.05, ease: 'none', yoyo: true, repeat: 5, clearProps: 'x' }
            );
        }
    }, [bioError]);

    const handleSave = async () => {
        if (!bio.trim()) {
            setBioError(true);
            haptics.error();
            toast.error('Bio cannot be completely empty');
            setTimeout(() => setBioError(false), 2000);
            return;
        }

        if (!username.trim() || !displayName.trim()) {
            haptics.error();
            toast.error('Username and Display Name are required');
            return;
        }

        if (username.trim().length < 2) {
            haptics.error();
            toast.error('Username must be at least 2 characters');
            return;
        }

        if (saving) return;
        setSaving(true);
        haptics.medium();

        try {
            await updateProfile({
                username: usernameResult.data,
                displayName: displayResult.data,
                bio: bioResult.data,
                avatar,
                banner
            });
            toast.success('Journal updated');
            haptics.success();
            navigate('/account');
        } catch (err) {
            haptics.error();
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    if (!user) return <div className="min-h-screen flex items-center justify-center bg-claude-bg"><LoadingSpinner /></div>;

    const hasChanges =
        bio.trim() !== (user?.bio || '') ||
        avatar !== (user?.avatar || '') ||
        banner !== (user?.banner || '') ||
        username.trim() !== (user?.username || '') ||
        displayName.trim() !== (user?.displayName || user?.username || '');

    const trimmedBio = bio.trim();
    const usernameValue = username.trim() || 'username';
    const displayValue = displayName.trim() || user?.username || 'Your name';
    const statusTone = hasChanges ? 'pending' : 'saved';

    return (
        <div className="min-h-screen bg-claude-bg pb-24 font-sans text-claude-text">
            <div className="relative mx-auto w-full max-w-5xl lg:px-6">
                <div className="relative mx-4 mt-4 h-52 overflow-hidden rounded-[3rem] border border-claude-border/40 shadow-sm md:shadow-lg lg:mx-0 lg:h-56">
                    {banner ? (
                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${banner})` }}>
                            <div className="absolute inset-0 bg-claude-bg/60"></div>
                        </div>
                    ) : (
                        <>
                            <div className="absolute inset-0 bg-claude-bg"></div>
                            <MotionDiv
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1.2 }}
                                transition={{ duration: 4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                                className="absolute top-[-50%] left-[-20%] h-[140%] w-[140%] bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--accent-color)_15%,transparent),transparent_60%)] blur-3xl"
                            />
                            <div className="absolute inset-0 opacity-10 bg-[url('/textures/cubes.png')] md:mix-blend-overlay"></div>

                            <MotionDiv
                                animate={{ y: [0, -10, 0], rotate: [12, 15, 12] }}
                                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Leaf className="absolute -bottom-8 -right-8 h-40 w-40 text-claude-accent/5" />
                            </MotionDiv>
                            <MotionDiv
                                animate={{ y: [0, 10, 0], rotate: [-12, -15, -12] }}
                                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Leaf className="absolute -left-6 -top-4 h-32 w-32 text-claude-accent/5 opacity-40" />
                            </MotionDiv>
                        </>
                    )}

                    <button
                        onClick={() => { haptics.light(); setShowBannerPicker(true); }}
                        className="absolute inset-0 z-20 flex items-center justify-center bg-claude-bg/70 opacity-0 backdrop-blur-sm transition-all duration-300 hover:opacity-100 group"
                    >
                        <div className="rounded-full border border-claude-border bg-claude-surface/60 p-3 transition-transform group-hover:scale-110 md:backdrop-blur-md">
                            <Camera className="h-6 w-6 text-claude-text" />
                        </div>
                    </button>
                </div>

                <div className="sticky top-0 z-50 mx-4 -mt-16 rounded-[2rem] border border-claude-border/40 bg-claude-surface/55 px-4 pb-4 pt-12 shadow-lg backdrop-blur-xl lg:mx-0 lg:-mt-14">
                    <div className="flex items-center justify-between">
                    <button
                        onClick={() => navigate('/account')}
                        className="rounded-full border border-claude-border/40 bg-claude-bg/60 p-3 text-claude-text shadow-sm transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:bg-claude-bg/70 active:scale-95 md:backdrop-blur-md"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>

                    <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-display font-bold tracking-wide text-claude-text opacity-90 drop-shadow-md">
                        Edit Profile
                    </h1>

                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold uppercase tracking-widest shadow-sm transition-[transform,opacity,color,background-color,border-color,box-shadow] md:shadow-lg ${hasChanges && !saving
                            ? 'bg-claude-accent text-white shadow-claude-accent/30 hover:bg-[#2b4c3e] active:scale-95'
                            : 'cursor-not-allowed border border-claude-border/40 bg-claude-surface/60 text-claude-secondary/50 md:backdrop-blur-md'
                            }`}
                    >
                        {saving ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Save
                            </>
                        )}
                    </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.35rem] border border-claude-border bg-claude-bg/60 px-4 py-3 text-claude-text">
                        <div className="min-w-0">
                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary/80">
                                Profile Status
                            </p>
                            <p className="mt-1 font-display text-base tracking-wide text-claude-text">
                                {statusTone === 'pending' ? 'Unsaved changes ready to publish' : 'Everything is up to date'}
                            </p>
                        </div>
                        <div className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] ${
                            statusTone === 'pending'
                                ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                                : 'border-claude-accent/30 bg-claude-accent/10 text-claude-text'
                        }`}>
                            {statusTone === 'pending' ? 'Needs Save' : 'Saved'}
                        </div>
                    </div>
                </div>

                <div
                    ref={containerRef}
                    className="relative z-10 mx-auto max-w-md space-y-8 px-6 pt-8 pointer-events-none lg:max-w-none lg:px-0"
                >
                    <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8 lg:space-y-0">
                        <div className="space-y-6 lg:sticky lg:top-28 lg:self-start">
                            <div className="gsap-edit-item pointer-events-auto flex flex-col items-center justify-center rounded-[2rem] border border-claude-secondary/10 bg-claude-surface/50 py-6 shadow-sm md:backdrop-blur-md lg:items-start lg:px-6">
                        <button
                            onClick={() => { haptics.light(); setShowAvatarPicker(true); }}
                            className="group relative block lg:self-center"
                        >
                            <div className="absolute inset-0 z-0 scale-110 rounded-full bg-claude-accent/20 opacity-0 blur-xl transition-transform duration-500 group-hover:scale-125 group-hover:opacity-100"></div>
                            <div className="relative z-10 rounded-full border border-dashed border-claude-border bg-claude-bg p-1.5 shadow-md transition-colors group-hover:border-claude-border md:shadow-2xl">
                                <Avatar src={avatar} size="4xl" className="border-[6px] border-claude-bg" />
                            </div>

                            <div className="absolute bottom-2 right-2 z-20 rounded-full border-2 border-claude-bg bg-claude-accent p-3 text-white shadow-sm transition-transform duration-300 hover:scale-110 active:scale-95 md:shadow-xl">
                                <Camera className="h-5 w-5" />
                            </div>
                        </button>
                        <p className="mt-4 text-[10px] font-mono uppercase tracking-[0.2em] text-claude-secondary/70">Tap to change avatar</p>
                    </div>

                    <div className="gsap-edit-item pointer-events-auto rounded-[2rem] border border-claude-secondary/10 bg-claude-surface/50 p-5 shadow-sm md:backdrop-blur-md">
                        <div className="flex items-start gap-3">
                            <div className="rounded-2xl border border-claude-secondary/10 bg-claude-bg p-3 shadow-inner">
                                {statusTone === 'pending' ? (
                                    <PenTool className="h-5 w-5 text-claude-accent" />
                                ) : (
                                    <CheckCircle2 className="h-5 w-5 text-claude-accent" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary/65">
                                    Public Preview
                                </p>
                                <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-claude-text">
                                    {displayValue}
                                </h2>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-full border border-claude-secondary/15 bg-claude-bg px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-accent/90">
                                        <AtSign className="h-3 w-3" />
                                        {usernameValue}
                                    </span>
                                    <span className="rounded-full border border-claude-secondary/15 bg-claude-bg px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary/75">
                                        {trimmedBio.length}/{bioLimit} bio
                                    </span>
                                </div>
                                <p className="mt-3 text-sm leading-relaxed text-claude-secondary">
                                    {trimmedBio || 'Add a short line so your profile feels complete when people visit it.'}
                                </p>
                            </div>
                        </div>
                    </div>
                        </div>

                        <div className="gsap-edit-item pointer-events-auto space-y-6">
                            <div className="flex flex-col gap-6 rounded-[2rem] border border-claude-secondary/10 bg-claude-surface/50 p-6 shadow-sm md:backdrop-blur-md">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary/65">
                                        Identity
                                    </p>
                                    <h2 className="mt-1 font-display text-xl font-semibold tracking-wide text-claude-text">
                                        Core profile details
                                    </h2>
                                    <p className="mt-1 text-[11px] font-mono text-claude-secondary/70">
                                        These are the first things people see in Riven.
                                    </p>
                                </div>
                                <div className="rounded-full border border-claude-secondary/15 bg-claude-bg px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary/75">
                                    Public
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="rounded-xl border border-claude-secondary/5 bg-claude-bg p-3 shadow-inner">
                                    <User className="h-5 w-5 text-claude-secondary/70" />
                                </div>
                                <div className="w-full">
                                    <label className="mb-0.5 block text-[10px] font-mono uppercase tracking-[0.15em] text-claude-secondary/60">
                                        Display Name
                                    </label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full border-b border-claude-secondary/10 bg-transparent pb-1 font-display text-lg font-medium tracking-wide text-claude-text outline-none transition-colors placeholder:text-claude-secondary/40 focus:border-claude-accent/50"
                                        placeholder="Your chosen name"
                                    />
                                    <p className="mt-2 text-[10px] font-mono text-claude-secondary/60">
                                        Use the name you want shown on your profile and shared content.
                                    </p>
                                </div>
                            </div>

                            <div className="h-px w-full bg-gradient-to-r from-transparent via-claude-secondary/10 to-transparent"></div>

                            <div className="flex items-center gap-4">
                                <div className="rounded-xl border border-claude-secondary/5 bg-claude-bg p-3 shadow-inner">
                                    <User className="h-5 w-5 text-claude-secondary/70" />
                                </div>
                                <div className="w-full">
                                    <label className="mb-0.5 block text-[10px] font-mono uppercase tracking-[0.15em] text-claude-secondary/60">
                                        @Username (Unique)
                                    </label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                        className="w-full border-b border-claude-secondary/10 bg-transparent pb-1 font-mono text-sm font-medium tracking-wide text-claude-text outline-none transition-colors placeholder:text-claude-secondary/40 focus:border-claude-accent/50"
                                        placeholder="unique_username"
                                        maxLength={usernameLimit}
                                    />
                                    <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-mono">
                                        <span className="text-claude-secondary/60">Lowercase letters, numbers, underscores</span>
                                        <span className={`${username.length >= usernameLimit - 5 ? 'text-amber-500' : 'text-claude-secondary/60'}`}>
                                            {username.length}/{usernameLimit}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="h-px w-full bg-gradient-to-r from-transparent via-claude-secondary/10 to-transparent"></div>

                            <div className="flex items-center gap-4">
                                <div className="rounded-xl border border-claude-secondary/5 bg-claude-bg p-3 shadow-inner">
                                    <Mail className="h-5 w-5 text-claude-secondary/70" />
                                </div>
                                <div>
                                    <label className="mb-0.5 block text-[10px] font-mono uppercase tracking-[0.15em] text-claude-secondary/60">
                                        Email
                                    </label>
                                    <div className="font-display text-[15px] font-medium tracking-wide text-claude-text">
                                        {user.email}
                                    </div>
                                </div>
                            </div>
                        </div>

                            <div
                                ref={bioContainerRef}
                                className={`relative overflow-hidden rounded-[2rem] border p-6 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 ${bioError ? 'border-red-400 bg-red-50/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : 'border-claude-secondary/15 bg-claude-bg shadow-inner dark:bg-claude-bg'}`}
                            >
                            <div className="mb-6 flex items-start justify-between gap-4">
                                <div>
                                    <label className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-claude-accent">
                                        <PenTool className="h-4 w-4" />
                                        Your Bio
                                    </label>
                                    <p className="mt-2 text-[11px] font-mono text-claude-secondary/75">
                                        Keep it short, specific, and recognizably you.
                                    </p>
                                </div>
                                <div className="rounded-full border border-claude-secondary/15 bg-claude-surface/80 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary/75 dark:bg-claude-bg/40">
                                    Required
                                </div>
                            </div>

                            <div className="relative">
                                <div
                                    className="pointer-events-none absolute inset-0 opacity-40 md:mix-blend-multiply"
                                    style={{
                                        backgroundImage: 'linear-gradient(transparent 39px, rgba(143, 166, 168, 0.3) 40px)',
                                        backgroundSize: '100% 40px',
                                        marginTop: '4px'
                                    }}
                                />

                                <textarea
                                    value={bio}
                                    onChange={(e) => {
                                        setBio(e.target.value);
                                        if (bioError) setBioError(false);
                                    }}
                                    maxLength={bioLimit}
                                    rows={4}
                                    placeholder="Reflect on your journey..."
                                    className={`relative z-10 w-full resize-none border-none bg-transparent px-1 font-serif text-[19px] leading-[40px] outline-none placeholder:text-claude-secondary/40 ${bioError ? 'text-red-900' : 'text-claude-text'}`}
                                    style={{ lineHeight: '40px' }}
                                />
                            </div>

                            <div className="mt-4 flex items-end justify-between">
                                <AnimatePresence>
                                    {bioError && (
                                        <motion.span
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            className="rounded bg-red-500/10 px-2 py-1 text-[10px] font-mono text-red-500"
                                        >
                                            Bio cannot be empty
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            <div className={`ml-auto text-[11px] font-mono ${bioError ? 'text-red-400' : 'text-claude-secondary/60'} ${bio.length >= 150 ? 'text-amber-500' : ''}`}>
                                    {bio.length} / {bioLimit}
                                </div>
                            </div>
                            </div>

                            <div className="rounded-[2rem] border border-claude-secondary/10 bg-claude-surface/40 p-4 shadow-sm">
                                <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary/65">
                                        Save changes
                                    </p>
                                    <p className="mt-1 text-sm text-claude-secondary">
                                        {hasChanges ? 'You have profile updates waiting to be saved.' : 'No pending edits right now.'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !hasChanges}
                                    className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-mono font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] ${
                                        hasChanges && !saving
                                            ? 'bg-claude-accent text-white shadow-claude-accent/25 hover:bg-[#2b4c3e] active:scale-95'
                                            : 'cursor-not-allowed border border-claude-secondary/10 bg-claude-bg text-claude-secondary/45'
                                    }`}
                                >
                                    {saving ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    {saving ? 'Saving' : 'Save'}
                                </button>
                            </div>
                        </div>
                        </div>
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
