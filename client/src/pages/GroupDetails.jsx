import React, { useEffect, useState, useCallback } from 'react';
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
import { useGSAP } from '../hooks/useGSAP';
import gsap from 'gsap';
import FileViewer from '../components/FileViewer';

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

    // Reporting & Blocking
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReporting, setIsReporting] = useState(false);
    const [reportingUserId, setReportingUserId] = useState(null);
    const [activeMemberMenuId, setActiveMemberMenuId] = useState(null);

    const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', action: null });

    // File Viewer State
    const [selectedFile, setSelectedFile] = useState(null);
    const [isFileViewerOpen, setIsFileViewerOpen] = useState(false);

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

            // Load folders (files are fetched separately by folder)
            const fetchedFolders = await api.getGroupFolders(id);
            setFolders(fetchedFolders || []);

        } catch (err) {
            console.error(err);
            toast.error('Failed to load group details');
            navigate('/groups');
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, navigate]);

    useEffect(() => {
        loadGroup();

        // Listen for real-time session events
        const onSessionStarted = (data) => {
            // New session started in this group
            if (data && (data.sessionId || data.id)) {
                loadGroup(); // refresh to get full session details from DB
                toast.show('A live cram session just started!');
            }
        };

        const onSessionEnded = () => {
            loadGroup(); // refresh
        };

        if (authApi.canUseSupabaseEdgeFunctions()) {
            return authApi.subscribeToGroupSessionEvents(id, {
                onStarted: onSessionStarted,
                onEnded: onSessionEnded,
            });
        }

        if (socket) {
            socket.on(`group-${id}-session-started`, onSessionStarted);
            socket.on(`group-${id}-session-ended`, onSessionEnded); // if this socket was also in the room
        }

        return () => {
            if (socket) {
                socket.off(`group-${id}-session-started`, onSessionStarted);
                socket.off(`group-${id}-session-ended`, onSessionEnded);
            }
        };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, loadGroup, socket, toast]);

    // Fetch files separately when folder changes (avoids full group re-fetch)
    useEffect(() => {
        api.getGroupFiles(id, currentFolderId).then(f => setFiles(f || []));
    }, [id, currentFolderId]);

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

    const { container } = useGSAP(() => {
        if (loading || !group) return;

        // Animate Header
        gsap.fromTo('.gsap-header',
            { y: -20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }
        );

        // Animate Left Column items
        gsap.fromTo('.gsap-left-item',
            { x: -30, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power3.out', delay: 0.1 }
        );

        // Animate Right Column items (Decks, Library)
        gsap.fromTo('.gsap-right-item',
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power3.out', delay: 0.2 }
        );

        // Mobile list items
        gsap.fromTo('.gsap-mobile-item',
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out', delay: 0.1 }
        );

        // GSAP Micro-interactions
        const cards = gsap.utils.toArray('.gsap-hover-card');
        cards.forEach(card => {
            const onEnter = () => gsap.to(card, { y: -2, scale: 1.01, duration: 0.3, ease: 'power2.out' });
            const onLeave = () => gsap.to(card, { y: 0, scale: 1, duration: 0.4, ease: 'power2.out' });
            const onDown = () => gsap.to(card, { scale: 0.98, duration: 0.1, ease: 'power1.inOut' });
            const onUp = () => gsap.to(card, { scale: 1.01, duration: 0.2, ease: 'power1.inOut' });

            card.addEventListener('mouseenter', onEnter);
            card.addEventListener('mouseleave', onLeave);
            card.addEventListener('mousedown', onDown);
            card.addEventListener('mouseup', onUp);
            card.addEventListener('touchstart', onDown, { passive: true });
            card.addEventListener('touchend', onUp, { passive: true });

            return () => {
                card.removeEventListener('mouseenter', onEnter);
                card.removeEventListener('mouseleave', onLeave);
                card.removeEventListener('mousedown', onDown);
                card.removeEventListener('mouseup', onUp);
                card.removeEventListener('touchstart', onDown);
                card.removeEventListener('touchend', onUp);
            }
        });
    }, [loading, group, sharedDecks, sessions, folders, files]);

    const handleCopyCode = async () => {
        if (!group?.join_code) return;
        try {
            await navigator.clipboard.writeText(group.join_code);
            haptics.light();
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success('Join code copied!');
        } catch {
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
            await api.updateGroup(id, { regenerate_code: true, class_id: group?.class_id || null });
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
            } catch {
                setMembers(prevMembers); // Rollback
                toast.error('Failed to remove member');
            }
        });
    };

    const handleBlockUser = (userId, name) => {
        confirmAction('Block User', `Are you sure you want to block ${name}? They will no longer be able to interact with you.`, async () => {
            try {
                await authApi.blockUser(userId);
                toast.success('User blocked successfully');
                // Refresh group to potentially clear blocked user's content (if backend filters it)
                loadGroup();
            } catch (err) {
                toast.error(err.message || 'Failed to block user');
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
            } catch {
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
        } catch {
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
            } catch {
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
            const file = uploadData.file;
            if (!file) throw new Error('No file selected');

            // Build a unique storage path
            const folder = currentFolderId || 'root';
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `${id}/${folder}/${Date.now()}_${safeName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('group-files')
                .upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Get the public URL
            const { data: urlData } = supabase.storage
                .from('group-files')
                .getPublicUrl(storagePath);

            const publicUrl = urlData?.publicUrl;
            if (!publicUrl) throw new Error('Could not get public URL');

            await api.uploadGroupFile(id, {
                name: uploadData.name,
                file_url: publicUrl,
                file_type: uploadData.file_type || file.type || 'application/octet-stream',
                folder_id: currentFolderId
            });
            toast.success('File uploaded');
            closeUploadModal();
            loadGroup();
        } catch (err) {
            console.error('File upload error:', err);
            toast.error(err.message || 'Failed to upload file');
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
            } catch {
                setFiles(prevFiles); // Rollback
                toast.error('Failed to remove file');
            }
        });
    };

    const handleViewFile = (file) => {
        const fileExtension = file.name.split('.').pop().toLowerCase();
        setSelectedFile({
            ...file,
            extension: fileExtension,
            url: file.file_url
        });
        setIsFileViewerOpen(true);
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
        <div className="min-h-screen bg-claude-bg text-claude-text font-sans pb-24 md:pb-0" ref={container}>
            {/* --- DESKTOP VIEW --- */}
            <div className="hidden md:flex flex-col max-w-[1400px] mx-auto px-6 py-6 h-screen overflow-hidden">
                {/* Desktop Header */}
                <header className="gsap-header flex items-center justify-between shrink-0 mb-6 bg-claude-surface/30 backdrop-blur-2xl p-4 rounded-3xl border border-claude-border/50">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/groups')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-claude-surface border border-claude-border hover:bg-claude-border/50 transition-colors">
                            <ChevronLeft className="w-5 h-5 text-claude-secondary" />
                        </button>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-bold tracking-tight text-claude-text">{group.name}</h1>
                            {group.class_name && <span className="text-xs font-medium text-claude-secondary">{group.class_name}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isAdmin ? (
                            <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-claude-surface border border-claude-border hover:bg-claude-border/50 transition-colors font-medium text-sm text-claude-secondary">
                                <Settings className="w-4 h-4" /> Settings
                            </button>
                        ) : (
                            <button onClick={handleLeave} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-colors font-medium text-sm">
                                <LogOut className="w-4 h-4" /> Leave Group
                            </button>
                        )}
                    </div>
                </header>

                <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                    {/* LEFT COLUMN */}
                    <div className="col-span-4 flex flex-col gap-5 overflow-y-auto pr-2 no-scrollbar">
                        <div className="gsap-left-item p-6 rounded-3xl bg-claude-surface/40 backdrop-blur-xl border border-claude-border/50 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-claude-accent/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                            <h2 className="text-xs font-bold uppercase tracking-widest text-claude-secondary mb-3">Invite Code</h2>
                            <div
                                onClick={handleCopyCode}
                                className="gsap-hover-card flex items-center justify-between p-4 rounded-2xl border border-claude-border/80 bg-claude-bg cursor-pointer hover:border-claude-accent/40 transition-colors"
                            >
                                <span className="font-mono text-2xl tracking-[0.25em] font-bold text-claude-text">{group.join_code}</span>
                                {copied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-claude-secondary" />}
                            </div>
                        </div>

                        <button
                            onClick={() => setShowShareDeckModal(true)}
                            className="gsap-left-item gsap-hover-card w-full py-4 rounded-2xl bg-claude-accent text-claude-text font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm uppercase tracking-widest text-sm"
                        >
                            <Zap className="w-4 h-4 fill-current" /> Start Cram Session
                        </button>

                        {sessions.length > 0 && (
                            <div className="gsap-left-item p-5 rounded-3xl bg-red-500/5 border border-red-500/10">
                                <h2 className="text-xs font-bold uppercase tracking-widest text-red-500 flex items-center gap-2 mb-4">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                    Live Sessions
                                </h2>
                                <div className="space-y-3">
                                    {sessions.map(session => (
                                        <div key={session.id} onClick={() => navigate(`/groups/${id}/cram/${session.id}`)} className="gsap-hover-card p-4 rounded-2xl bg-claude-bg border border-red-500/20 hover:border-red-500/40 transition-colors cursor-pointer flex items-center justify-between shadow-sm">
                                            <div className="min-w-0 pr-3">
                                                <div className="font-bold text-sm text-claude-text truncate">{session.deck_title}</div>
                                                <div className="text-xs text-red-400 mt-1 font-medium">{session.active_members || 1} members active</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-bold">Join</span>
                                                {isAdmin && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleEndSession(session.id); }} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-md transition-colors">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="gsap-left-item p-6 rounded-3xl bg-claude-surface/40 backdrop-blur-xl border border-claude-border/50 shadow-sm">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-claude-secondary mb-4">Members ({members.length})</h2>
                            <div className="space-y-2">
                                {members.map(member => (
                                    <div key={member.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-claude-border/30 group transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <img src={member.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${member.username}`} alt="" className="w-8 h-8 rounded-full bg-white border border-claude-border" />
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-claude-text truncate">{member.display_name || member.username}</div>
                                                <div className="text-xs text-claude-secondary truncate">@{member.username} {member.role === 'admin' && '· Admin'}</div>
                                            </div>
                                        </div>
                                        {member.id !== currentUserId && (
                                            <div className="relative">
                                                <button onClick={() => setActiveMemberMenuId(activeMemberMenuId === member.id ? null : member.id)} className="p-1 hover:bg-claude-border rounded-lg text-claude-secondary transition-colors">
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                {activeMemberMenuId === member.id && (
                                                    <div className="absolute right-0 mt-1 w-32 bg-claude-surface border border-claude-border rounded-xl shadow-lg overflow-hidden z-20">
                                                        {isAdmin && member.role !== 'admin' && (
                                                            <button onClick={() => { handleRemoveMember(member.id, member.username); setActiveMemberMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10">Remove</button>
                                                        )}
                                                        <button onClick={() => { handleBlockUser(member.id, member.username); setActiveMemberMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10">Block</button>
                                                        <button onClick={() => { setReportingUserId(member.id); setIsReportModalOpen(true); setActiveMemberMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-bold text-claude-text hover:bg-claude-border/50">Report</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="col-span-8 flex flex-col gap-6 overflow-y-auto pr-2 no-scrollbar">
                        <div className="gsap-right-item flex flex-col h-[45%] min-h-[300px]">
                            <div className="flex items-center justify-between mb-4 shrink-0 px-2">
                                <h2 className="text-lg font-bold flex items-center gap-2 text-claude-text"><Layers className="w-5 h-5 text-claude-accent" /> Shared Decks</h2>
                                <button onClick={() => setShowShareDeckModal(true)} className="px-4 py-2 rounded-xl bg-claude-surface border border-claude-border hover:border-claude-accent/40 text-sm font-bold transition-colors flex items-center gap-2 shadow-sm text-claude-text">
                                    <Plus className="w-4 h-4" /> Share Deck
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto rounded-3xl bg-claude-surface/40 backdrop-blur-xl border border-claude-border/50 p-4 shadow-sm">
                                {sharedDecks.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-claude-secondary">
                                        <Layers className="w-8 h-8 mb-3 opacity-30" />
                                        <p className="text-sm font-medium">No decks shared yet</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        {sharedDecks.map(deck => (
                                            <div key={deck.id} onClick={() => navigate(`/deck/${deck.id}`)} className="gsap-hover-card group flex flex-col justify-between p-5 rounded-2xl border border-claude-border hover:border-claude-accent/40 bg-claude-bg cursor-pointer transition-colors relative shadow-sm hover:shadow-claude-accent/5">
                                                <div className="pr-8">
                                                    <h3 className="font-bold text-claude-text truncate" title={deck.title}>{deck.title}</h3>
                                                    <p className="text-xs text-claude-secondary mt-1 font-medium">Shared by @{deck.shared_by_name}</p>
                                                </div>
                                                <div className="mt-6 flex items-center gap-2">
                                                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-claude-surface border border-claude-border text-claude-secondary">{deck.card_count || 0} cards</span>
                                                </div>
                                                <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={(e) => { e.stopPropagation(); handleStartSession(deck.id); }} className="p-2 bg-claude-accent/10 hover:bg-claude-accent text-claude-accent hover:text-claude-text rounded-lg transition-colors" title="Start Cram">
                                                        <Zap className="w-4 h-4 fill-current" />
                                                    </button>
                                                    {isAdmin && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleRemoveDeck(deck.id); }} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Remove">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="gsap-right-item flex flex-col flex-1 min-h-[300px]">
                            <div className="flex items-center justify-between mb-4 shrink-0 px-2">
                                <h2 className="text-lg font-bold flex items-center gap-2 text-claude-text"><Folder className="w-5 h-5 text-claude-accent" /> Library</h2>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setShowCreateFolderModal(true)} className="px-4 py-2 rounded-xl bg-claude-surface border border-claude-border hover:border-claude-accent/40 text-sm font-bold transition-colors flex items-center gap-2 shadow-sm text-claude-text">
                                        <Plus className="w-4 h-4 text-claude-secondary" /> Folder
                                    </button>
                                    <button onClick={() => setShowUploadModal(true)} className="px-4 py-2 rounded-xl bg-claude-accent text-claude-text hover:opacity-90 text-sm font-bold transition-colors flex items-center gap-2 shadow-sm">
                                        <Upload className="w-4 h-4" /> Upload File
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto rounded-3xl bg-claude-surface/40 backdrop-blur-xl border border-claude-border/50 flex flex-col shadow-sm">
                                {currentFolderId && (
                                    <div className="p-4 border-b border-claude-border/60 flex items-center gap-2 bg-claude-bg/50 shrink-0">
                                        <button onClick={() => setCurrentFolderId(null)} className="flex items-center gap-1 text-sm font-bold text-claude-secondary hover:text-claude-text transition-colors">
                                            <Folder className="w-4 h-4" /> Library
                                        </button>
                                        <ChevronLeft className="w-4 h-4 text-claude-secondary rotate-180" />
                                        <span className="text-sm font-bold truncate max-w-[250px] text-claude-text">{folders.find(f => f.id === currentFolderId)?.name}</span>
                                    </div>
                                )}
                                <div className="p-3 flex-1">
                                    {!currentFolderId && folders.length === 0 && files.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-claude-secondary">
                                            <FileText className="w-8 h-8 mb-3 opacity-30" />
                                            <p className="text-sm font-medium">Directory is empty</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {!currentFolderId && folders.map(folder => (
                                                <div key={folder.id} onClick={() => setCurrentFolderId(folder.id)} className="gsap-hover-card flex items-center justify-between p-4 rounded-xl hover:bg-claude-border/40 cursor-pointer group transition-colors bg-claude-surface border border-transparent hover:border-claude-border/60">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                                            <Folder className="w-5 h-5 text-amber-500" fill="currentColor" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm text-claude-text">{folder.name}</div>
                                                            <div className="text-xs font-medium text-claude-secondary">{folder.file_count || 0} items</div>
                                                        </div>
                                                    </div>
                                                    {isAdmin && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(e, folder.id); }} className="p-2 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {files.map(file => (
                                                <div key={file.id} className="gsap-hover-card cursor-pointer flex items-center justify-between p-4 rounded-xl hover:bg-claude-border/40 group transition-colors bg-claude-surface border border-transparent hover:border-claude-border/60" onClick={() => handleViewFile(file)}>
                                                    <div className="flex items-center gap-4 min-w-0 pr-4">
                                                        <div className="w-10 h-10 rounded-lg bg-claude-border/50 border border-claude-border flex items-center justify-center shrink-0">
                                                            <FileText className="w-5 h-5 text-claude-secondary" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="font-bold text-sm hover:text-claude-accent transition-colors truncate block text-claude-text">{file.name}</span>
                                                            <div className="text-xs font-bold text-claude-secondary uppercase tracking-wider">{file.file_type}</div>
                                                        </div>
                                                    </div>
                                                    {(isAdmin || file.uploaded_by === currentUserId) && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFile(e, file.id); }} className="p-2 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-500/10 rounded-lg shrink-0 transition-all">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {currentFolderId && files.length === 0 && (
                                                <div className="py-12 text-center text-claude-secondary">
                                                    <Folder className="w-8 h-8 opacity-30 mx-auto mb-3" />
                                                    <p className="text-sm font-medium">Folder is empty</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MOBILE VIEW --- */}
            <div className="md:hidden flex flex-col min-h-screen bg-claude-bg text-claude-text font-sans">
                <header className="gsap-header sticky top-0 z-40 bg-claude-bg/70 backdrop-blur-3xl border-b border-claude-border/50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/groups')} className="p-2 -ml-2 text-claude-text hover:bg-claude-surface rounded-xl transition-colors">
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold truncate leading-tight">{group.name}</h1>
                            {group.class_name && <p className="text-xs font-medium text-claude-secondary truncate">{group.class_name}</p>}
                        </div>
                    </div>
                    {isAdmin ? (
                        <button onClick={() => setShowSettings(true)} className="p-2 text-claude-secondary hover:bg-claude-surface rounded-xl transition-colors">
                            <Settings className="w-6 h-6" />
                        </button>
                    ) : (
                        <button onClick={handleLeave} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors">
                            <LogOut className="w-5 h-5" />
                        </button>
                    )}
                </header>

                <div className="flex-1 p-4 space-y-6 pb-36">
                    <div
                        onClick={handleCopyCode}
                        className="gsap-mobile-item gsap-hover-card flex items-center justify-between p-5 rounded-3xl bg-claude-surface/40 backdrop-blur-xl border border-claude-border/50 transition-transform shadow-sm"
                    >
                        <div>
                            <div className="text-xs font-bold uppercase tracking-widest text-claude-secondary mb-1">Invite Code</div>
                            <div className="font-mono text-3xl tracking-widest font-bold text-claude-text">{group.join_code}</div>
                        </div>
                        {copied ? <CheckCircle2 className="w-7 h-7 text-green-500" /> : <Copy className="w-7 h-7 text-claude-secondary" />}
                    </div>

                    {sessions.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="gsap-mobile-item text-xs font-bold uppercase tracking-widest text-red-500 flex items-center gap-2 pl-2">
                                <Activity className="w-4 h-4" /> Live Sessions
                            </h2>
                            {sessions.map(session => (
                                <div key={session.id} className="gsap-mobile-item gsap-hover-card p-5 rounded-3xl bg-red-500/5 border border-red-500/20 flex flex-col gap-4">
                                    <div>
                                        <div className="font-bold text-lg text-claude-text">{session.deck_title}</div>
                                        <div className="text-xs font-medium text-red-400 mt-1">{session.active_members || 1} members active</div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => navigate(`/groups/${id}/cram/${session.id}`)} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-red-600 active:scale-95 transition-all">Join</button>
                                        {isAdmin && (
                                            <button onClick={() => handleEndSession(session.id)} className="px-5 py-3 bg-red-500/10 text-red-500 rounded-xl font-bold text-sm hover:bg-red-500/20 active:scale-95 transition-all">End</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="gsap-mobile-item flex items-center justify-between pl-2 pr-1">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-claude-text"><Layers className="w-5 h-5 text-claude-accent" /> Decks</h2>
                            <button onClick={() => setShowShareDeckModal(true)} className="text-xs font-bold text-claude-accent px-4 py-2 bg-claude-accent/10 rounded-xl active:bg-claude-accent/20 transition-colors">Share</button>
                        </div>
                        <div className="gsap-mobile-item flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 snap-x no-scrollbar">
                            {sharedDecks.length === 0 ? (
                                <div className="w-full py-8 text-center text-claude-secondary text-sm font-medium border border-dashed border-claude-border/80 rounded-3xl bg-claude-surface/50">No decks shared yet</div>
                            ) : (
                                sharedDecks.map(deck => (
                                    <div key={deck.id} onClick={() => navigate(`/deck/${deck.id}`)} className="gsap-hover-card snap-center shrink-0 w-[260px] p-5 rounded-3xl bg-claude-surface/40 backdrop-blur-xl border border-claude-border/50 flex flex-col justify-between transition-transform shadow-sm">
                                        <div>
                                            <h3 className="font-bold text-base truncate text-claude-text mb-1">{deck.title}</h3>
                                            <p className="text-xs font-medium text-claude-secondary truncate">@{deck.shared_by_name}</p>
                                        </div>
                                        <div className="mt-6 flex justify-between items-end">
                                            <span className="text-xs font-bold text-claude-secondary px-2 py-1 bg-claude-bg rounded-md border border-claude-border/50">{deck.card_count || 0} cards</span>
                                            <button onClick={(e) => { e.stopPropagation(); handleStartSession(deck.id); }} className="w-10 h-10 flex items-center justify-center bg-claude-accent/10 text-claude-accent hover:bg-claude-accent hover:text-claude-text rounded-xl transition-colors">
                                                <Zap className="w-5 h-5 fill-current" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="gsap-mobile-item flex items-center justify-between pl-2 pr-1">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-claude-text"><Folder className="w-5 h-5 text-claude-accent" /> Library</h2>
                            <button onClick={() => setShowCreateFolderModal(true)} className="text-xs font-bold text-claude-secondary bg-claude-surface border border-claude-border px-4 py-2 rounded-xl active:bg-claude-border/50 transition-colors">New Folder</button>
                        </div>
                        <div className="gsap-mobile-item rounded-3xl border border-claude-border/50 overflow-hidden bg-claude-surface/40 backdrop-blur-xl shadow-sm">
                            {currentFolderId && (
                                <div onClick={() => setCurrentFolderId(null)} className="p-4 border-b border-claude-border/60 flex items-center gap-2 bg-claude-bg/50 active:bg-claude-bg">
                                    <ChevronLeft className="w-5 h-5 text-claude-secondary" />
                                    <span className="text-sm font-bold truncate text-claude-text">{folders.find(f => f.id === currentFolderId)?.name}</span>
                                </div>
                            )}
                            <div className="divide-y divide-claude-border/60">
                                {!currentFolderId && folders.length === 0 && files.length === 0 ? (
                                    <div className="py-10 text-center font-medium text-claude-secondary text-sm">Directory is empty</div>
                                ) : (
                                    <>
                                        {!currentFolderId && folders.map(folder => (
                                            <div key={folder.id} onClick={() => setCurrentFolderId(folder.id)} className="p-4 flex items-center justify-between active:bg-claude-border/50 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                                                        <Folder className="w-5 h-5 text-amber-500" fill="currentColor" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm text-claude-text">{folder.name}</div>
                                                        <div className="text-xs font-medium text-claude-secondary">{folder.file_count || 0} items</div>
                                                    </div>
                                                </div>
                                                {isAdmin && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(e, folder.id); }} className="p-2 text-red-500">
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {files.map(file => (
                                            <div key={file.id} onClick={() => handleViewFile(file)} className="p-4 flex items-center justify-between active:bg-claude-border/50 transition-colors">
                                                <div className="flex items-center gap-4 min-w-0 pr-2">
                                                    <div className="w-10 h-10 rounded-xl bg-claude-border/50 border border-claude-border flex items-center justify-center shrink-0">
                                                        <FileText className="w-5 h-5 text-claude-secondary" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-sm truncate block text-claude-text">{file.name}</span>
                                                        <div className="text-xs font-bold uppercase tracking-wider text-claude-secondary">{file.file_type}</div>
                                                    </div>
                                                </div>
                                                {(isAdmin || file.uploaded_by === currentUserId) && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFile(e, file.id); }} className="p-2 text-red-500 shrink-0">
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {currentFolderId && files.length === 0 && (
                                            <div className="py-8 text-center text-claude-secondary font-medium text-sm">Folder is empty</div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="gsap-mobile-item flex items-center justify-between pl-2 pr-1">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-claude-text"><Users className="w-5 h-5 text-claude-accent" /> Members</h2>
                            <span className="text-xs font-bold text-claude-text bg-claude-surface border border-claude-border px-3 py-1.5 rounded-xl">{members.length}</span>
                        </div>
                        <div className="gsap-mobile-item divide-y divide-claude-border/50 bg-claude-surface/40 backdrop-blur-xl rounded-3xl border border-claude-border/50 shadow-sm">
                            {members.map(member => (
                                <div key={member.id} className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <img src={member.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${member.username}`} alt="" className="w-12 h-12 rounded-full bg-white border border-claude-border p-0.5" />
                                        <div className="min-w-0">
                                            <div className="font-bold text-sm truncate text-claude-text">{member.display_name || member.username}</div>
                                            <div className="text-xs font-medium text-claude-secondary truncate mt-0.5">@{member.username} {member.role === 'admin' && '· Admin'}</div>
                                        </div>
                                    </div>
                                    {member.id !== currentUserId && (
                                        <div className="relative">
                                            <button onClick={() => setActiveMemberMenuId(activeMemberMenuId === member.id ? null : member.id)} className="p-2 text-claude-secondary active:bg-claude-border/50 rounded-xl transition-colors">
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                            {activeMemberMenuId === member.id && (
                                                <div className="absolute right-0 bottom-full mb-2 w-40 bg-claude-bg border border-claude-border rounded-2xl shadow-xl overflow-hidden z-20">
                                                    {isAdmin && member.role !== 'admin' && <button onClick={() => { handleRemoveMember(member.id, member.username); setActiveMemberMenuId(null); }} className="w-full text-left px-5 py-3.5 text-sm font-bold text-red-500 hover:bg-red-500/10 border-b border-claude-border/50 transition-colors">Remove</button>}
                                                    <button onClick={() => { handleBlockUser(member.id, member.username); setActiveMemberMenuId(null); }} className="w-full text-left px-5 py-3.5 text-sm font-bold text-red-500 hover:bg-red-500/10 border-b border-claude-border/50 transition-colors">Block</button>
                                                    <button onClick={() => { setReportingUserId(member.id); setIsReportModalOpen(true); setActiveMemberMenuId(null); }} className="w-full text-left px-5 py-3.5 text-sm font-bold text-claude-text hover:bg-claude-surface transition-colors">Report</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="gsap-mobile-item fixed bottom-0 left-0 right-0 p-4 pb-safe bg-claude-bg/70 backdrop-blur-3xl z-30 border-t border-claude-border/50">
                    <div className="flex gap-3">
                        <button onClick={() => setShowUploadModal(true)} className="flex-1 py-4 rounded-2xl border border-claude-border/50 bg-claude-surface/40 backdrop-blur-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm text-claude-text gsap-hover-card">
                            <Upload className="w-5 h-5" /> Upload File
                        </button>
                        <button onClick={() => setShowShareDeckModal(true)} className="flex-1 py-4 rounded-2xl bg-claude-accent text-claude-text font-bold text-sm flex items-center justify-center gap-2 shadow-sm gsap-hover-card">
                            <Zap className="w-5 h-5 fill-current" /> Start Cram
                        </button>
                    </div>
                </div>
            </div>

            {/* --- MODALS --- */}
            <AnimatePresence>
                {showSettings && isAdmin && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.form
                            initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onSubmit={handleUpdateGroup}
                            className="relative bg-claude-bg/70 backdrop-blur-3xl w-full max-w-md p-6 md:p-8 rounded-[2rem] border border-claude-border/50 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl md:text-2xl font-bold font-sans text-claude-text">Group Settings</h3>
                                <button type="button" onClick={() => setShowSettings(false)} className="p-2 text-claude-secondary hover:bg-claude-surface rounded-full transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-5 mb-8">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2 pl-1">Group Name</label>
                                    <input type="text" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full bg-claude-surface/40 backdrop-blur-xl border border-claude-border/50 rounded-2xl px-5 py-4 font-bold text-claude-text focus:border-claude-accent outline-none transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2 pl-1">Class</label>
                                    <select value={editData.class_id || ''} onChange={e => setEditData({ ...editData, class_id: e.target.value })} className="w-full bg-claude-surface/40 backdrop-blur-xl border border-claude-border/50 rounded-2xl px-5 py-4 font-bold text-claude-text focus:border-claude-accent outline-none appearance-none transition-colors">
                                        <option value="">Independent Study</option>
                                        {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                                    </select>
                                </div>
                                <button type="button" onClick={handleRegenerateCode} className="w-full py-4 mt-2 rounded-2xl border border-claude-border/80 font-bold text-sm hover:bg-claude-surface transition-colors text-claude-text">
                                    Regenerate Invite Code
                                </button>
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={handleDelete} className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl hover:bg-red-500/20 transition-colors">
                                    <Trash2 className="w-6 h-6" />
                                </button>
                                <button type="submit" className="flex-1 py-4 bg-claude-accent text-claude-text font-bold text-sm tracking-wide uppercase rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center">
                                    Save Changes
                                </button>
                            </div>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showShareDeckModal && (
                    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShareDeckModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div
                            initial={{ y: '100%', md: { scale: 0.95, opacity: 0, y: 0 } }}
                            animate={{ y: 0, md: { scale: 1, opacity: 1, y: 0 } }}
                            exit={{ y: '100%', md: { scale: 0.95, opacity: 0, y: 0 } }}
                            className="relative bg-claude-bg/70 backdrop-blur-3xl w-full max-w-md p-6 md:p-8 rounded-t-[2.5rem] md:rounded-[2rem] border border-claude-border/50 shadow-2xl max-h-[85vh] md:max-h-[75vh] flex flex-col"
                        >
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <h3 className="text-xl md:text-2xl font-bold font-sans text-claude-text">Share Deck</h3>
                                <button onClick={() => setShowShareDeckModal(false)} className="p-2 text-claude-secondary hover:bg-claude-surface rounded-full transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto min-h-[300px] border border-claude-border/50 rounded-2xl bg-claude-surface/40 backdrop-blur-xl no-scrollbar">
                                {myDecks.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-claude-secondary p-6 text-center">
                                        <Layers className="w-10 h-10 mb-4 opacity-30" />
                                        <p className="font-medium text-sm">No personal decks available.<br />Create a deck first to share it here.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-claude-border/60">
                                        {myDecks.filter(d => !sharedDecks.find(sd => sd.deck_id === d.id)).map(deck => (
                                            <div key={deck.id} onClick={() => handleShareDeck(deck.id)} className="p-5 flex items-center justify-between hover:bg-claude-border/40 cursor-pointer transition-colors group">
                                                <div className="font-bold text-sm truncate text-claude-text pr-4">{deck.title}</div>
                                                <button className="text-xs font-bold text-claude-accent bg-claude-accent/10 px-4 py-2 rounded-xl group-hover:bg-claude-accent group-hover:text-claude-text transition-colors uppercase tracking-wider shrink-0">Share</button>
                                            </div>
                                        ))}
                                        {myDecks.filter(d => !sharedDecks.find(sd => sd.deck_id === d.id)).length === 0 && (
                                            <div className="p-10 text-center font-medium text-claude-secondary text-sm">All your decks are already shared!</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showCreateFolderModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateFolderModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.form
                            initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onSubmit={handleCreateFolder}
                            className="relative bg-claude-bg/70 backdrop-blur-3xl w-full max-w-sm p-6 md:p-8 rounded-[2rem] border border-claude-border/50 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl md:text-2xl font-bold font-sans text-claude-text">New Folder</h3>
                                <button type="button" onClick={() => setShowCreateFolderModal(false)} className="p-2 text-claude-secondary hover:bg-claude-surface rounded-full transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="mb-8">
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2 pl-1">Folder Name</label>
                                <input type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="w-full bg-claude-surface/40 backdrop-blur-xl border border-claude-border/50 rounded-2xl px-5 py-4 font-bold text-claude-text focus:border-claude-accent outline-none transition-colors" autoFocus placeholder="e.g. Midterm Reviews" />
                            </div>
                            <button type="submit" disabled={!newFolderName.trim()} className="w-full py-4 bg-claude-accent text-claude-text font-bold text-sm tracking-wide uppercase rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50">
                                Create Folder
                            </button>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showUploadModal && (
                    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={uploadStep !== 'generating' ? closeUploadModal : undefined} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div
                            initial={{ y: '100%', md: { scale: 0.95, opacity: 0, y: 0 } }}
                            animate={{ y: 0, md: { scale: 1, opacity: 1, y: 0 } }}
                            exit={{ y: '100%', md: { scale: 0.95, opacity: 0, y: 0 } }}
                            className="relative bg-claude-bg/70 backdrop-blur-3xl w-full max-w-md p-6 md:p-8 rounded-t-[2.5rem] md:rounded-[2rem] border border-claude-border/50 shadow-2xl overflow-hidden"
                        >
                            <AnimatePresence mode="popLayout">
                                {uploadStep === 'form' && (
                                    <motion.form key="step_form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleUploadInitialSubmit}>
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-xl md:text-2xl font-bold font-sans text-claude-text flex items-center gap-3">
                                                <Upload className="w-6 h-6 text-claude-accent" /> Upload File
                                            </h3>
                                            <button type="button" onClick={closeUploadModal} className="p-2 text-claude-secondary hover:bg-claude-surface rounded-full transition-colors">
                                                <X className="w-6 h-6" />
                                            </button>
                                        </div>
                                        <div className="space-y-5 mb-8">
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2 pl-1">File Name</label>
                                                <input type="text" value={uploadData.name} onChange={e => setUploadData({ ...uploadData, name: e.target.value })} className="w-full bg-claude-surface/40 backdrop-blur-xl border border-claude-border/50 rounded-2xl px-5 py-4 font-bold text-claude-text focus:border-claude-accent outline-none" placeholder="e.g. Chapter 1 Notes" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2 pl-1">Select File</label>
                                                <input type="file" onChange={e => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        let typeString = 'pdf';
                                                        if (file.type.includes('image')) typeString = 'image';
                                                        else if (file.type.includes('word') || file.name.endsWith('.docx')) typeString = 'docx';
                                                        setUploadData(prev => ({ ...prev, file: file, file_type: typeString, name: prev.name || file.name.split('.')[0] }));
                                                    }
                                                }} className="w-full file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-claude-accent/10 file:text-claude-accent hover:file:bg-claude-accent/20 bg-claude-surface/40 backdrop-blur-xl border border-claude-border/50 rounded-2xl p-2.5 text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2 pl-1">File Type</label>
                                                <select value={uploadData.file_type} onChange={e => setUploadData({ ...uploadData, file_type: e.target.value })} className="w-full bg-claude-surface/40 backdrop-blur-xl border border-claude-border/50 rounded-2xl px-5 py-4 font-bold text-claude-text focus:border-claude-accent outline-none appearance-none">
                                                    <option value="pdf">PDF Document</option>
                                                    <option value="image">Image (PNG/JPG)</option>
                                                    <option value="docx">Word Document</option>
                                                    <option value="link">Web Link</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button type="submit" disabled={!uploadData.name.trim() || !uploadData.file} className="w-full py-4 bg-claude-accent text-claude-text font-bold text-sm tracking-wide uppercase rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50">
                                            Continue
                                        </button>
                                    </motion.form>
                                )}

                                {uploadStep === 'ai_prompt' && (
                                    <motion.div key="step_ai" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="py-8 text-center">
                                        <div className="w-20 h-20 rounded-3xl bg-claude-accent/10 flex items-center justify-center mx-auto mb-6 border border-claude-accent/20">
                                            <span className="text-3xl">✨</span>
                                        </div>
                                        <h3 className="text-2xl font-bold mb-3 text-claude-text">Generate Flashcards?</h3>
                                        <p className="text-sm font-medium text-claude-secondary mb-8 px-4 leading-relaxed">
                                            Riven can automatically create flashcards from your file and share them with the group.
                                        </p>
                                        <div className="space-y-3">
                                            <button onClick={handleUploadWithAi} className="w-full py-4 bg-claude-accent text-claude-text font-bold text-sm tracking-wide uppercase rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                                                <span>✨</span> Yes, create a deck
                                            </button>
                                            <button onClick={finalizeFileUpload} className="w-full py-4 bg-claude-surface border border-claude-border font-bold text-sm tracking-wide uppercase rounded-2xl hover:bg-claude-border/50 transition-colors text-claude-text">
                                                Skip for now
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {uploadStep === 'generating' && (
                                    <motion.div key="step_generating" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-16 text-center flex flex-col items-center">
                                        <div className="relative w-20 h-20 mb-8">
                                            <div className="absolute inset-0 bg-claude-accent/20 rounded-full blur-xl animate-pulse" />
                                            <div className="absolute inset-0 border-4 border-claude-accent/30 border-t-claude-accent rounded-full animate-spin" />
                                        </div>
                                        <h3 className="text-2xl font-bold mb-2 text-claude-text">Generating Deck...</h3>
                                        <p className="text-sm font-medium text-claude-secondary">Creating flashcards from your file...</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmModal isOpen={confirmModal.show} title={confirmModal.title} message={confirmModal.message} onConfirm={handleConfirmAction} onCancel={() => setConfirmModal({ show: false, title: '', message: '', action: null })} />
            <ReportModal isOpen={isReportModalOpen} onClose={() => { setIsReportModalOpen(false); setReportingUserId(null); }} onSubmit={handleReportUserSubmit} isSubmitting={isReporting} />
            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
            <FileViewer file={selectedFile} isOpen={isFileViewerOpen} onClose={() => setIsFileViewerOpen(false)} />
        </div>
    );
}
