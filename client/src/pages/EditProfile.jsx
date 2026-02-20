import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Camera, User, Mail, Leaf, PenTool } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import Avatar from '../components/Avatar';
import AvatarPicker from '../components/AvatarPicker';
import LoadingSpinner from '../components/LoadingSpinner';

export default function EditProfile() {
    const { user, updateProfile } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();

    const [bio, setBio] = useState(user?.bio || '');
    const [avatar, setAvatar] = useState(user?.avatar || '');
    const [saving, setSaving] = useState(false);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        haptics.medium();

        try {
            await updateProfile({ bio, avatar });
            toast.success('Journal updated');
            navigate('/account');
        } catch (err) {
            haptics.error();
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    if (!user) return <LoadingSpinner />;

    return (
        <div className="min-h-screen bg-claude-bg pb-24 animate-in fade-in duration-300">
            {/* Organic Header */}
            <div className="relative h-40 overflow-hidden mb-6 rounded-b-[3rem]">
                <div className="absolute inset-0 bg-[#0f2026] rounded-b-[3rem]"></div>
                <div className="absolute top-[-50%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(122,158,114,0.1),transparent_60%)] blur-3xl rounded-b-[3rem]" />

                {/* Navigation / Actions */}
                <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 safe-area-top">
                    <button
                        onClick={() => navigate('/account')}
                        className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white/90 hover:bg-black/30 transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-botanical-forest text-white rounded-full text-sm font-bold tracking-wide shadow-lg shadow-botanical-forest/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save
                            </>
                        )}
                    </button>
                </div>

                <div className="absolute bottom-4 left-6">
                    <h1 className="text-3xl font-display text-white/90">Edit Profile</h1>
                </div>

                <Leaf className="absolute -bottom-8 -right-8 w-40 h-40 text-botanical-forest/5 rotate-12" />
            </div>

            <div className="px-6 max-w-md mx-auto space-y-10">
                {/* Avatar Section */}
                <div className="flex justify-center">
                    <button
                        onClick={() => setShowAvatarPicker(true)}
                        className="relative group"
                    >
                        <div className="p-1 rounded-full border-2 border-dashed border-botanical-sepia/30">
                            <Avatar src={avatar} size="3xl" className="border-4 border-claude-bg shadow-2xl" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 p-2.5 bg-botanical-forest text-white rounded-full shadow-lg group-active:scale-90 transition-transform">
                            <Camera className="w-5 h-5" />
                        </div>
                    </button>
                </div>

                {/* Form Fields - Journal Style */}
                <div className="space-y-8">
                    {/* Read Only Info */}
                    <div className="grid grid-cols-1 gap-6 opacity-60">
                        <div className="border-b border-botanical-sepia/20 pb-2">
                            <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-botanical-sepia mb-1">
                                <User className="w-3 h-3" />
                                Username
                            </label>
                            <div className="font-display text-lg text-claude-text pl-5">
                                {user.username}
                            </div>
                        </div>

                        <div className="border-b border-botanical-sepia/20 pb-2">
                            <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-botanical-sepia mb-1">
                                <Mail className="w-3 h-3" />
                                Email
                            </label>
                            <div className="font-display text-lg text-claude-text pl-5">
                                {user.email}
                            </div>
                        </div>
                    </div>

                    {/* Bio Input - Lined Paper Look */}
                    <div className="relative">
                        <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-botanical-sepia mb-4 text-botanical-forest">
                            <PenTool className="w-3 h-3" />
                            Your Bio
                        </label>

                        <div className="relative">
                            {/* Lines background */}
                            <div className="absolute inset-0 pointer-events-none"
                                style={{
                                    backgroundImage: 'linear-gradient(transparent 31px, rgba(143, 166, 168, 0.1) 32px)',
                                    backgroundSize: '100% 32px',
                                    marginTop: '6px'
                                }}
                            />

                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                maxLength={160}
                                rows={5}
                                placeholder="Reflect on your journey..."
                                className="w-full bg-transparent border-none outline-none text-claude-text font-serif text-lg leading-[32px] resize-none placeholder:text-botanical-sepia/30 px-2 -ml-2"
                                style={{ lineHeight: '32px' }}
                            />
                        </div>

                        <div className="text-right mt-2 text-xs font-mono text-botanical-sepia">
                            {bio.length} / 160
                        </div>
                    </div>
                </div>
            </div>

            {/* Avatar Picker Modal */}
            {showAvatarPicker && (
                <AvatarPicker
                    currentAvatar={avatar}
                    onSelect={(url) => {
                        setAvatar(url);
                        setShowAvatarPicker(false);
                    }}
                    onClose={() => setShowAvatarPicker(false)}
                />
            )}
        </div>
    );
}
