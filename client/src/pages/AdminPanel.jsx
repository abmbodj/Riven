import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useHaptics } from '../hooks/useHaptics';
import AlertModal from '../components/AlertModal';

export default function AdminPanel() {
    const navigate = useNavigate();
    const { lightHaptic, mediumHaptic } = useHaptics();
    const { 
        isAdmin, 
        getAllUsers, 
        adminUpdateUser, 
        adminDeleteUser,
        adminGetUserStreakData,
        adminUpdateStreakData
    } = useContext(AuthContext);

    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [streakData, setStreakData] = useState(null);
    const [editingStreak, setEditingStreak] = useState(false);
    const [editedStreak, setEditedStreak] = useState({ currentStreak: 0, longestStreak: 0 });
    const [alert, setAlert] = useState(null);
    const [activeTab, setActiveTab] = useState('users');

    // Redirect non-admins
    useEffect(() => {
        if (!isAdmin) {
            navigate('/');
        }
    }, [isAdmin, navigate]);

    // Load users
    useEffect(() => {
        if (isAdmin) {
            const loadData = async () => {
                const usersData = await getAllUsers();
                setUsers(usersData || []);
                const streak = adminGetUserStreakData();
                setStreakData(streak);
                if (streak) {
                    setEditedStreak({
                        currentStreak: streak.currentStreak || 0,
                        longestStreak: streak.longestStreak || 0
                    });
                }
            };
            loadData();
        }
    }, [isAdmin, getAllUsers, adminGetUserStreakData]);

    const handleDeleteUser = async (userId, username) => {
        mediumHaptic();
        if (confirm(`Delete user "${username}"? This cannot be undone.`)) {
            try {
                await adminDeleteUser(userId);
                const usersData = await getAllUsers();
                setUsers(usersData || []);
                setSelectedUser(null);
                setAlert({ type: 'success', title: 'User Deleted', message: `${username} has been removed.` });
            } catch (err) {
                setAlert({ type: 'error', title: 'Error', message: err.message });
            }
        }
    };

    // eslint-disable-next-line no-unused-vars
    const handleUpdateUser = async (userId, updates) => {
        try {
            await adminUpdateUser(userId, updates);
            const usersData = await getAllUsers();
            setUsers(usersData || []);
            setAlert({ type: 'success', title: 'Updated', message: 'User profile updated.' });
        } catch (err) {
            setAlert({ type: 'error', title: 'Error', message: err.message });
        }
    };

    const handleSaveStreak = () => {
        mediumHaptic();
        try {
            const newData = {
                ...streakData,
                currentStreak: parseInt(editedStreak.currentStreak) || 0,
                longestStreak: parseInt(editedStreak.longestStreak) || 0,
            };
            adminUpdateStreakData(newData);
            setStreakData(newData);
            setEditingStreak(false);
            setAlert({ type: 'success', title: 'Streak Updated', message: 'Gmail streak data has been saved.' });
        } catch (err) {
            setAlert({ type: 'error', title: 'Error', message: err.message });
        }
    };

    const handleResetStreak = () => {
        mediumHaptic();
        if (confirm('Reset all streak data? This will set both current and longest streak to 0.')) {
            const newData = {
                currentStreak: 0,
                longestStreak: 0,
                lastStudyDate: null,
                ghostStage: 'baby',
                customization: streakData?.customization || {}
            };
            adminUpdateStreakData(newData);
            setStreakData(newData);
            setEditedStreak({ currentStreak: 0, longestStreak: 0 });
            setAlert({ type: 'success', title: 'Reset Complete', message: 'Streak data has been reset.' });
        }
    };

    if (!isAdmin) return null;

    return (
        <div className="min-h-screen pb-24 bg-[var(--color-background)]">
            {/* Header */}
            <div className="sticky top-0 z-10 px-4 py-4 bg-[var(--color-surface)] border-b border-[var(--color-border)] safe-area-top">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-xl">
                        🛡️
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[var(--color-text)]">Admin Panel</h1>
                        <p className="text-xs text-[var(--color-text-secondary)]">System Management</p>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <button
                    onClick={() => { lightHaptic(); setActiveTab('users'); }}
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors touch-target ${
                        activeTab === 'users' 
                            ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]' 
                            : 'text-[var(--color-text-secondary)]'
                    }`}
                >
                    👥 Users ({users.length})
                </button>
                <button
                    onClick={() => { lightHaptic(); setActiveTab('gmail'); }}
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors touch-target ${
                        activeTab === 'gmail' 
                            ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]' 
                            : 'text-[var(--color-text-secondary)]'
                    }`}
                >
                    👻 Gmail Data
                </button>
                <button
                    onClick={() => { lightHaptic(); setActiveTab('perks'); }}
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors touch-target ${
                        activeTab === 'perks' 
                            ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]' 
                            : 'text-[var(--color-text-secondary)]'
                    }`}
                >
                    ✨ Perks
                </button>
            </div>

            <div className="p-4">
                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className="space-y-3">
                        <div className="p-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]">
                            <p className="text-sm text-[var(--color-text-secondary)]">
                                Manage registered user accounts. Click a user to see details.
                            </p>
                        </div>

                        {users.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-4xl mb-2">👤</p>
                                <p className="text-[var(--color-text-secondary)]">No registered users yet</p>
                            </div>
                        ) : (
                            users.map(u => (
                                <div
                                    key={u.id}
                                    onClick={() => { lightHaptic(); setSelectedUser(selectedUser?.id === u.id ? null : u); }}
                                    className={`p-4 rounded-xl border transition-all touch-target native-press ${
                                        selectedUser?.id === u.id 
                                            ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]' 
                                            : 'bg-[var(--color-surface)] border-[var(--color-border)]'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-white text-lg font-bold">
                                            {u.avatar || u.username?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-[var(--color-text)] truncate">{u.username}</p>
                                            <p className="text-sm text-[var(--color-text-secondary)] truncate">{u.email}</p>
                                        </div>
                                        <div className="text-xs text-[var(--color-text-secondary)]">
                                            {new Date(u.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>

                                    {selectedUser?.id === u.id && (
                                        <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-3">
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <span className="text-[var(--color-text-secondary)]">ID:</span>
                                                    <p className="font-mono text-xs text-[var(--color-text)] truncate">{u.id}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[var(--color-text-secondary)]">Share Code:</span>
                                                    <p className="font-mono text-[var(--color-text)]">{u.shareCode}</p>
                                                </div>
                                            </div>
                                            {u.bio && (
                                                <div className="text-sm">
                                                    <span className="text-[var(--color-text-secondary)]">Bio:</span>
                                                    <p className="text-[var(--color-text)]">{u.bio}</p>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <span className="text-[var(--color-text-secondary)]">Shared Decks:</span>
                                                    <p className="text-[var(--color-text)]">{u.sharedDecks?.length || 0}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[var(--color-text-secondary)]">Received:</span>
                                                    <p className="text-[var(--color-text)]">{u.receivedDecks?.length || 0}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id, u.username); }}
                                                className="w-full py-2 px-4 bg-red-500 text-white rounded-lg text-sm font-medium touch-target native-press"
                                            >
                                                Delete User
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Gmail Data Tab */}
                {activeTab === 'gmail' && (
                    <div className="space-y-4">
                        <div className="p-4 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]">
                            <h3 className="font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2">
                                👻 Gmail Streak Data
                            </h3>

                            {streakData ? (
                                <div className="space-y-4">
                                    {editingStreak ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-sm text-[var(--color-text-secondary)]">Current Streak</label>
                                                <input
                                                    type="number"
                                                    value={editedStreak.currentStreak}
                                                    onChange={(e) => setEditedStreak(prev => ({ ...prev, currentStreak: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)]"
                                                    min="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm text-[var(--color-text-secondary)]">Longest Streak</label>
                                                <input
                                                    type="number"
                                                    value={editedStreak.longestStreak}
                                                    onChange={(e) => setEditedStreak(prev => ({ ...prev, longestStreak: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)]"
                                                    min="0"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleSaveStreak}
                                                    className="flex-1 py-2 px-4 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium touch-target native-press"
                                                >
                                                    Save Changes
                                                </button>
                                                <button
                                                    onClick={() => { lightHaptic(); setEditingStreak(false); }}
                                                    className="py-2 px-4 bg-[var(--color-surface-elevated)] text-[var(--color-text)] rounded-lg text-sm font-medium border border-[var(--color-border)] touch-target native-press"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-3 bg-[var(--color-background)] rounded-lg text-center">
                                                    <p className="text-2xl font-bold text-[var(--color-primary)]">{streakData.currentStreak || 0}</p>
                                                    <p className="text-xs text-[var(--color-text-secondary)]">Current Streak</p>
                                                </div>
                                                <div className="p-3 bg-[var(--color-background)] rounded-lg text-center">
                                                    <p className="text-2xl font-bold text-orange-500">{streakData.longestStreak || 0}</p>
                                                    <p className="text-xs text-[var(--color-text-secondary)]">Longest Streak</p>
                                                </div>
                                            </div>

                                            <div className="text-sm text-[var(--color-text-secondary)] space-y-1">
                                                <p>Ghost Stage: <span className="text-[var(--color-text)]">{streakData.ghostStage || 'baby'}</span></p>
                                                <p>Last Study: <span className="text-[var(--color-text)]">{streakData.lastStudyDate || 'Never'}</span></p>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { lightHaptic(); setEditingStreak(true); }}
                                                    className="flex-1 py-2 px-4 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium touch-target native-press"
                                                >
                                                    Edit Streak
                                                </button>
                                                <button
                                                    onClick={handleResetStreak}
                                                    className="py-2 px-4 bg-red-500 text-white rounded-lg text-sm font-medium touch-target native-press"
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <p className="text-[var(--color-text-secondary)] text-center py-4">
                                    No streak data found. Start studying to create Gmail data!
                                </p>
                            )}
                        </div>

                        <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
                            <p className="text-sm text-yellow-600 dark:text-yellow-400">
                                ⚠️ Changes to streak data take effect immediately. Modifying the longest streak will affect which accessories are unlocked for all users.
                            </p>
                        </div>
                    </div>
                )}

                {/* Perks Tab */}
                {activeTab === 'perks' && (
                    <div className="space-y-4">
                        <div className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
                            <div className="text-center mb-4">
                                <p className="text-4xl mb-2">👑</p>
                                <h3 className="font-bold text-lg text-[var(--color-text)]">Admin Privileges Active</h3>
                                <p className="text-sm text-[var(--color-text-secondary)]">All Gmail perks are unlocked!</p>
                            </div>
                        </div>

                        <div className="p-4 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]">
                            <h4 className="font-semibold text-[var(--color-text)] mb-3">🎨 Unlocked Accessories</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {[
                                    { name: 'Sparkles', days: 5 },
                                    { name: 'Wizard Hat', days: 7 },
                                    { name: 'Scarf', days: 10 },
                                    { name: 'Glasses', days: 14 },
                                    { name: 'Hearts', days: 15 },
                                    { name: 'Monocle', days: 21 },
                                    { name: 'Bowtie', days: 25 },
                                    { name: 'Graduation Cap', days: 30 },
                                    { name: 'Stars', days: 35 },
                                    { name: 'Sunglasses', days: 45 },
                                    { name: 'Cape', days: 50 },
                                    { name: 'Crown', days: 60 },
                                    { name: 'Rainbow', days: 75 },
                                    { name: 'Halo', days: 100 },
                                ].map(item => (
                                    <div key={item.name} className="flex items-center gap-2 p-2 bg-[var(--color-background)] rounded-lg">
                                        <span className="text-green-500">✓</span>
                                        <span className="text-[var(--color-text)]">{item.name}</span>
                                        <span className="text-xs text-[var(--color-text-secondary)] ml-auto">{item.days}d</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]">
                            <h4 className="font-semibold text-[var(--color-text)] mb-3">🎨 Unlocked Color Palettes</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {['Classic', 'Sunset', 'Ocean', 'Forest', 'Galaxy', 'Candy'].map(palette => (
                                    <div key={palette} className="p-2 bg-[var(--color-background)] rounded-lg text-center">
                                        <span className="text-green-500 text-xs">✓</span>
                                        <p className="text-sm text-[var(--color-text)]">{palette}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/30">
                            <p className="text-sm text-green-600 dark:text-green-400">
                                ✅ As an admin, you can access all Gmail customization options regardless of streak progress. Enjoy your ghost pet!
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Alert Modal */}
            {alert && (
                <AlertModal
                    type={alert.type}
                    title={alert.title}
                    message={alert.message}
                    onClose={() => setAlert(null)}
                />
            )}
        </div>
    );
}