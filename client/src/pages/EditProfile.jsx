import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import {
    ArrowLeft,
    AtSign,
    Camera,
    Check,
    Mail,
    PenTool,
    Save,
    Type
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import Avatar from '../components/Avatar';
import AvatarPicker from '../components/AvatarPicker';
import BannerPicker from '../components/BannerPicker';
import LoadingSpinner from '../components/LoadingSpinner';

const SectionHeader = ({ eyebrow, title, description }) => (
    <div className="mb-3 px-1">
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-botanical-sepia">
            {eyebrow}
        </p>
        <div className="mt-1">
            <h2 className="font-display text-xl font-semibold tracking-[0.01em] text-claude-text">
                {title}
            </h2>
            {description && (
                <p className="mt-1 text-[11px] font-mono text-botanical-sepia/75">
                    {description}
                </p>
            )}
        </div>
    </div>
);

const SectionCard = ({ children, className = '' }) => (
    <div className={`rounded-[1.75rem] border border-claude-border/70 bg-claude-surface/95 shadow-sm backdrop-blur ${className}`}>
        {children}
    </div>
);

const StatTile = ({ label, value, accent = 'default' }) => {
    const accentClasses = accent === 'success'
        ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400'
        : accent === 'accent'
            ? 'border-claude-accent/20 bg-claude-accent/[0.08] text-claude-accent'
            : 'border-claude-border bg-claude-bg/70 text-claude-text';

    return (
        <div className={`rounded-[1.25rem] border p-4 ${accentClasses}`}>
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                {label}
            </p>
            <p className="mt-1 font-display text-lg text-claude-text">
                {value}
            </p>
        </div>
    );
};

const FieldRow = ({
    icon,
    label,
    hint,
    children,
    tone = 'default'
}) => {
    const iconTone = tone === 'accent'
        ? 'border-claude-accent/20 bg-claude-accent/10 text-claude-accent'
        : tone === 'danger'
            ? 'border-red-500/20 bg-red-500/10 text-red-400'
            : 'border-botanical-sepia/10 bg-claude-bg text-claude-text/70';

    return (
        <div className="flex items-start gap-4 rounded-[1.5rem] border border-claude-border/70 bg-claude-bg/60 p-4">
            <div className={`mt-0.5 rounded-2xl border p-3 shadow-sm ${iconTone}`}>
                {React.createElement(icon, { className: 'h-5 w-5' })}
            </div>
            <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-[0.18em] text-botanical-sepia/80">
                        {label}
                    </label>
                    {hint && (
                        <span className="text-[10px] font-mono text-claude-secondary/70">
                            {hint}
                        </span>
                    )}
                </div>
                {children}
            </div>
        </div>
    );
};

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

    const bioLimit = 160;
    const usernameLimit = 30;

    const hasChanges = useMemo(() => (
        bio.trim() !== (user?.bio || '')
        || avatar !== (user?.avatar || '')
        || banner !== (user?.banner || '')
        || username.trim() !== (user?.username || '')
        || displayName.trim() !== (user?.displayName || user?.username || '')
    ), [avatar, banner, bio, displayName, user, username]);

    const bannerStyle = banner
        ? { backgroundImage: `linear-gradient(180deg, rgba(10,13,12,0.12), rgba(10,13,12,0.52)), url(${banner})` }
        : { backgroundImage: 'radial-gradient(circle at top right, rgba(122,158,114,0.28), transparent 42%), linear-gradient(135deg, rgba(19,28,26,0.98), rgba(28,39,36,0.92) 55%, rgba(40,56,49,0.9))' };

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
            toast.error('Username and display name are required');
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
                username: username.trim(),
                displayName: displayName.trim(),
                bio: bio.trim(),
                avatar,
                banner
            });
            toast.success('Profile updated');
            haptics.success();
            navigate('/account');
        } catch (err) {
            haptics.error();
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-claude-bg">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-claude-bg pb-24 font-sans text-claude-text">
            <div className="sticky top-0 z-50 border-b border-botanical-sepia/5 bg-claude-bg/80 pb-2 pt-12 md:backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-botanical-sepia/5 px-4 py-2 pb-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="rounded-full border border-botanical-sepia/5 bg-claude-surface p-3 shadow-sm transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:bg-botanical-sepia/10 active:scale-95"
                    >
                        <ArrowLeft className="h-5 w-5 text-claude-text" />
                    </button>

                    <h1 className="font-display text-xl font-bold tracking-wider text-claude-text">
                        Edit Profile
                    </h1>

                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className={`flex min-w-12 items-center justify-center rounded-full px-4 py-3 text-[11px] font-mono font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] ${
                            hasChanges && !saving
                                ? 'bg-claude-text text-claude-bg active:scale-95'
                                : 'border border-claude-border bg-claude-surface text-claude-secondary/60'
                        }`}
                    >
                        {saving ? (
                            <div className="h-4 w-4 rounded-full border-2 border-claude-bg/30 border-t-claude-bg animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
                <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)] xl:items-start xl:gap-8">
                    <div className="space-y-6 xl:sticky xl:top-28">
                        <div>
                            <SectionHeader
                                eyebrow="Overview"
                                title="Profile snapshot"
                                description="Preview how your identity reads across the app before you publish changes."
                            />
                            <SectionCard className="overflow-hidden">
                                <div
                                    className="relative min-h-[240px] bg-cover bg-center p-6"
                                    style={bannerStyle}
                                >
                                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,15,14,0.08),rgba(11,15,14,0.68))]" />

                                    <button
                                        onClick={() => {
                                            haptics.light();
                                            setShowBannerPicker(true);
                                        }}
                                        className="absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.16em] text-white/90 transition-colors hover:bg-black/30"
                                    >
                                        <Camera className="h-3.5 w-3.5" />
                                        Banner
                                    </button>

                                    <div className="relative z-10 flex h-full flex-col justify-end">
                                        <button
                                            onClick={() => {
                                                haptics.light();
                                                setShowAvatarPicker(true);
                                            }}
                                            className="group inline-flex w-fit flex-col items-start"
                                        >
                                            <div className="relative">
                                                <Avatar src={avatar} size="4xl" className="border-[5px] border-claude-bg shadow-md" />
                                                <div className="absolute -bottom-1 -right-1 rounded-full border border-claude-bg bg-claude-text p-2 text-claude-bg shadow-sm transition-transform group-hover:scale-105">
                                                    <Camera className="h-4 w-4" />
                                                </div>
                                            </div>
                                        </button>

                                        <div className="mt-4">
                                            <p className="font-display text-2xl font-semibold text-white">
                                                {displayName.trim() || 'Your display name'}
                                            </p>
                                            <p className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70">
                                                @{username.trim() || 'username'}
                                            </p>
                                            <p className="mt-3 max-w-[28rem] text-sm leading-relaxed text-white/80">
                                                {bio.trim() || 'Your short profile note will appear here once you add it.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 border-t border-white/5 p-4 md:grid-cols-3">
                                    <StatTile label="Status" value={hasChanges ? 'Unsaved changes' : 'Up to date'} accent={hasChanges ? 'accent' : 'success'} />
                                    <StatTile label="Bio" value={`${bio.length}/${bioLimit}`} />
                                    <StatTile label="Handle" value={`${username.trim().length}/${usernameLimit}`} />
                                </div>
                            </SectionCard>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <SectionHeader
                                eyebrow="Identity"
                                title="Public-facing details"
                                description="These fields shape how other people see you in Riven."
                            />
                            <SectionCard className="space-y-4 p-4 sm:p-5">
                                <FieldRow icon={Type} label="Display Name" hint="Shown across decks, journals, and profile surfaces">
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="Your chosen name"
                                        className="w-full border-none bg-transparent p-0 font-display text-xl tracking-[0.01em] text-claude-text outline-none placeholder:text-claude-secondary/40"
                                    />
                                </FieldRow>

                                <FieldRow icon={AtSign} label="Username" hint="Lowercase letters, numbers, and underscores">
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                        placeholder="unique_username"
                                        maxLength={usernameLimit}
                                        className="w-full border-none bg-transparent p-0 font-mono text-sm tracking-[0.12em] text-claude-text outline-none placeholder:text-claude-secondary/40"
                                    />
                                    <div className="mt-3 flex items-center justify-between text-[10px] font-mono">
                                        <span className="text-botanical-sepia/75">Minimum 2 characters</span>
                                        <span className="text-claude-secondary">{username.length}/{usernameLimit}</span>
                                    </div>
                                </FieldRow>

                                <FieldRow icon={Mail} label="Email" hint="Read only">
                                    <div className="font-display text-[15px] tracking-wide text-claude-text">
                                        {user.email}
                                    </div>
                                </FieldRow>
                            </SectionCard>
                        </div>

                        <div>
                            <SectionHeader
                                eyebrow="About"
                                title="Journal note"
                                description="A short line that gives your profile some personality."
                            />
                            <SectionCard className={`p-4 sm:p-5 ${bioError ? 'border-red-500/30 bg-red-500/[0.03]' : ''}`}>
                                <FieldRow
                                    icon={PenTool}
                                    label="Bio"
                                    hint="Required"
                                    tone={bioError ? 'danger' : 'accent'}
                                >
                                    <textarea
                                        value={bio}
                                        onChange={(e) => {
                                            setBio(e.target.value);
                                            if (bioError) setBioError(false);
                                        }}
                                        maxLength={bioLimit}
                                        rows={5}
                                        placeholder="Reflect on your journey..."
                                        className={`w-full resize-none border-none bg-transparent p-0 font-serif text-lg leading-8 outline-none placeholder:text-botanical-sepia/35 ${
                                            bioError ? 'text-red-300' : 'text-claude-text'
                                        }`}
                                    />

                                    <div className="mt-4 flex items-center justify-between gap-3">
                                        <div className="min-h-5 text-[10px] font-mono">
                                            {bioError && (
                                                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-red-400">
                                                    Bio cannot be empty
                                                </span>
                                            )}
                                        </div>
                                        <span className={`text-[10px] font-mono ${bio.length >= 150 ? 'text-amber-400' : 'text-claude-secondary'}`}>
                                            {bio.length}/{bioLimit}
                                        </span>
                                    </div>
                                </FieldRow>
                            </SectionCard>
                        </div>

                        <div>
                            <SectionHeader
                                eyebrow="Actions"
                                title="Review and publish"
                                description="Save when your profile preview looks right."
                            />
                            <SectionCard className="p-4 sm:p-5">
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <button
                                        onClick={handleSave}
                                        disabled={!hasChanges || saving}
                                        className={`flex-1 rounded-xl px-4 py-3.5 text-[11px] font-mono font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] ${
                                            hasChanges && !saving
                                                ? 'bg-claude-text text-claude-bg active:scale-[0.98]'
                                                : 'border border-claude-border bg-claude-bg text-claude-secondary/60'
                                        }`}
                                    >
                                        <span className="flex items-center justify-center gap-2">
                                            {saving ? (
                                                <div className="h-4 w-4 rounded-full border-2 border-claude-bg/30 border-t-claude-bg animate-spin" />
                                            ) : (
                                                <Save className="h-4 w-4" />
                                            )}
                                            {saving ? 'Saving' : 'Save Profile'}
                                        </span>
                                    </button>

                                    <button
                                        onClick={() => navigate('/account')}
                                        className="flex-1 rounded-xl border border-claude-border bg-claude-bg px-4 py-3.5 text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-claude-text transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98]"
                                    >
                                        Back to Account
                                    </button>
                                </div>

                                <div className="mt-4 flex items-start gap-3 rounded-[1.25rem] border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
                                    <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-400">
                                        <Check className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-emerald-400">
                                            Current standard
                                        </p>
                                        <p className="mt-1 text-sm leading-relaxed text-claude-text">
                                            This layout now matches the cleaner sectioned account experience used across the latest Riven settings surfaces.
                                        </p>
                                    </div>
                                </div>
                            </SectionCard>
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
