import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, Settings, Trash2, Shield, LogOut, Copy, CheckCircle2, Layers, Plus, Play, Folder, FileText, Upload, Zap, Activity, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../hooks/useToast';
import { api } from '../api';
import ConfirmModal from '../components/ConfirmModal';
import useHaptics from '../hooks/useHaptics';
import { useAuth } from '../hooks/useAuth';

export default function GroupDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const haptics = useHaptics();
    const toast = useToast();
    const { socket } = useAuth();

    const [group, setGroup] = useState(null);
    const [members, setMembers] = useState([]);
    const [sharedDecks, setSharedDecks] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const isAdmin = group?.my_role === 'admin';
    const currentUserId = members.find(m => m.role === group?.my_role)?.id; // approximate

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
        haptics.warning();
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
        confirmAction('Remove Member', `Remove ${name} from the group ? `, async () => {
            await api.removeGroupMember(id, userId);
            toast.success('Member removed');
            loadGroup();
        });
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
            await api.removeDeckFromGroup(id, deckId);
            toast.success('Deck removed');
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

    const handleDeleteFolder = (folderId) => {
        confirmAction('Delete Folder', 'This will delete the folder and all files inside it.', async () => {
            await api.deleteGroupFolder(id, folderId);
            toast.success('Folder deleted');
            if (currentFolderId === folderId) setCurrentFolderId(null);
            loadGroup();
        });
    };

    const handleUploadInitialSubmit = (e) => {
        e.preventDefault();
        if (!uploadData.name.trim() || !uploadData.file_url.trim()) return toast.error('Name and URL required');
        setUploadStep('ai_prompt');
    };

    const finalizeFileUpload = async () => {
        try {
            await api.uploadGroupFile(id, { ...uploadData, folder_id: currentFolderId });
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
            // Wait for AI generation (using mock url as notes string placeholder for now)
            const deckRes = await api.generateAiDeck(
                `File reference: ${uploadData.file_url} `,
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
            toast.error(err.message || 'AI Generation failed, falling back to upload-only');
            // If AI specifically fails, still save the file
            await finalizeFileUpload();
        }
    };

    const closeUploadModal = () => {
        setShowUploadModal(false);
        setTimeout(() => {
            setUploadStep('form');
            setUploadData({ name: '', file_url: '', file_type: 'pdf' });
        }, 300);
    };

    const handleDeleteFile = (fileId) => {
        confirmAction('Remove File', 'Are you sure you want to remove this file?', async () => {
            await api.deleteGroupFile(id, fileId);
            toast.success('File removed');
            loadGroup();
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
        <div className="relative min-h-screen pb-24">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-claude-bg/80 backdrop-blur-md border-b border-claude-border/50 px-4 py-3 flex flex-col justify-end min-h-[70px]">
                <div className="flex items-center justify-between w-full">
                    <button onClick={() => navigate('/groups')} className="p-2 -ml-2 text-claude-secondary hover:text-white transition-colors tap-action">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="flex-1 min-w-0 px-2 text-center">
                        <h2 className="font-serif italic font-bold text-lg text-botanical-parchment truncate">{group.name}</h2>
                    </div>
                    {isAdmin ? (
                        <button onClick={() => setShowSettings(!showSettings)} className="p-2 -mr-2 text-claude-secondary hover:text-white transition-colors tap-action">
                            <Settings className="w-5 h-5" />
                        </button>
                    ) : (
                        <button onClick={handleLeave} className="p-2 -mr-2 text-red-400 hover:text-red-300 transition-colors tap-action">
                            <LogOut className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="px-4 sm:px-6 pt-6">

                {/* Dashboard Overview */}
                <div className="bg-[#fcfaf2] border border-[#d1c9b8] rounded-2xl p-6 shadow-sm mb-8 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                    <div className="relative z-10 text-center mb-6">
                        <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-[#8a7f6a] mb-2">{group.class_name || 'Independent Group'}</h3>
                        <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-claude-accent/10 border border-claude-accent/30 rounded-xl cursor-pointer hover:bg-claude-accent/20 transition-colors" onClick={handleCopyCode}>
                            <span className="font-mono text-lg font-bold tracking-widest text-[#162a31]">{group.join_code}</span>
                            {copied ? <CheckCircle2 className="w-5 h-5 text-claude-accent" /> : <Copy className="w-4 h-4 text-claude-accent opacity-70" />}
                        </div>
                        <p className="text-[10px] font-mono text-claude-secondary/60 mt-2 uppercase tracking-wide">Share code to invite members</p>
                    </div>

                    {/* Live Cram Sessions */}
                    {sessions.length > 0 && (
                        <div className="space-y-4 mb-8">
                            <h3 className="font-serif italic text-2xl text-red-400 mb-2 flex items-center gap-2">
                                <Activity className="w-6 h-6 animate-pulse" /> Live Sessions
                            </h3>
                            <div className="grid gap-3">
                                {sessions.map(session => (
                                    <div key={session.id} onClick={() => navigate(`/groups/${id}/cram/${session.id}`)} className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-red-500/20 transition-all group overflow-hidden relative">
                                        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent animate-scan" />
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                                <h4 className="font-serif font-bold text-red-200">{session.deck_title}</h4>
                                            </div>
                                            <p className="font-mono text-[9px] uppercase tracking-widest text-red-300 ml-4">
                                                {session.active_members || 1} members reading
                                            </p>
                                        </div>
                                        <button className="px-4 py-2 bg-red-500 text-white rounded-xl font-mono text-[10px] uppercase tracking-widest font-bold shadow-lg shadow-red-500/20 group-hover:bg-red-600 transition-colors">
                                            Join Now
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Placeholder for future features */}
                    <div className="flex items-center justify-between py-6 mt-2 mb-4">
                        <h3 className="font-serif italic text-2xl text-botanical-parchment flex items-center gap-2">
                            <Layers className="w-6 h-6 text-claude-accent opacity-70" /> Shared Decks ({sharedDecks.length})
                        </h3>
                        <button
                            onClick={() => setShowShareDeckModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-claude-accent/10 border border-claude-accent/30 text-claude-accent rounded-lg font-mono text-[9px] uppercase font-bold tracking-widest hover:bg-claude-accent hover:text-[#162a31] transition-colors tap-action"
                        >
                            <Plus className="w-3.5 h-3.5" /> Share
                        </button>
                    </div>

                    <div className="space-y-3 mb-8">
                        {sharedDecks.length === 0 ? (
                            <div className="text-center py-8 bg-[color-mix(in_srgb,var(--surface-color)_20%,transparent)] border border-dashed border-claude-border rounded-xl">
                                <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-claude-secondary">No Decks Shared Yet</p>
                            </div>
                        ) : (
                            sharedDecks.map(deck => (
                                <div key={deck.id} className="group/deck relative bg-claude-bg border border-claude-border rounded-xl p-4 overflow-hidden shadow-sm hover:shadow-md transition-all tap-action flex items-center gap-4">
                                    <div className="flex-1 min-w-0" onClick={() => navigate(`/deck/${deck.id}`)}>
                                        <h4 className="font-serif font-bold text-lg text-botanical-parchment truncate leading-tight group-hover/deck:text-claude-accent transition-colors">{deck.title}</h4>
                                        <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-claude-secondary uppercase tracking-widest">
                                            <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {deck.card_count || 0} Cards</span>
                                            <span className="flex items-center gap-1">Shared by @{deck.shared_by_name}</span>
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleStartSession(deck.id); }}
                                            className="p-2 text-claude-secondary hover:text-amber-400 transition-colors bg-black/20 rounded-lg flex items-center gap-1 tap-action"
                                            title="Start Group Cram Session"
                                        >
                                            <Zap className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRemoveDeck(deck.id); }}
                                            className="p-2 text-claude-secondary hover:text-red-400 transition-colors bg-black/20 rounded-lg tap-action"
                                            title="Remove Deck"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Shared Files & Folders */}
                    <div className="flex items-center justify-between py-6 mt-2 mb-4">
                        <h3 className="font-serif italic text-2xl text-botanical-parchment flex items-center gap-2">
                            <Folder className="w-6 h-6 text-claude-accent opacity-70" /> Files & Folders
                        </h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowCreateFolderModal(true)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-claude-border text-claude-secondary rounded-lg font-mono text-[9px] uppercase font-bold tracking-widest hover:text-white transition-colors tap-action"
                            >
                                <Plus className="w-3.5 h-3.5" /> Folder
                            </button>
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-claude-accent/10 border border-claude-accent/30 text-claude-accent rounded-lg font-mono text-[9px] uppercase font-bold tracking-widest hover:bg-claude-accent hover:text-[#162a31] transition-colors tap-action"
                            >
                                <Upload className="w-3.5 h-3.5" /> Upload
                            </button>
                        </div>
                    </div>

                    <div className="bg-claude-bg border border-claude-border rounded-xl overflow-hidden mb-8">
                        {currentFolderId && (
                            <div
                                onClick={() => setCurrentFolderId(null)}
                                className="p-3 bg-[color-mix(in_srgb,var(--surface-color)_20%,transparent)] border-b border-claude-border flex items-center gap-2 cursor-pointer hover:bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4 text-claude-secondary" />
                                <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-claude-secondary">Back to root</span>
                            </div>
                        )}

                        {!currentFolderId && folders.length === 0 && files.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-claude-secondary">Empty Directory</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-claude-border/50">
                                {!currentFolderId && folders.map(folder => (
                                    <div key={folder.id} onClick={() => setCurrentFolderId(folder.id)} className="p-4 flex items-center justify-between hover:bg-[color-mix(in_srgb,var(--surface-color)_20%,transparent)] cursor-pointer transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <Folder className="w-5 h-5 text-amber-500/80" fill="currentColor" />
                                            <div>
                                                <h4 className="font-serif font-bold text-botanical-parchment group-hover:text-claude-accent transition-colors">{folder.name}</h4>
                                                <p className="font-mono text-[9px] text-claude-secondary uppercase tracking-widest">{folder.file_count || 0} files • By @{folder.created_by_name}</p>
                                            </div>
                                        </div>
                                        {isAdmin && (
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {files.map(file => (
                                    <div key={file.id} className="p-4 flex items-center justify-between hover:bg-[color-mix(in_srgb,var(--surface-color)_20%,transparent)] transition-colors group">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-lg bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] flex items-center justify-center shrink-0">
                                                <FileText className="w-5 h-5 text-claude-secondary" />
                                            </div>
                                            <div className="min-w-0">
                                                <a href={file.file_url} target="_blank" rel="noreferrer" className="font-serif font-bold text-botanical-parchment hover:text-claude-accent transition-colors truncate block">{file.name}</a>
                                                <p className="font-mono text-[9px] text-claude-secondary uppercase tracking-widest mt-0.5 truncate">{file.file_type.toUpperCase()} • Uploaded by @{file.uploaded_by_name}</p>
                                            </div>
                                        </div>
                                        {(isAdmin || file.uploaded_by === currentUserId) && (
                                            <button onClick={() => handleDeleteFile(file.id)} className="p-2 opacity-0 group-hover:opacity-100 text-claude-secondary hover:text-red-400 transition-all shrink-0">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {currentFolderId && files.length === 0 && (
                                    <div className="p-6 text-center">
                                        <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-claude-secondary">Folder is empty</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>

                {/* Members List */}
                <h3 className="font-serif italic text-2xl text-botanical-parchment mb-4 flex items-center gap-2">
                    <Users className="w-6 h-6 text-claude-accent opacity-70" /> Members ({members.length})
                </h3>

                <div className="space-y-3">
                    {members.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-4 bg-[color-mix(in_srgb,var(--surface-color)_20%,transparent)] border border-claude-border rounded-xl">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-claude-accent/20 flex items-center justify-center shrink-0 border border-claude-accent/30 p-1">
                                    <img src={member.avatar || 'https://api.dicebear.com/7.x/notionists/svg?seed=' + member.username} alt="avatar" className="w-full h-full rounded-full bg-white object-cover" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-serif font-bold text-botanical-parchment truncate leading-tight">{member.display_name || member.username}</span>
                                    <span className="font-mono text-[9px] uppercase tracking-widest text-claude-secondary mt-0.5 flex gap-2">
                                        @{member.username}
                                        {member.role === 'admin' && <span className="text-claude-accent font-bold">ADMIN</span>}
                                    </span>
                                </div>
                            </div>
                            {isAdmin && member.role !== 'admin' && (
                                <button
                                    onClick={() => handleRemoveMember(member.id, member.username)}
                                    className="p-2 text-claude-secondary hover:text-red-400 transition-colors bg-black/20 rounded-lg"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Admin Settings Modal */}
            <AnimatePresence>
                {showSettings && isAdmin && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
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
                                        className="w-full bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-[#7a9e72] font-bold mb-2 ml-1">Associated Class</label>
                                    <select
                                        value={editData.class_id || ''}
                                        onChange={e => setEditData({ ...editData, class_id: e.target.value })}
                                        className="w-full bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none appearance-none"
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
                                        className="w-full py-3 bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-claude-border rounded-xl text-claude-secondary font-mono text-xs uppercase tracking-widest font-bold hover:text-white transition-colors text-center"
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
                                    className="flex-1 py-4 bg-claude-accent rounded-2xl text-[#162a31] font-mono font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all active:scale-[0.98] tap-action shadow-lg shadow-claude-accent/20"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>

            {/* Share Deck Modal */}
            <AnimatePresence>
                {showShareDeckModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShareDeckModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
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
                                            <div key={deck.id} onClick={() => handleShareDeck(deck.id)} className="p-4 bg-[color-mix(in_srgb,var(--surface-color)_20%,transparent)] hover:bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-claude-border rounded-xl cursor-pointer transition-colors tap-action">
                                                <h4 className="font-serif font-bold text-lg text-botanical-parchment">{deck.title}</h4>
                                                <p className="font-mono text-[9px] text-claude-secondary uppercase tracking-widest mt-1">Click to share</p>
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
            </AnimatePresence>

            {/* Create Folder Modal */}
            <AnimatePresence>
                {showCreateFolderModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateFolderModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
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
                                        className="w-full bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none"
                                        placeholder="e.g. Midterm Reviews"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={!newFolderName.trim()}
                                className="w-full mt-8 py-4 bg-claude-accent rounded-2xl text-[#162a31] font-mono font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all active:scale-[0.98] tap-action shadow-lg shadow-claude-accent/20 disabled:opacity-50"
                            >
                                Create
                            </button>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>

            {/* Upload File & AI Flow Modal */}
            <AnimatePresence>
                {showUploadModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={uploadStep !== 'generating' ? closeUploadModal : undefined} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
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
                                                    className="w-full bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none"
                                                    placeholder="e.g. Chapter 1 Notes"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-mono uppercase tracking-widest text-[#7a9e72] font-bold mb-2 ml-1">Mock File URL (Google Drive, AWS, etc)</label>
                                                <input
                                                    type="url"
                                                    value={uploadData.file_url}
                                                    onChange={e => setUploadData({ ...uploadData, file_url: e.target.value })}
                                                    className="w-full bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none"
                                                    placeholder="https://..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-mono uppercase tracking-widest text-[#7a9e72] font-bold mb-2 ml-1">File Type</label>
                                                <select
                                                    value={uploadData.file_type}
                                                    onChange={e => setUploadData({ ...uploadData, file_type: e.target.value })}
                                                    className="w-full bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none appearance-none"
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
                                            disabled={!uploadData.name.trim() || !uploadData.file_url.trim()}
                                            className="w-full mt-8 py-4 bg-claude-accent rounded-2xl text-[#162a31] font-mono font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all active:scale-[0.98] tap-action shadow-lg shadow-claude-accent/20 disabled:opacity-50"
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
                                                className="w-full py-4 bg-claude-accent rounded-2xl text-[#162a31] font-mono font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all active:scale-[0.98] tap-action flex items-center justify-center gap-2 shadow-lg shadow-claude-accent/20"
                                            >
                                                <span>✨</span> Yes, create a deck
                                            </button>
                                            <button
                                                onClick={finalizeFileUpload}
                                                className="w-full py-4 bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-claude-border rounded-2xl text-claude-secondary font-mono font-bold uppercase tracking-widest hover:text-white transition-colors"
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
            </AnimatePresence>

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmModal.show}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={handleConfirmAction}
                onCancel={() => setConfirmModal({ show: false, title: '', message: '', action: null })}
            />
        </div>
    );
}
