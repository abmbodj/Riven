import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Camera, User, Mail, FileText } from 'lucide-react';
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
            toast.success('Profile updated');
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
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-claude-border sticky top-0 bg-claude-bg/80 backdrop-blur z-10">
                <button
                    onClick={() => navigate('/account')}
                    className="p-2 hover:bg-claude-surface rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-claude-text" />
                </button>
                <h1 className="text-lg font-display font-bold text-claude-text">Edit Profile</h1>
                <div className="ml-auto">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-botanical-forest text-white rounded-full text-sm font-medium disabled:opacity-50 active:scale-95 transition-all flex items-center gap-2"
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
            </div>

            <div className="p-4 max-w-md mx-auto space-y-6">
                {/* Avatar Section */}
                <div className="flex justify-center mb-8">
                    <button
                        onClick={() => setShowAvatarPicker(true)}
                        className="relative group"
                    >
                        <Avatar src={avatar} size="3xl" className="border-4 border-claude-bg shadow-xl" />
                        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-active:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera className="w-8 h-8 text-white" />
                        </div>
                        <div className="absolute -bottom-2 right-0 p-2 bg-claude-surface rounded-full border-2 border-claude-bg shadow-md">
                            <Camera className="w-4 h-4 text-claude-text" />
                        </div>
                    </button>
                </div>

                {/* Read-Only Fields */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-botanical-sepia mb-2">
                            Username
                        </label>
                        <div className="flex items-center gap-3 p-3 bg-claude-surface/50 border border-claude-border rounded-xl opacity-70">
                            <User className="w-5 h-5 text-claude-secondary" />
                            <span className="text-claude-text font-mono">{user.username}</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-botanical-sepia mb-2">
                            Email
                        </label>
                        <div className="flex items-center gap-3 p-3 bg-claude-surface/50 border border-claude-border rounded-xl opacity-70">
                            <Mail className="w-5 h-5 text-claude-secondary" />
                            <span className="text-claude-text font-mono">{user.email}</span>
                        </div>
                    </div>
                </div>

                {/* Editable Fields */}
                <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-botanical-sepia mb-2">
                        Bio
                    </label>
                    <div className="relative">
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            maxLength={160}
                            rows={4}
                            placeholder="Tell us about yourself..."
                            className="w-full p-4 bg-claude-surface border border-claude-border rounded-xl focus:border-botanical-forest outline-none text-claude-text resize-none font-sans"
                        />
                        <div className="absolute bottom-3 right-3 text-xs text-botanical-sepia">
                            {bio.length}/160
                        </div>
                    </div>
                </div>
            </div>

            {/* Avatar Picker Modal */}
            {showAvatarPicker && (
                <div className="fixed inset-0 bg-black/80 z-[50] flex items-center justify-center p-4">
                    <div className="bg-claude-surface rounded-2xl w-full max-w-md p-6 relative">
                        <button
                            onClick={() => setShowAvatarPicker(false)}
                            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full"
                        >
                            ✕
                        </button>
                        <AvatarPicker
                            currentAvatar={avatar}
                            onSelect={(url) => {
                                setAvatar(url);
                                setShowAvatarPicker(false);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
