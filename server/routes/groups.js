const crypto = require('crypto');
const express = require('express');
const { createGroupSchema, joinGroupSchema, updateGroupSchema, groupIdParamSchema, shareDeckSchema, createFolderSchema, createFileSchema, memberIdParamSchema } = require('../schemas/groups');
const { handleValidationErrors } = require('../utils/validate');

// Generate a group join code (e.g. RIV-4X2)
function generateJoinCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'RIV-';
    const bytes = crypto.randomBytes(3);
    for (let i = 0; i < 3; i++) {
        result += chars.charAt(bytes[i] % chars.length);
    }
    return result;
}

module.exports = function registerGroupsRoutes({ app, db, authMiddleware }) {
    const router = express.Router();

    // Mount router at /api/groups
    app.use('/api/groups', router);

    // Apply authMiddleware to all routes below
    router.use(authMiddleware);

    // 2. POST /api/groups - create a group
    router.post('/', createGroupSchema, handleValidationErrors, async (req, res) => {
        const { name, class_id } = req.body;

        try {
            // Check if user is banned
            const currentUser = await db.queryOne('SELECT is_banned FROM users WHERE id = $1', [req.user.id]);
            if (currentUser && currentUser.is_banned) {
                return res.status(403).json({ error: 'Your account has been restricted from creating study groups.' });
            }

            // Start transaction
            const client = await db.pool.connect();
            try {
                await client.query('BEGIN');

                let join_code = generateJoinCode();
                let codeExists = true;

                // Ensure uniqueness
                while (codeExists) {
                    const existing = await client.query('SELECT 1 FROM study_groups WHERE join_code = $1', [join_code]);
                    if (existing.rows.length === 0) {
                        codeExists = false;
                    } else {
                        join_code = generateJoinCode();
                    }
                }

                // Insert into study_groups
                const insertGroupQuery = `
                    INSERT INTO study_groups (name, class_id, join_code, created_by) 
                    VALUES ($1, $2, $3, $4) 
                    RETURNING *
                `;
                const groupResult = await client.query(insertGroupQuery, [name, class_id || null, join_code, req.user.id]);
                const newGroup = groupResult.rows[0];

                // Insert into group_members as admin
                const insertMemberQuery = `
                    INSERT INTO group_members (group_id, user_id, role) 
                    VALUES ($1, $2, 'admin')
                `;
                await client.query(insertMemberQuery, [newGroup.id, req.user.id]);

                await client.query('COMMIT');

                // Construct return object with some extra details
                res.status(201).json({
                    ...newGroup,
                    member_count: 1,
                    role: 'admin'
                });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error creating group:', error);
            res.status(500).json({ error: 'Failed to create group' });
        }
    });

    // 4. PUT /api/groups/:id - update group (admin only)
    router.put('/:id', updateGroupSchema, handleValidationErrors, async (req, res) => {
        const { id } = req.params;
        const { name, class_id, regenerate_code } = req.body;

        try {
            // Verify admin status
            const memberCheck = await db.queryOne(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [id, req.user.id]
            );

            if (!memberCheck || memberCheck.role !== 'admin') {
                return res.status(403).json({ error: 'Admin permission required' });
            }

            let updateQuery = 'UPDATE study_groups SET name = COALESCE($1, name), class_id = $2';
            let params = [name || null, class_id || null];
            let paramIndex = 3;

            if (regenerate_code) {
                let join_code = generateJoinCode();
                let codeExists = true;

                while (codeExists) {
                    const existing = await db.queryOne('SELECT 1 FROM study_groups WHERE join_code = $1', [join_code]);
                    if (!existing) {
                        codeExists = false;
                    } else {
                        join_code = generateJoinCode();
                    }
                }
                updateQuery += `, join_code = $${paramIndex}`;
                params.push(join_code);
                paramIndex++;
            }

            updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
            params.push(id);

            const updated = await db.queryOne(updateQuery, params);
            res.json(updated);
        } catch (error) {
            console.error('Error updating group:', error);
            res.status(500).json({ error: 'Failed to update group' });
        }
    });

    // 5. DELETE /api/groups/:id - delete group (admin only)
    router.delete('/:id', groupIdParamSchema, handleValidationErrors, async (req, res) => {
        const { id } = req.params;
        try {
            // Verify admin status
            const memberCheck = await db.queryOne(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [id, req.user.id]
            );

            if (!memberCheck || memberCheck.role !== 'admin') {
                return res.status(403).json({ error: 'Admin permission required' });
            }

            await db.execute('DELETE FROM study_groups WHERE id = $1', [id]);
            res.json({ message: 'Group deleted successfully' });
        } catch (error) {
            console.error('Error deleting group:', error);
            res.status(500).json({ error: 'Failed to delete group' });
        }
    });

    // 6. POST /api/groups/join - join via code
    router.post('/join', joinGroupSchema, handleValidationErrors, async (req, res) => {
        const { join_code } = req.body;
        const formattedCode = join_code.toUpperCase().trim();

        try {
            // Check if user is banned
            const currentUser = await db.queryOne('SELECT is_banned FROM users WHERE id = $1', [req.user.id]);
            if (currentUser && currentUser.is_banned) {
                return res.status(403).json({ error: 'Your account has been restricted from joining study groups.' });
            }

            const group = await db.queryOne('SELECT id, name FROM study_groups WHERE join_code = $1', [formattedCode]);

            if (!group) return res.status(404).json({ error: 'Invalid join code' });

            const existingMember = await db.queryOne(
                'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
                [group.id, req.user.id]
            );

            if (existingMember) {
                return res.status(400).json({ error: 'You are already a member of this group', group });
            }

            await db.execute(
                'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
                [group.id, req.user.id, 'member']
            );

            res.json({ message: 'Successfully joined group', group });
        } catch (error) {
            console.error('Error joining group:', error);
            res.status(500).json({ error: 'Failed to join group' });
        }
    });

    // 7. DELETE /api/groups/:id/leave - leave a group
    router.delete('/:id/leave', groupIdParamSchema, handleValidationErrors, async (req, res) => {
        const { id } = req.params;
        try {
            // Check if they are the only admin
            const memberCheck = await db.queryOne(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [id, req.user.id]
            );

            if (!memberCheck) return res.status(404).json({ error: 'Not a member of this group' });

            if (memberCheck.role === 'admin') {
                const adminCountReq = await db.queryOne(
                    "SELECT COUNT(*) as count FROM group_members WHERE group_id = $1 AND role = 'admin'",
                    [id]
                );

                if (parseInt(adminCountReq.count) === 1) {
                    const memberCountReq = await db.queryOne(
                        "SELECT COUNT(*) as count FROM group_members WHERE group_id = $1",
                        [id]
                    );

                    if (parseInt(memberCountReq.count) > 1) {
                        return res.status(400).json({
                            error: 'You must promote another admin before leaving, or delete the group.'
                        });
                    } else {
                        // If they're the last person, delete the group entirely
                        await db.execute('DELETE FROM study_groups WHERE id = $1', [id]);
                        return res.json({ message: 'Group deleted as the last member left' });
                    }
                }
            }

            await db.execute('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
            res.json({ message: 'Left group successfully' });
        } catch (error) {
            console.error('Error leaving group:', error);
            res.status(500).json({ error: 'Failed to leave group' });
        }
    });

    // 9. DELETE /api/groups/:id/members/:userId - remove member (admin only)
    router.delete('/:id/members/:userId', memberIdParamSchema, handleValidationErrors, async (req, res) => {
        const { id, userId } = req.params;
        try {
            // Verify admin status
            const memberCheck = await db.queryOne(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [id, req.user.id]
            );

            if (!memberCheck || memberCheck.role !== 'admin') {
                return res.status(403).json({ error: 'Admin permission required' });
            }

            if (req.user.id.toString() === userId) {
                return res.status(400).json({ error: 'Use the leave endpoint to remove yourself' });
            }

            const targetMemberCheck = await db.queryOne(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [id, userId]
            );

            if (!targetMemberCheck) {
                return res.status(404).json({ error: 'User is not a member of this group' });
            }

            await db.execute('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [id, userId]);
            res.json({ message: 'User removed successfully' });
        } catch (error) {
            console.error('Error removing member:', error);
            res.status(500).json({ error: 'Failed to remove member' });
        }
    });

    // 11. POST /api/groups/:id/decks - share a deck
    router.post('/:id/decks', shareDeckSchema, handleValidationErrors, async (req, res) => {
        const { id } = req.params;
        const { deck_id } = req.body;

        try {
            // Verify membership
            const memberCheck = await db.queryOne(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [id, req.user.id]
            );

            if (!memberCheck) return res.status(403).json({ error: 'Not a member of this group' });

            // Verify they own the deck or have permission (for MVP, let's enforce ownership or it's public/already accessible)
            const deckCheck = await db.queryOne('SELECT id, user_id FROM decks WHERE id = $1', [deck_id]);
            if (!deckCheck) return res.status(404).json({ error: 'Deck not found' });

            // Only allow sharing if they own it or if we consider it public (for now requiring ownership)
            if (deckCheck.user_id !== req.user.id) {
                return res.status(403).json({ error: 'You must own a deck to share it' });
            }

            // Check if already shared
            const existing = await db.queryOne(
                'SELECT 1 FROM group_decks WHERE group_id = $1 AND deck_id = $2',
                [id, deck_id]
            );

            if (existing) {
                return res.status(400).json({ error: 'Deck is already shared in this group' });
            }

            await db.execute(
                'INSERT INTO group_decks (group_id, deck_id, shared_by) VALUES ($1, $2, $3)',
                [id, deck_id, req.user.id]
            );

            res.json({ message: 'Deck shared successfully' });
        } catch (error) {
            console.error('Error sharing deck:', error);
            res.status(500).json({ error: 'Failed to share deck' });
        }
    });

    // 12. DELETE /api/groups/:id/decks/:deckId - remove deck
    router.delete('/:id/decks/:deckId', groupIdParamSchema, handleValidationErrors, async (req, res) => {
        const { id, deckId } = req.params;
        try {
            // Verify membership & role
            const memberCheck = await db.queryOne(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [id, req.user.id]
            );

            if (!memberCheck) return res.status(403).json({ error: 'Not a member of this group' });

            const shareCheck = await db.queryOne(
                'SELECT shared_by FROM group_decks WHERE group_id = $1 AND deck_id = $2',
                [id, deckId]
            );

            if (!shareCheck) return res.status(404).json({ error: 'Deck not found in this group' });

            // Only admin OR the person who shared it can remove it
            if (memberCheck.role !== 'admin' && shareCheck.shared_by !== req.user.id) {
                return res.status(403).json({ error: 'Only group admins or the original sharer can remove this deck' });
            }

            await db.execute('DELETE FROM group_decks WHERE group_id = $1 AND deck_id = $2', [id, deckId]);
            res.json({ message: 'Deck removed from group' });
        } catch (error) {
            console.error('Error removing deck:', error);
            res.status(500).json({ error: 'Failed to remove deck' });
        }
    });

    // 14. POST /api/groups/:id/folders
    router.post('/:id/folders', createFolderSchema, handleValidationErrors, async (req, res) => {
        const { id } = req.params;
        const { name } = req.body;
        try {
            const memberCheck = await db.queryOne('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
            if (!memberCheck) return res.status(403).json({ error: 'Not a member' });

            const newFolder = await db.queryOne(
                'INSERT INTO group_folders (group_id, name, created_by) VALUES ($1, $2, $3) RETURNING *',
                [id, name, req.user.id]
            );
            res.json(newFolder);
        } catch (error) {
            console.error('Error creating folder:', error);
            res.status(500).json({ error: 'Failed to create folder' });
        }
    });

    // 15. PUT /api/groups/:id/folders/:folderId
    router.put('/:id/folders/:folderId', async (req, res) => {
        const { id, folderId } = req.params;
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Folder name required' });
        try {
            const memberCheck = await db.queryOne('SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
            if (!memberCheck) return res.status(403).json({ error: 'Not a member' });

            const folder = await db.queryOne('SELECT created_by FROM group_folders WHERE id = $1 AND group_id = $2', [folderId, id]);
            if (!folder) return res.status(404).json({ error: 'Folder not found' });

            if (memberCheck.role !== 'admin' && folder.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Only admins or the creator can rename this folder' });
            }

            const updatedFolder = await db.queryOne(
                'UPDATE group_folders SET name = $1 WHERE id = $2 RETURNING *',
                [name, folderId]
            );
            res.json(updatedFolder);
        } catch (error) {
            console.error('Error updating folder:', error);
            res.status(500).json({ error: 'Failed to update folder' });
        }
    });

    // 16. DELETE /api/groups/:id/folders/:folderId
    router.delete('/:id/folders/:folderId', async (req, res) => {
        const { id, folderId } = req.params;
        try {
            const memberCheck = await db.queryOne('SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
            if (!memberCheck) return res.status(403).json({ error: 'Not a member' });

            if (memberCheck.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can delete folders' });
            }

            await db.execute('DELETE FROM group_folders WHERE id = $1 AND group_id = $2', [folderId, id]);
            res.json({ message: 'Folder deleted' });
        } catch (error) {
            console.error('Error deleting folder:', error);
            res.status(500).json({ error: 'Failed to delete folder' });
        }
    });

    // 18. POST /api/groups/:id/files
    router.post('/:id/files', createFileSchema, handleValidationErrors, async (req, res) => {
        const { id } = req.params;
        const { name, file_url, file_type, folder_id } = req.body;
        try {
            const memberCheck = await db.queryOne('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
            if (!memberCheck) return res.status(403).json({ error: 'Not a member' });

            const newFile = await db.queryOne(
                'INSERT INTO group_files (group_id, folder_id, name, file_url, file_type, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [id, folder_id || null, name, file_url, file_type, req.user.id]
            );
            res.json(newFile);
        } catch (error) {
            console.error('Error uploading file:', error);
            res.status(500).json({ error: 'Failed to save file' });
        }
    });

    // 19. DELETE /api/groups/:id/files/:fileId
    router.delete('/:id/files/:fileId', async (req, res) => {
        const { id, fileId } = req.params;
        try {
            const memberCheck = await db.queryOne('SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
            if (!memberCheck) return res.status(403).json({ error: 'Not a member' });

            const file = await db.queryOne('SELECT uploaded_by, file_url FROM group_files WHERE id = $1 AND group_id = $2', [fileId, id]);
            if (!file) return res.status(404).json({ error: 'File not found' });

            if (memberCheck.role !== 'admin' && file.uploaded_by !== req.user.id) {
                return res.status(403).json({ error: 'Only admins or the uploader can delete this file' });
            }

            // Clean up Supabase Storage object if applicable
            const supabaseUrl = process.env.SUPABASE_URL;
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            const bucketPrefix = '/storage/v1/object/public/group-files/';
            if (supabaseUrl && serviceKey && file.file_url && file.file_url.includes(bucketPrefix)) {
                try {
                    const storagePath = file.file_url.split(bucketPrefix)[1];
                    if (storagePath) {
                        await fetch(`${supabaseUrl}/storage/v1/object/group-files/${storagePath}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
                        });
                    }
                } catch (storageErr) {
                    console.warn('Storage cleanup failed (non-fatal):', storageErr.message);
                }
            }

            await db.execute('DELETE FROM group_files WHERE id = $1 AND group_id = $2', [fileId, id]);
            res.json({ message: 'File deleted' });
        } catch (error) {
            console.error('Error deleting file:', error);
            res.status(500).json({ error: 'Failed to delete file' });
        }
    });

    // ==========================================
    // CRAM SESSIONS (Phase 5)
    // ==========================================

    // 21. POST /api/groups/:id/sessions
    router.post('/:id/sessions', async (req, res) => {
        const { id } = req.params;
        const { deck_id } = req.body;
        if (!deck_id) return res.status(400).json({ error: 'Deck ID required' });

        try {
            const memberCheck = await db.queryOne('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
            if (!memberCheck) return res.status(403).json({ error: 'Not a member' });

            const newSession = await db.queryOne(
                'INSERT INTO cram_sessions (group_id, deck_id, started_by) VALUES ($1, $2, $3) RETURNING *',
                [id, deck_id, req.user.id]
            );

            res.json(newSession);
        } catch (error) {
            console.error('Error starting session:', error);
            res.status(500).json({ error: 'Failed to start session' });
        }
    });

    // 22. POST /api/sessions/:sessionId/join
    // Note: Registered globally on the app, not just groups router to keep URLs simple,
    // but we can mount it here and adjust the prefix 
    // We'll actually map this inside the existing router, so it will be /api/groups/sessions/:sessionId/join to avoid root router pollution
    router.post('/sessions/:sessionId/join', async (req, res) => {
        const { sessionId } = req.params;
        try {
            const session = await db.queryOne('SELECT * FROM cram_sessions WHERE id = $1 AND status = $2', [sessionId, 'active']);
            if (!session) return res.status(404).json({ error: 'Active session not found' });

            const memberCheck = await db.queryOne('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [session.group_id, req.user.id]);
            if (!memberCheck) return res.status(403).json({ error: 'Not a member of this group' });

            // Just return success. Realtime presence is handled by Supabase subscriptions.
            res.json({ message: 'Joined session successfully', session });
        } catch (error) {
            console.error('Error joining session:', error);
            res.status(500).json({ error: 'Failed to join session' });
        }
    });

    // 23. POST /api/groups/sessions/:sessionId/respond
    router.post('/sessions/:sessionId/respond', async (req, res) => {
        const { sessionId } = req.params;
        const { card_id, knew_it } = req.body;
        if (!card_id || knew_it === undefined) return res.status(400).json({ error: 'Missing response data' });

        try {
            // Upsert response
            await db.query(`
                INSERT INTO cram_responses (session_id, user_id, card_id, knew_it) 
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (session_id, user_id, card_id) 
                DO UPDATE SET knew_it = EXCLUDED.knew_it, responded_at = now()
            `, [sessionId, req.user.id, card_id, knew_it]);

            res.json({ success: true });
        } catch (error) {
            console.error('Error recording session response:', error);
            res.status(500).json({ error: 'Failed to record response' });
        }
    });

    // 25. POST /api/groups/sessions/:sessionId/end (Admin or creator)
    router.post('/sessions/:sessionId/end', async (req, res) => {
        const { sessionId } = req.params;
        try {
            const session = await db.queryOne('SELECT * FROM cram_sessions WHERE id = $1', [sessionId]);
            if (!session) return res.status(404).json({ error: 'Session not found' });

            if (session.started_by != req.user.id) {
                const memberCheck = await db.queryOne('SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2', [session.group_id, req.user.id]);
                if (!memberCheck || memberCheck.role !== 'admin') {
                    return res.status(403).json({ error: 'Only the session starter or an admin can end the session' });
                }
            }

            await db.execute("UPDATE cram_sessions SET status = 'ended', ended_at = now() WHERE id = $1", [sessionId]);

            res.json({ message: 'Session ended' });
        } catch (error) {
            console.error('Error ending session:', error);
            res.status(500).json({ error: 'Failed to end session' });
        }
    });

}
