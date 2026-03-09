import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Play, Folder, FileText, Upload, Zap, Activity, X, ChevronLeft, Users, Settings, Trash2, Shield, LogOut, Copy, CheckCircle2, Layers, MoreVertical, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../hooks/useToast';
import { api } from '../api';
import ConfirmModal from '../components/ConfirmModal';
import ReportModal from '../components/ui/ReportModal';
import useHaptics from '../hooks/useHaptics';
import { useAuth } from '../hooks/useAuth';
import * as authApi from '../api/authApi';
import PricingModal from '../components/ui/PricingModal';

export default function GroupDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const haptics = useHaptics();
    const toast = useToast();
    const { socket, user } = useAuth();
    const [group, setGroup] = useState(null);
    const [members, setMembers] = useState([]);
    const [sharedDecks, setSharedDecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPricingModal, setShowPricingModal] = useState(false);

    const currentUserId = user?.id;
    const isAdmin = group?.my_role === 'admin';
    const isBanned = user?.is_banned;

    const [showSettings, setShowSettings] = useState(false);
    const [showShareDeckModal, setShowShareDeckModal] = useState(false);

    // Files & Folders
    const [folders, setFolders] = useState([]);
    const [files, setFiles] = useState([]);
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);

    // Upload & AI Flow
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadStep, setUploadStep] = useState('form'); // form, ai_prompt, generating
    const [uploadData, setUploadData] = useState({ name: '', file_url: '', file_type: 'pdf' });
    const [newFolderName, setNewFolderName] = useState('');

    // Decks user currently owns and can share
    const [myDecks, setMyDecks] = useState([]);

    // Active Cram Sessions
    const [sessions, setSessions] = useState([]);

    const [editData, setEditData] = useState({ name: '', class_id: '' });
    const [classes, setClasses] = useState([]);
    const [copied, setCopied] = useState(false);

    const [isDeleting, setIsDeleting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Reporting & Blocking
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReporting, setIsReporting] = useState(false);
    const [reportingUserId, setReportingUserId] = useState(null);
    const [isBlocking, setIsBlocking] = useState(false);
    const [activeMemberMenuId, setActiveMemberMenuId] = useState(null);

    const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', action: null });

    const loadGroup = useCallback(async () => {
        try {
            const [groupRes, membersRes, decksRes, sessionsRes] = await Promise.all([
                api.getGroupInfo(id),
                api.getGroupMembers(id),
                api.getGroupDecks(id),
                api.getGroupSessions(id)
            ]);
            setGroup(groupRes);
            setMembers(membersRes || []);
            setSharedDecks(decksRes || []);
            setSessions(sessionsRes || []);

            // Load folders and files
            const fetchedFolders = await api.getGroupFolders(id);
            setFolders(fetchedFolders || []);
            const fetchedFiles = await api.getGroupFiles(id, currentFolderId);
            setFiles(fetchedFiles || []);

        } catch (err) {
            console.error(err);
            toast.error('Failed to load group details');
            navigate('/groups');
        } finally {
            setLoading(false);
        }
    }, [id, currentFolderId, navigate, toast]);

    useEffect(() => {
        loadGroup();

        // Listen for real-time session events
        const onSessionStarted = (data) => {
            // New session started in this group
            if (data && data.sessionId) {
                loadGroup(); // refresh to get full session details from DB
                toast('A live cram session just started!', { icon: '🔥' });
            }
        };

        const onSessionEnded = () => {
            loadGroup(); // refresh
        };

        if (socket) {
            socket.on(`group-${id}-session-started`, onSessionStarted);
            socket.on('session-ended', onSessionEnded); // if this socket was also in the room
        }

        return () => {
            if (socket) {
                socket.off(`group-${id}-session-started`, onSessionStarted);
                socket.off('session-ended', onSessionEnded);
            }
        };

    }, [id, loadGroup, socket]);

    useEffect(() => {
        if (showSettings) {
            api.getClasses().then(res => setClasses(res || []));
            setEditData({ name: group?.name || '', class_id: group?.class_id || '' });
        }
    }, [showSettings, group]);

    useEffect(() => {
        if (showShareDeckModal) {
            api.getDecks().then(res => setMyDecks(res || []));
        }
    }, [showShareDeckModal]);

    const handleCopyCode = async () => {
        if (!group?.join_code) return;
        try {
            await navigator.clipboard.writeText(group.join_code);
            haptics.light();
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success('Join code copied!');
        } catch (err) {
            toast.error('Failed to copy');
        }
    };

    const handleUpdateGroup = async (e) => {
        e.preventDefault();
        if (!editData.name.trim()) return toast.error('Name is required');

        try {
            await api.updateGroup(id, { name: editData.name, class_id: editData.class_id || null });
            toast.success('Group updated');
            setShowSettings(false);

            // Clear current group state to avoid stale class labels
            setGroup(null);
            loadGroup();
        } catch (err) {
            toast.error(err.message || 'Failed to update');
        }
    };

    const handleRegenerateCode = async () => {
        try {
            await api.updateGroup(id, { regenerate_code: true });
            toast.success('Join code regenerated');
            loadGroup();
        } catch (err) {
            toast.error(err.message || 'Failed to regenerate code');
        }
    };

    const confirmAction = (title, message, action) => {
        if (haptics && haptics.medium) haptics.medium();
        setConfirmModal({ show: true, title, message, action });
    };

    const handleConfirmAction = async () => {
        try {
            await confirmModal.action();
            setConfirmModal({ show: false, title: '', message: '', action: null });
        } catch (err) {
            toast.error(err.message || 'Action failed');
            setConfirmModal({ show: false, title: '', message: '', action: null });
        }
    };

    const handleLeave = () => {
        confirmAction('Leave Group', 'Are you sure you want to leave this group?', async () => {
            await api.leaveGroup(id);
            toast.success('Left group');
            navigate('/groups');
        });
    };

    const handleDelete = () => {
        confirmAction('Delete Group', 'This will permanently remove the group and all its contents.', async () => {
            await api.deleteGroup(id);
            toast.success('Group deleted');
            navigate('/groups');
        });
    };

    const handleRemoveMember = (userId, name) => {
        confirmAction('Remove Member', `Remove ${name} from the group?`, async () => {
            // Optimistic UI
            const prevMembers = [...members];
            setMembers(members.filter(m => m.id !== userId));
            try {
                await api.removeGroupMember(id, userId);
                toast.success('Member removed');
                loadGroup(); // Silent background sync
            } catch (err) {
                setMembers(prevMembers); // Rollback
                toast.error('Failed to remove member');
            }
        });
    };

    const handleBlockUser = (userId, name) => {
        confirmAction('Block User', `Are you sure you want to block ${name}? They will no longer be able to interact with you.`, async () => {
            setIsBlocking(true);
            try {
                await authApi.blockUser(userId);
                toast.success('User blocked successfully');
                // Refresh group to potentially clear blocked user's content (if backend filters it)
                loadGroup();
            } catch (err) {
                toast.error(err.message || 'Failed to block user');
            } finally {
                setIsBlocking(false);
            }
        });
    };

    const handleReportUserSubmit = async (reason, details) => {
        setIsReporting(true);
        try {
            await authApi.reportContent({
                reportedUserId: reportingUserId,
                contentType: 'user',
                contentId: reportingUserId,
                reason,
                details
            });
            toast.success('Report submitted successfully. Thank you for keeping Riven safe.');
            setIsReportModalOpen(false);
            setReportingUserId(null);
        } catch (err) {
            toast.error(err.message || 'Failed to submit report');
        } finally {
            setIsReporting(false);
        }
    };

    const handleShareDeck = async (deckId) => {
        try {
            haptics.medium();
            await api.shareDeckToGroup(id, deckId);
            toast.success('Deck shared with group!');
            setShowShareDeckModal(false);
            loadGroup();
        } catch (err) {
            toast.error(err.message || 'Failed to share deck');
        }
    };

    const handleRemoveDeck = (deckId) => {
        confirmAction('Remove Deck', 'Are you sure you want to remove this deck from the group?', async () => {
            // Optimistic UI
            const prevDecks = [...sharedDecks];
            setSharedDecks(sharedDecks.filter(d => d.id !== deckId));
            try {
                await api.removeDeckFromGroup(id, deckId);
                toast.success('Deck removed');
                loadGroup(); // Sync
            } catch (err) {
                setSharedDecks(prevDecks); // Rollback
                toast.error('Failed to remove deck');
            }
        });
    };

    const handleEndSession = (sessionId) => {
        confirmAction('End Session', 'Are you sure you want to end this session for everyone?', async () => {
            await api.endGroupSession(sessionId);
            toast.success('Session ended');
            loadGroup();
        });
    };

    const handleCreateFolder = async (e) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;
        try {
            await api.createGroupFolder(id, newFolderName.trim());
            toast.success('Folder created');
            setShowCreateFolderModal(false);
            setNewFolderName('');
            loadGroup();
        } catch (err) {
            toast.error('Failed to create folder');
        }
    };


    const handleDeleteFolder = (e, folderId) => {
        e.stopPropagation();
        confirmAction('Delete Folder', 'This will delete the folder and all files inside it.', async () => {
            // Optimistic UI
            const prevFolders = [...folders];
            setFolders(folders.filter(f => f.id !== folderId));
            try {
                await api.deleteGroupFolder(id, folderId);
                toast.success('Folder deleted');
                if (currentFolderId === folderId) setCurrentFolderId(null);
                loadGroup(); // Sync
            } catch (err) {
                setFolders(prevFolders); // Rollback
                toast.error('Failed to delete folder');
            }
        });
    };

    const handleUploadInitialSubmit = (e) => {
        e.preventDefault();
        if (!uploadData.name.trim() || !uploadData.file) return toast.error('Name and file required');
        setUploadStep('ai_prompt');
    };

    const finalizeFileUpload = async () => {
        try {
            // TODO: Implement real file storage (S3/Supabase Storage) for actual file hosting.
            // Currently stores a metadata-only reference — no file content is persisted.
            const referenceUrl = `file-ref://${Date.now()}_${encodeURIComponent(uploadData.file?.name || uploadData.name)}`;

            await api.uploadGroupFile(id, {
                name: uploadData.name,
                file_url: referenceUrl,
                file_type: uploadData.file_type || 'pdf',
                folder_id: currentFolderId
            });
            toast.success('File uploaded');
            closeUploadModal();
            loadGroup();
        } catch (err) {
            toast.error('Failed to upload file');
            setUploadStep('form');
        }
    };

    const handleUploadWithAi = async () => {
        setUploadStep('generating');
        try {
            // Wait for AI generation
            const deckRes = await api.generateAiDeck(
                `File reference: ${uploadData.file?.name} `,
                null,
                `${uploadData.name} Flashcards`,
                group?.class_id
            );

            if (deckRes && deckRes.deck_id) {
                // Instantly share the new deck to this group
                await api.shareDeckToGroup(id, deckRes.deck_id);
                toast.success(`Deck generated with ${deckRes.card_count || 'several'} cards!`);
            }

            // Finally proceed to upload the file
            await finalizeFileUpload();

        } catch (err) {
            if (err.status === 429) {
                setShowPricingModal(true);
            } else {
                toast.error(err.message || 'AI Generation failed, falling back to upload-only');
            }
            // If AI specifically fails, still save the file
            await finalizeFileUpload();
        }
    };

    const closeUploadModal = () => {
        setShowUploadModal(false);
        setTimeout(() => {
            setUploadStep('form');
            setUploadData({ name: '', file: null, file_type: 'pdf' });
        }, 300);
    };

    const handleDeleteFile = (e, fileId) => {
        e.stopPropagation();
        confirmAction('Remove File', 'Are you sure you want to remove this file?', async () => {
            // Optimistic UI
            const prevFiles = [...files];
            setFiles(files.filter(f => f.id !== fileId));
            try {
                await api.deleteGroupFile(id, fileId);
                toast.success('File removed');
                loadGroup(); // Sync
            } catch (err) {
                setFiles(prevFiles); // Rollback
                toast.error('Failed to remove file');
            }
        });
    };

    const handleStartSession = async (deckId) => {
        try {
            haptics.medium();
            const session = await api.startGroupSession(id, deckId);
            toast.success('Cram session started!');
            navigate(`/groups/${id}/cram/${session.id}`);
        } catch (err) {
            toast.error(err.message || 'Failed to start session');
        }
    };

    // Assuming 'user' is available from a context or prop
    // For example: const { user } = useAuth();
    if (user?.is_banned) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center sm:max-w-md sm:mx-auto">
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                    <ShieldAlert className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-display font-bold text-claude-text mb-3">Group Access Restricted</h2>
                <p className="text-sm text-claude-secondary leading-relaxed max-w-xs">
                    Your account has been restricted from using social features due to a violation of our community guidelines.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-6 pt-4 pb-24 min-h-screen space-y-4">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-claude-border rounded-xl animate-pulse" />
                    <div className="h-8 w-48 bg-claude-border rounded-xl animate-pulse" />
                </div>
                <div className="h-40 bg-[#fcfaf2] border border-[#d1c9b8] rounded-xl animate-pulse" />
            </div>
        );
    }

    if (!group) return null;

    return (
        <>
            <div className="relative min-h-screen pb-24">
                {/* Botanical Premium Header */}
                <div className="relative w-full h-[180px] sm:h-[220px] overflow-hidden bg-[#1a3329]">
                    <div className="absolute inset-0 bg-gradient-to-br from-botanical-forest via-[#224536] to-[#12261b]" />
                    <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23deb96a' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-claude-bg to-transparent" />
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20">
                        <button onClick={() => navigate('/groups')} className="w-10 h-10 glass-panel rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors tap-action md:backdrop-blur-md border border-white/20">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        {isAdmin ? (
                            <button onClick={() => setShowSettings(!showSettings)} className="w-10 h-10 glass-panel rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors tap-action md:backdrop-blur-md border border-white/20">
                                <Settings className="w-5 h-5" />
                            </button>
                        ) : (
                            <button onClick={handleLeave} className="w-10 h-10 glass-panel rounded-full flex items-center justify-center text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-colors tap-action md:backdrop-blur-md border border-red-500/30">
                                <LogOut className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="px-4 sm:px-6 -mt-16 relative z-10">
                    <div className="mb-8">
                        <h2 className="font-serif italic font-bold text-4xl sm:text-5xl text-botanical-parchment leading-tight drop-shadow-md break-words">{group.name}</h2>
                    </div>

                    {/* Dashboard Overview (Bento Grid) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        {/* Main Info Card */}
                        <div className="md:col-span-2 glass-panel rounded-[2rem] p-8 shadow-sm relative overflow-hidden group">
                            <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                            <div className="absolute -right-20 -top-20 w-64 h-64 bg-claude-accent/5 rounded-full blur-[60px] group-hover:bg-claude-accent/10 transition-colors duration-700 pointer-events-none" />

                            <div className="relative z-10">
                                <h3 className="font-mono text-[10px] uppercase font-bold tracking-[0.2em] text-claude-secondary mb-3">{group.class_name || 'Independent Study'}</h3>

                                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                                    <div>
                                        <p className="text-[11px] font-mono text-claude-secondary uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5" /> {members.length} Members
                                        </p>
                                        <div
                                            className="inline-flex items-center justify-center gap-3 px-5 py-3 glass-panel rounded-xl cursor-pointer hover:border-claude-accent/40 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action group/code"
                                            onClick={handleCopyCode}
                                        >
                                            <div>
                                                <span className="block text-[8px] font-mono text-claude-secondary uppercase tracking-widest leading-none mb-1">Cipher Code</span>
                                                <span className="font-mono text-lg font-bold tracking-[0.2em] text-claude-text">{group.join_code}</span>
                                            </div>
                                            {copied ? <CheckCircle2 className="w-5 h-5 text-claude-accent drop-shadow-[0_0_8px_rgba(222,185,106,0.5)]" /> : <Copy className="w-5 h-5 text-claude-secondary group-hover/code:text-claude-text transition-colors" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Cram Action Card */}
                        <div className="bg-claude-accent/10 border border-claude-accent/20 rounded-[2rem] p-6 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                            <div className="absolute inset-0 bg-gradient-to-br from-claude-accent/5 to-transparent pointer-events-none" />
                            <div className="relative z-10 flex-1 flex flex-col items-start justify-between">
                                <div className="w-10 h-10 bg-claude-bg/50 rounded-xl flex items-center justify-center border border-claude-accent/20 mb-4">
                                    <Zap className="w-5 h-5 text-claude-accent fill-current" />
                                </div>
                                <div className="w-full">
                                    <button
                                        onClick={() => setShowShareDeckModal(true)}
                                        className="w-full py-3.5 bg-claude-accent rounded-xl text-botanical-ink font-mono font-bold uppercase tracking-widest hover:bg-opacity-90 transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] tap-action shadow-sm md:shadow-lg shadow-claude-accent/20 text-[11px]"
                                    >
                                        Initiate Cram
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Live Cram Sessions */}
                    {sessions.length > 0 && (
                        <div className="space-y-4 mb-10">
                            <h3 className="font-serif italic text-2xl text-red-400 mb-4 flex items-center gap-3 font-bold">
                                <div className="relative flex items-center justify-center w-6 h-6">
                                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-30 animate-ping"></span>
                                    <Activity className="relative w-5 h-5" />
                                </div>
                                Live Sessions
                            </h3>
                            <AnimatePresence>
                                {sessions.map(session => (
                                    <motion.div
                                        key={session.id}
                                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        onClick={() => navigate(`/groups/${id}/cram/${session.id}`)}
                                        className="bg-red-500/10 md:backdrop-blur-md border border-red-500/30 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:bg-red-500/20 transition-[transform,opacity,color,background-color,border-color,box-shadow] group overflow-hidden relative shadow-[0_0_20px_rgba(239,68,68,0.1)]"
                                    >
                                        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent animate-scan" />
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-serif font-bold text-red-100 text-lg truncate group-hover:text-white transition-colors" title={session.deck_title}>{session.deck_title}</h4>
                                            </div>
                                            <p className="font-mono text-[9px] uppercase tracking-widest text-red-300 flex items-center gap-1.5 opacity-80 mt-1">
                                                <Users className="w-3 h-3" /> {session.active_members || 1} reading now
                                            </p>
                                        </div>
                                        <button className="px-5 py-2.5 bg-red-500 text-white rounded-xl font-mono text-[10px] uppercase tracking-widest font-bold shadow-[0_0_15px_rgba(239,68,68,0.4)] group-hover:bg-red-400 group-hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] transition-[transform,opacity,color,background-color,border-color,box-shadow] transform group-hover:-translate-y-0.5 whitespace-nowrap">
                                            Join
                                        </button>
                                        {isAdmin && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEndSession(session.id); }}
                                                className="ml-3 px-3 py-2.5 bg-claude-bg/50 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-xl font-mono text-[10px] uppercase tracking-widest font-bold transition-[transform,opacity,color,background-color,border-color,box-shadow] whitespace-nowrap tap-action"
                                            >
                                                End
                                            </button>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Shared Decks Bento Section */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-serif italic text-2xl text-claude-text flex items-center gap-2 font-bold">
                            <Layers className="w-6 h-6 text-claude-accent" /> Shared Decks <span className="text-claude-secondary ml-2 relative -top-1 font-mono text-sm not-italic opacity-50">({sharedDecks.length})</span>
                        </h3>
                        <button
                            onClick={() => setShowShareDeckModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-claude-accent/10 border border-claude-accent/30 text-claude-accent rounded-lg font-mono text-[9px] uppercase font-bold tracking-widest hover:bg-claude-accent hover:text-botanical-ink transition-colors tap-action"
                        >
                            <Plus className="w-3.5 h-3.5" /> Share
                        </button>
                    </div>

                    <div className="space-y-3 mb-10">
                        {sharedDecks.length === 0 ? (
                            <div className="text-center py-12 glass-panel border-dashed border-claude-border/50 rounded-2xl relative overflow-hidden">
                                <Layers className="w-8 h-8 mx-auto text-claude-secondary opacity-30 mb-3" />
                                <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-claude-secondary/60">No Decks Shared Yet</p>
                            </div>
                        ) : (
                            <AnimatePresence>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {sharedDecks.map((deck, i) => (
                                        <motion.div
                                            key={deck.id}
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="group/deck relative glass-panel rounded-[1.25rem] p-5 overflow-hidden shadow-sm hover:shadow-claude-accent/5 hover:border-claude-accent/30 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 tap-action flex items-start gap-4 hover:-translate-y-0.5"
                                        >
                                            <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />

                                            <div className="flex-1 min-w-0" onClick={() => navigate(`/deck/${deck.id}`)}>
                                                <h4 className="font-serif font-bold text-lg text-claude-text truncate leading-tight group-hover/deck:text-claude-accent transition-colors pr-8" title={deck.title}>{deck.title}</h4>

                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
                                                    <div className="flex items-center gap-1.5 glass-panel px-2 py-1 rounded-[0.4rem] border border-claude-border">
                                                        <Layers className="w-3 h-3 text-claude-accent opacity-70" />
                                                        <span className="font-mono text-[9px] uppercase font-bold tracking-widest text-claude-secondary">{deck.card_count || 0}</span>
                                                    </div>
                                                    <span className="font-mono text-[9px] text-claude-secondary uppercase tracking-widest truncate max-w-[120px]">
                                                        by @{deck.shared_by_name}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover/deck:opacity-100 transition-opacity absolute right-4 top-4">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleStartSession(deck.id); }}
                                                    className="w-8 h-8 bg-claude-accent/10 border border-claude-accent/30 text-claude-accent rounded-full flex items-center justify-center hover:bg-claude-accent hover:text-botanical-ink transition-colors tap-action"
                                                    title="Start Cram"
                                                >
                                                    <Zap className="w-3.5 h-3.5 fill-current" />
                                                </button>
                                                {isAdmin && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveDeck(deck.id); }}
                                                        className="w-8 h-8 bg-red-500/10 border border-red-500/20 text-red-400 hover:text-white hover:bg-red-500 transition-colors rounded-full flex items-center justify-center tap-action"
                                                        title="Remove Deck"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </AnimatePresence>
                        )}
                    </div>

                    {/* Shared Files & Folders */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-serif italic text-2xl text-claude-text flex items-center gap-2 font-bold">
                            <Folder className="w-6 h-6 text-claude-accent" /> Library
                        </h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowCreateFolderModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 glass-panel text-claude-secondary rounded-lg font-mono text-[9px] uppercase font-bold tracking-widest hover:text-white transition-colors tap-action"
                            >
                                <Plus className="w-3 h-3" /> Folder
                            </button>
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-claude-accent/10 border border-claude-accent/30 text-claude-accent rounded-lg font-mono text-[9px] uppercase font-bold tracking-widest hover:bg-claude-accent hover:text-botanical-ink transition-colors tap-action"
                            >
                                <Upload className="w-3 h-3" /> Upload
                            </button>
                        </div>
                    </div>

                    <div className="glass-panel rounded-2xl overflow-hidden mb-10 shadow-sm relative">
                        {currentFolderId && (
                            <div className="px-5 py-4 glass-panel border-b border-claude-border/50 flex items-center gap-2 bg-claude-surface/30">
                                <div
                                    onClick={() => setCurrentFolderId(null)}
                                    className="flex items-center gap-1.5 cursor-pointer hover:text-claude-text text-claude-secondary transition-colors group tap-action"
                                >
                                    <Folder className="w-4 h-4" />
                                    <span className="font-mono text-[10px] uppercase font-bold tracking-widest">Library</span>
                                </div>
                                <ChevronLeft className="w-3 h-3 text-claude-secondary/50 rotate-180" />
                                <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-claude-accent truncate max-w-[150px]" title={folders.find(f => f.id === currentFolderId)?.name}>
                                    {folders.find(f => f.id === currentFolderId)?.name || 'Folder'}
                                </span>
                            </div>
                        )}

                        {!currentFolderId && folders.length === 0 && files.length === 0 ? (
                            <div className="text-center py-16">
                                <FileText className="w-8 h-8 text-claude-secondary opacity-20 mx-auto mb-3" />
                                <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-claude-secondary/60">Directory is empty</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-claude-border/50 relative overflow-hidden">
                                <AnimatePresence initial={false}>
                                    {!currentFolderId && folders.map((folder, i) => (
                                        <motion.div
                                            key={`folder-${folder.id}`}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.98 }}
                                            transition={{ delay: i * 0.05 }}
                                            onClick={() => setCurrentFolderId(folder.id)}
                                            className="p-4 sm:p-5 flex items-center justify-between hover:glass-panel cursor-pointer transition-colors group relative bg-transparent"
                                        >
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-claude-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform">
                                                    <Folder className="w-5 h-5 text-amber-500/80" fill="currentColor" />
                                                </div>
                                                <div>
                                                    <h4 className="font-serif font-bold text-lg text-claude-text group-hover:text-claude-accent transition-colors leading-tight">{folder.name}</h4>
                                                    <p className="font-mono text-[9px] text-claude-secondary uppercase tracking-widest mt-1">{folder.file_count || 0} items • Created by @{folder.created_by_name}</p>
                                                </div>
                                            </div>
                                            {isAdmin && (
                                                <button onClick={(e) => handleDeleteFolder(e, folder.id)} className="w-8 h-8 flex items-center justify-center rounded-lg sm:opacity-0 sm:group-hover:opacity-100 text-claude-secondary hover:text-red-400 hover:bg-red-500/10 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </motion.div>
                                    ))}

                                    {files.map((file, i) => (
                                        <motion.div
                                            key={`file-${file.id}`}
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.98 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="p-4 sm:p-5 flex items-center justify-between hover:glass-panel transition-colors group"
                                        >
                                            <div className="flex items-center gap-4 min-w-0 pr-4">
                                                <div className="w-10 h-10 rounded-xl bg-claude-border/30 flex items-center justify-center border border-claude-border/50 shrink-0 group-hover:bg-claude-border/50 transition-colors">
                                                    <FileText className="w-5 h-5 text-claude-secondary" />
                                                </div>
                                                <div className="min-w-0">
                                                    <a href={file.file_url} target="_blank" rel="noreferrer" className="font-serif font-bold text-lg text-claude-text hover:text-claude-accent transition-colors truncate block leading-tight" title={file.name}>{file.name}</a>
                                                    <p className="font-mono text-[9px] text-claude-secondary uppercase tracking-widest mt-1 truncate">{file.file_type.toUpperCase()} • Added by @{file.uploaded_by_name}</p>
                                                </div>
                                            </div>
                                            {(isAdmin || file.uploaded_by === currentUserId) && (
                                                <button onClick={(e) => handleDeleteFile(e, file.id)} className="w-8 h-8 flex items-center justify-center rounded-lg sm:opacity-0 sm:group-hover:opacity-100 text-claude-secondary hover:text-red-400 hover:bg-red-500/10 transition-[transform,opacity,color,background-color,border-color,box-shadow] shrink-0 tap-action">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {currentFolderId && files.length === 0 && (
                                    <div className="p-12 text-center glass-panel">
                                        <Folder className="w-8 h-8 mx-auto text-claude-secondary opacity-30 mb-3" />
                                        <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-claude-secondary/70">Folder is empty</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Members List */}
                <h3 className="font-serif italic text-2xl text-claude-text mb-4 flex items-center gap-2 font-bold">
                    <Users className="w-6 h-6 text-claude-accent" /> Members <span className="text-claude-secondary ml-2 relative -top-1 font-mono text-sm not-italic opacity-50">({members.length})</span>
                </h3>

                <div className="space-y-3 pb-8">
                    <AnimatePresence>
                        {members.map(member => (
                            <motion.div
                                key={`member-${member.id}`}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex items-center justify-between p-4 glass-panel rounded-2xl hover:border-claude-border/80 transition-colors"
                            >
                                <div className="flex items-center gap-4 min-w-0 pr-4">
                                    <div className="w-12 h-12 rounded-2xl bg-claude-accent/10 flex items-center justify-center shrink-0 border border-claude-accent/20 p-1">
                                        <img src={member.avatar || 'https://api.dicebear.com/7.x/notionists/svg?seed=' + member.username} alt="avatar" className="w-full h-full rounded-xl bg-white object-cover" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-serif font-bold text-lg text-claude-text truncate leading-tight" title={member.display_name || member.username}>{member.display_name || member.username}</span>
                                        <span className="font-mono text-[9px] uppercase tracking-widest text-claude-secondary mt-1 flex items-center gap-2">
                                            @{member.username}
                                            {member.role === 'admin' && <span className="px-1.5 py-0.5 bg-claude-accent/10 text-claude-accent rounded border border-claude-accent/20 font-bold">ADMIN</span>}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 relative">
                                    {member.id !== currentUserId && (
                                        <div className="relative">
                                            <button
                                                onClick={() => setActiveMemberMenuId(activeMemberMenuId === member.id ? null : member.id)}
                                                className="w-8 h-8 shrink-0 flex items-center justify-center text-claude-secondary hover:text-claude-text hover:bg-claude-bg/50 transition-colors rounded-lg glass-panel"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {activeMemberMenuId === member.id && (
                                                <div className="absolute right-0 top-full mt-2 lg:bg-white/[0.02] lg:backdrop-blur-2xl border-white/[0.05] glass-panel rounded-xl shadow-sm md:shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden min-w-[140px] z-50 py-1">
                                                    {isAdmin && member.role !== 'admin' && (
                                                        <button
                                                            onClick={() => {
                                                                handleRemoveMember(member.id, member.username);
                                                                setActiveMemberMenuId(null);
                                                            }}
                                                            className="w-full px-4 py-3 sm:py-2 lg:py-3 text-[11px] font-mono uppercase tracking-widest font-bold text-left flex items-center gap-2 hover:bg-white/5 text-red-500/80 hover:text-red-500 transition-colors"
                                                        >
                                                            <LogOut className="w-4 h-4 opacity-70" /> Remove
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            handleBlockUser(member.id, member.username);
                                                            setActiveMemberMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-3 sm:py-2 lg:py-3 text-[11px] font-mono uppercase tracking-widest font-bold text-left flex items-center gap-2 hover:bg-white/5 lg:hover:bg-white/5 text-red-400/80 hover:text-red-400 transition-colors"
                                                    >
                                                        <Shield className="w-4 h-4 opacity-70" /> Block
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setReportingUserId(member.id);
                                                            setIsReportModalOpen(true);
                                                            setActiveMemberMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-3 sm:py-2 lg:py-3 text-[11px] font-mono uppercase tracking-widest font-bold text-left flex items-center gap-2 lg:hover:bg-white/5 text-claude-secondary hover:text-claude-text transition-colors"
                                                    >
                                                        <ShieldAlert className="w-4 h-4 opacity-70" /> Report
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Admin Settings Modal */}
            <AnimatePresence>
                {showSettings && isAdmin && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="absolute inset-0 bg-black/60 md:backdrop-blur-md" />
                        <motion.form
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            onSubmit={handleUpdateGroup}
                            className="relative bg-claude-bg w-full max-w-lg p-8 rounded-t-[3rem] sm:rounded-[3rem] border border-claude-border pb-safe max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-serif italic font-bold text-botanical-parchment">Group Settings</h3>
                                <button type="button" onClick={() => setShowSettings(false)} className="p-2 text-claude-secondary hover:text-white transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-[#7a9e72] font-bold mb-2 ml-1">Group Name</label>
                                    <input
                                        type="text"
                                        value={editData.name}
                                        onChange={e => setEditData({ ...editData, name: e.target.value })}
                                        className="w-full glass-panel border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-[#7a9e72] font-bold mb-2 ml-1">Associated Class</label>
                                    <select
                                        value={editData.class_id || ''}
                                        onChange={e => setEditData({ ...editData, class_id: e.target.value })}
                                        className="w-full glass-panel border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none appearance-none"
                                    >
                                        <option value="">No Class</option>
                                        {classes.map(cls => (
                                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-4 border-t border-claude-border space-y-3">
                                    <button
                                        type="button"
                                        onClick={handleRegenerateCode}
                                        className="w-full py-3 glass-panel rounded-xl text-claude-secondary font-mono text-xs uppercase tracking-widest font-bold hover:text-white transition-colors text-center"
                                    >
                                        Regenerate Join Code
                                    </button>
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="px-4 py-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 hover:bg-red-500/20 transition-colors"
                                >
                                    <Trash2 className="w-5 h-5 mx-auto" />
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-4 bg-claude-accent rounded-2xl text-[#162a31] font-mono font-bold uppercase tracking-widest hover:bg-opacity-90 transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] tap-action shadow-sm md:shadow-lg shadow-claude-accent/20"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </motion.form>
                    </div>
                )
                }
            </AnimatePresence >

            {/* Share Deck Modal */}
            < AnimatePresence >
                {showShareDeckModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShareDeckModal(false)} className="absolute inset-0 bg-black/60 md:backdrop-blur-md" />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            className="relative bg-claude-bg w-full max-w-lg p-6 rounded-t-[3rem] sm:rounded-[3rem] border border-claude-border pb-safe max-h-[85vh] flex flex-col"
                        >
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <h3 className="text-2xl font-serif italic font-bold text-botanical-parchment">Share Deck</h3>
                                <button type="button" onClick={() => setShowShareDeckModal(false)} className="p-2 text-claude-secondary hover:text-white transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto min-h-[300px]">
                                {myDecks.length === 0 ? (
                                    <p className="text-center text-claude-secondary font-mono text-xs mt-10">You have no personal decks to share.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {myDecks.filter(d => !sharedDecks.find(sd => sd.deck_id === d.id)).map(deck => (
                                            <div key={deck.id} onClick={() => handleShareDeck(deck.id)} className="p-4 glass-panel hover:glass-panel rounded-xl cursor-pointer transition-colors tap-action group/item flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-serif font-bold text-lg text-botanical-parchment">{deck.title}</h4>
                                                    <p className="font-mono text-[9px] text-claude-secondary uppercase tracking-widest mt-1">Click to share with group</p>
                                                </div>
                                                <Plus className="w-5 h-5 text-claude-accent opacity-50 group-hover/item:opacity-100" />
                                            </div>
                                        ))}
                                        {myDecks.filter(d => !sharedDecks.find(sd => sd.deck_id === d.id)).length === 0 && (
                                            <p className="text-center text-claude-secondary font-mono text-xs mt-10">All your decks are already shared!</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence >

            {/* Create Folder Modal */}
            < AnimatePresence >
                {showCreateFolderModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateFolderModal(false)} className="absolute inset-0 bg-black/60 md:backdrop-blur-md" />
                        <motion.form
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            onSubmit={handleCreateFolder}
                            className="relative bg-claude-bg w-full max-w-lg p-6 rounded-t-[3rem] sm:rounded-[3rem] border border-claude-border pb-safe"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-serif italic font-bold text-botanical-parchment">New Folder</h3>
                                <button type="button" onClick={() => setShowCreateFolderModal(false)} className="p-2 text-claude-secondary hover:text-white transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-[#7a9e72] font-bold mb-2 ml-1">Folder Name</label>
                                    <input
                                        type="text"
                                        value={newFolderName}
                                        onChange={e => setNewFolderName(e.target.value)}
                                        className="w-full glass-panel border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none"
                                        placeholder="e.g. Midterm Reviews"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={!newFolderName.trim()}
                                className="w-full mt-8 py-4 bg-claude-accent rounded-2xl text-[#162a31] font-mono font-bold uppercase tracking-widest hover:bg-opacity-90 transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] tap-action shadow-sm md:shadow-lg shadow-claude-accent/20 disabled:opacity-50"
                            >
                                Create
                            </button>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence >

            {/* Upload File & AI Flow Modal */}
            < AnimatePresence >
                {showUploadModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={uploadStep !== 'generating' ? closeUploadModal : undefined} className="absolute inset-0 bg-black/60 md:backdrop-blur-md" />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            className="relative bg-claude-bg w-full max-w-lg p-6 rounded-t-[3rem] sm:rounded-[3rem] border border-claude-border pb-safe overflow-hidden"
                        >
                            {/* Form Step */}
                            <AnimatePresence mode="popLayout">
                                {uploadStep === 'form' && (
                                    <motion.form
                                        key="step_form"
                                        initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                                        onSubmit={handleUploadInitialSubmit}
                                    >
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-2xl font-serif italic font-bold text-botanical-parchment flex items-center gap-2">
                                                {currentFolderId && <Folder className="w-5 h-5 text-claude-accent" />}
                                                Upload File
                                            </h3>
                                            <button type="button" onClick={closeUploadModal} className="p-2 text-claude-secondary hover:text-white transition-colors">
                                                <X className="w-6 h-6" />
                                            </button>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-mono uppercase tracking-widest text-[#7a9e72] font-bold mb-2 ml-1">File Name</label>
                                                <input
                                                    type="text"
                                                    value={uploadData.name}
                                                    onChange={e => setUploadData({ ...uploadData, name: e.target.value })}
                                                    className="w-full glass-panel border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none"
                                                    placeholder="e.g. Chapter 1 Notes"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-mono uppercase tracking-widest text-[#7a9e72] font-bold mb-2 ml-1">Select File</label>
                                                <input
                                                    type="file"
                                                    onChange={e => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            let typeString = 'pdf';
                                                            if (file.type.includes('image')) typeString = 'image';
                                                            else if (file.type.includes('word') || file.name.endsWith('.docx')) typeString = 'docx';

                                                            setUploadData(prev => ({
                                                                ...prev,
                                                                file: file,
                                                                file_type: typeString,
                                                                name: prev.name || file.name.split('.')[0]
                                                            }));
                                                        }
                                                    }}
                                                    className="w-full glass-panel border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-mono file:uppercase file:tracking-widest file:bg-claude-accent/10 file:text-claude-accent hover:file:bg-claude-accent/20 transition-[transform,opacity,color,background-color,border-color,box-shadow]"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-mono uppercase tracking-widest text-[#7a9e72] font-bold mb-2 ml-1">File Type</label>
                                                <select
                                                    value={uploadData.file_type}
                                                    onChange={e => setUploadData({ ...uploadData, file_type: e.target.value })}
                                                    className="w-full glass-panel border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none appearance-none"
                                                >
                                                    <option value="pdf">PDF Document</option>
                                                    <option value="image">Image (PNG/JPG)</option>
                                                    <option value="docx">Word Document</option>
                                                    <option value="link">Web Link</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={!uploadData.name.trim() || !uploadData.file}
                                            className="w-full mt-8 py-4 bg-claude-accent rounded-2xl text-[#162a31] font-mono font-bold uppercase tracking-widest hover:bg-opacity-90 transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] tap-action shadow-sm md:shadow-lg shadow-claude-accent/20 disabled:opacity-50"
                                        >
                                            Next Step
                                        </button>
                                    </motion.form>
                                )}

                                {/* AI Prompt Step */}
                                {uploadStep === 'ai_prompt' && (
                                    <motion.div
                                        key="step_ai_prompt"
                                        initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                                        className="py-6 flex flex-col items-center text-center"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-claude-accent/20 flex items-center justify-center mb-6 border border-claude-accent/30 shadow-[0_0_30px_rgba(230,221,211,0.15)] relative">
                                            <div className="absolute inset-0 bg-claude-accent/20 rounded-full blur-[20px] animate-pulse pointer-events-none" />
                                            <span className="text-3xl relative z-10 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">✨</span>
                                        </div>
                                        <h3 className="text-2xl font-serif italic font-bold text-botanical-parchment mb-3">Generate Flashcards?</h3>
                                        <p className="text-sm text-claude-secondary font-mono leading-relaxed mb-8 max-w-[80%]">
                                            Riven can instantly generate a testive deck from your uploaded file and share it with the group.
                                        </p>

                                        <div className="w-full space-y-3">
                                            <button
                                                onClick={handleUploadWithAi}
                                                className="w-full py-4 bg-claude-accent rounded-2xl text-[#162a31] font-mono font-bold uppercase tracking-widest hover:bg-opacity-90 transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] tap-action flex items-center justify-center gap-2 shadow-sm md:shadow-lg shadow-claude-accent/20"
                                            >
                                                <span>✨</span> Yes, create a deck
                                            </button>
                                            <button
                                                onClick={finalizeFileUpload}
                                                className="w-full py-4 glass-panel rounded-2xl text-claude-secondary font-mono font-bold uppercase tracking-widest hover:text-white transition-colors"
                                            >
                                                Not right now
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Generating Loading Step */}
                                {uploadStep === 'generating' && (
                                    <motion.div
                                        key="step_generating"
                                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                        className="py-12 flex flex-col items-center text-center"
                                    >
                                        <div className="relative w-24 h-24 mb-8">
                                            <div className="absolute inset-0 bg-claude-accent/20 rounded-full blur-[30px] animate-pulse" />
                                            <div className="absolute inset-0 border-t-2 border-l-2 border-claude-accent rounded-full animate-spin [animation-duration:1.5s]" />
                                            <div className="absolute inset-4 bg-gradient-to-br from-claude-bg to-claude-accent/10 rounded-full shadow-inner flex items-center justify-center border border-claude-border overflow-hidden">
                                                <span className="text-3xl relative z-10 animate-bounce [animation-duration:2s]">✨</span>
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-serif italic font-bold text-botanical-parchment animate-pulse mb-3">
                                            Synthesizing Knowledge...
                                        </h3>
                                        <p className="text-xs text-claude-secondary font-mono max-w-[80%] uppercase tracking-wider opacity-70">
                                            Extracting concepts into precision cards
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence >

            {/* Confirm Modal */}
            < ConfirmModal
                isOpen={confirmModal.show}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={handleConfirmAction}
                onCancel={() => setConfirmModal({ show: false, title: '', message: '', action: null })}
            />

            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => {
                    setIsReportModalOpen(false);
                    setReportingUserId(null);
                }}
                onSubmit={handleReportUserSubmit}
                isSubmitting={isReporting}
            />


            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
        </>
    );
}
