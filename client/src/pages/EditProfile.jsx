import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Camera, User, Mail, Leaf, PenTool } from 'lucide-react';
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
    const leafRef = useRef(null);
    const bioContainerRef = useRef(null);

    // Initial stagger animation
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

        if (leafRef.current) {
            gsap.to(leafRef.current, {
                rotation: 360,
                duration: 100,
                repeat: -1,
                ease: 'none'
            });
        }
    }, [user]);

    // Bio error shake
    useEffect(() => {
        if (bioError && bioContainerRef.current) {
            const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            if (motionQuery.matches) return;

            gsap.fromTo(bioContainerRef.current,
                { x: 0 },
                { x: 5, duration: 0.05, ease: 'none', yoyo: true, repeat: 5, clearProps: 'x' }
            );
        }
    }, [bioError]);

    const handleSave = async () => {
        // Enforce empty field validation (even for bio, let's say it needs at least 1 char for this premium feel)
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
            await updateProfile({ username: username.trim(), displayName: displayName.trim(), bio: bio.trim(), avatar, banner });
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

    const hasChanges = bio.trim() !== (user?.bio || '') || avatar !== (user?.avatar || '') || banner !== (user?.banner || '') || username.trim() !== (user?.username || '') || displayName.trim() !== (user?.displayName || user?.username || '');

    return (
        <div className="min-h-screen bg-claude-bg pb-24 font-sans text-claude-text">
            {/* Organic Header wrapper to allow for absolute positioning behind content */}
            <div className="relative">
                {/* Organic Header Background */}
                <div className="absolute top-0 left-0 right-0 h-56 overflow-hidden rounded-b-[3rem] z-0 shadow-sm">
                    {banner ? (
                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${banner})` }}>
                            <div className="absolute inset-0 bg-black/40"></div>
                        </div>
                    ) : (
                        <>
                            <div className="absolute inset-0 bg-[#0f2026] rounded-b-[3rem]"></div>
                            <div
                                className="absolute top-[-50%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(122,158,114,0.15),transparent_60%)] blur-3xl rounded-b-[3rem] animate-in fade-in duration-1000"
                            />
                            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] md:mix-blend-overlay"></div>
                        </>
                    )}

                    {/* Banner Edit Overlay */}
                    <button
                        onClick={() => { haptics.light(); setShowBannerPicker(true); }}
                        className="absolute inset-0 z-20 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/30 backdrop-blur-sm transition-all duration-300 group"
                    >
                        <div className="p-3 bg-white/10 rounded-full md:backdrop-blur-md border border-white/20 group-hover:scale-110 transition-transform">
                            <Camera className="w-6 h-6 text-white" />
                        </div>
                    </button>

                    {/* Animated Decorative Element (only show if no banner to reduce clutter) */}
                    {!banner && (
                        <div
                            ref={leafRef}
                            className="absolute -right-20 -top-20 opacity-5 pointer-events-none"
                        >
                            <Leaf className="w-96 h-96 text-botanical-forest" />
                        </div>
                    )}
                </div>

                {/* Navigation / Actions Sticky Header */}
                <div className="sticky top-0 z-50 pt-12 pb-4 px-4 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/account')}
                        className="p-3 bg-black/20 md:backdrop-blur-md border border-white/5 rounded-full text-white/90 hover:bg-black/30 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    <h1 className="text-xl font-display font-bold text-white tracking-wide absolute left-1/2 -translate-x-1/2 opacity-90 drop-shadow-md">
                        Edit Profile
                    </h1>

                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`px-5 py-2.5 rounded-full text-sm font-bold tracking-widest uppercase flex items-center gap-2 transition-[transform,opacity,color,background-color,border-color,box-shadow] shadow-sm md:shadow-lg ${hasChanges && !saving
                            ? 'bg-botanical-forest text-white shadow-botanical-forest/30 active:scale-95 hover:bg-[#2b4c3e]'
                            : 'bg-white/10 text-white/50 md:backdrop-blur-md cursor-not-allowed border border-white/5'
                            }`}
                    >
                        {saving ? (
                            <div
                                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                            />
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save
                            </>
                        )}
                    </button>
                </div>

                <div
                    ref={containerRef}
                    className="relative z-10 px-6 max-w-md mx-auto pt-8 space-y-12 pointer-events-none"
                >
                    {/* Avatar Selection Section */}
                    <div className="gsap-edit-item flex justify-center flex-col items-center pointer-events-auto">
                        <button
                            onClick={() => { haptics.light(); setShowAvatarPicker(true); }}
                            className="relative group block"
                        >
                            <div className="absolute inset-0 bg-botanical-forest/20 rounded-full blur-xl scale-110 group-hover:scale-125 transition-transform duration-500 opacity-0 group-hover:opacity-100 z-0"></div>
                            <div className="relative z-10 p-1.5 rounded-full border border-dashed border-white/30 group-hover:border-white/50 transition-colors bg-claude-bg shadow-md md:shadow-2xl">
                                <Avatar src={avatar} size="4xl" className="border-[6px] border-claude-bg" />
                            </div>

                            <div
                                className="absolute bottom-2 right-2 p-3 bg-botanical-forest text-white rounded-full shadow-sm md:shadow-xl border-2 border-claude-bg z-20 hover:scale-110 active:scale-95 transition-transform duration-300"
                            >
                                <Camera className="w-5 h-5" />
                            </div>
                        </button>
                        <p className="mt-4 text-[10px] font-mono uppercase tracking-[0.2em] text-botanical-sepia/70">Tap to change avatar</p>
                    </div>

                    {/* Form Fields - Bento Style */}
                    <div className="gsap-edit-item space-y-6 pointer-events-auto">

                        {/* Read-Only Account Info Bento */}
                        <div className="bg-claude-surface/50 md:backdrop-blur-md border border-botanical-sepia/10 rounded-[2rem] p-6 shadow-sm flex flex-col gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-claude-bg rounded-xl border border-botanical-sepia/5 shadow-inner">
                                    <User className="w-5 h-5 text-botanical-sepia/70" />
                                </div>
                                <div className="w-full">
                                    <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-botanical-sepia/60 block mb-0.5">
                                        Display Name
                                    </label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full bg-transparent font-display text-lg tracking-wide text-claude-text font-medium outline-none placeholder:text-botanical-sepia/40 border-b border-botanical-sepia/10 focus:border-botanical-forest/50 transition-colors pb-1"
                                        placeholder="Your chosen name"
                                    />
                                </div>
                            </div>

                            <div className="h-px bg-gradient-to-r from-transparent via-botanical-sepia/10 to-transparent w-full"></div>

                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-claude-bg rounded-xl border border-botanical-sepia/5 shadow-inner">
                                    <User className="w-5 h-5 text-botanical-sepia/70" />
                                </div>
                                <div className="w-full">
                                    <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-botanical-sepia/60 block mb-0.5">
                                        @Username (Unique)
                                    </label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                        className="w-full bg-transparent font-mono text-sm tracking-wide text-claude-text font-medium outline-none placeholder:text-botanical-sepia/40 border-b border-botanical-sepia/10 focus:border-botanical-forest/50 transition-colors pb-1"
                                        placeholder="unique_username"
                                        maxLength={30}
                                    />
                                </div>
                            </div>

                            <div className="h-px bg-gradient-to-r from-transparent via-botanical-sepia/10 to-transparent w-full"></div>

                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-claude-bg rounded-xl border border-botanical-sepia/5 shadow-inner">
                                    <Mail className="w-5 h-5 text-botanical-sepia/70" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-botanical-sepia/60 block mb-0.5">
                                        Email
                                    </label>
                                    <div className="font-display text-[15px] tracking-wide text-claude-text font-medium">
                                        {user.email}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bio Input - Reimagined Lined Paper */}
                        <div
                            ref={bioContainerRef}
                            className={`bg-[#fdfbf7] dark:bg-[#1a1d1c] border ${bioError ? 'border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)] bg-red-50/50' : 'border-botanical-sepia/15 shadow-inner'} rounded-[2rem] p-6 relative overflow-hidden transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300`}
                        >
                            <label className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-botanical-forest font-semibold mb-6">
                                <PenTool className="w-4 h-4" />
                                Your Bio
                            </label>

                            <div className="relative">
                                {/* Elegant Lines background */}
                                <div className="absolute inset-0 pointer-events-none opacity-40 md:mix-blend-multiply"
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
                                    maxLength={160}
                                    rows={4}
                                    placeholder="Reflect on your journey..."
                                    className={`w-full bg-transparent border-none outline-none font-serif text-[19px] leading-[40px] resize-none placeholder:text-botanical-sepia/40 px-1 relative z-10 ${bioError ? 'text-red-900' : 'text-claude-text'}`}
                                    style={{ lineHeight: '40px' }}
                                />
                            </div>

                            <div className="flex justify-between items-end mt-4">
                                <AnimatePresence>
                                    {bioError && (
                                        <motion.span
                                            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                                            className="text-[10px] font-mono text-red-500 bg-red-500/10 px-2 py-1 rounded"
                                        >
                                            Bio cannot be empty
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                                <div className={`text-[11px] font-mono ml-auto ${bioError ? 'text-red-400' : 'text-botanical-sepia/60'} ${bio.length >= 150 ? 'text-amber-500' : ''}`}>
                                    {bio.length} / 160
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Avatar Picker Modal */}
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
