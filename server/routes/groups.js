const crypto = require('crypto');
const express = require('express');

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

module.exports = function registerGroupsRoutes({ app, db, authMiddleware, io }) {
    const router = express.Router();

    // Mount router at /api/groups
    app.use('/api/groups', router);

    // Apply authMiddleware to all routes below
    router.use(authMiddleware);

    // 1. GET /api/groups - all groups user belongs to
    router.get('/', async (req, res) => {
        try {
            const query = `
                SELECT g.*, c.name as class_name,
                       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
                FROM study_groups g
                JOIN group_members gm ON g.id = gm.group_id
                LEFT JOIN classes c ON g.class_id = c.id
                WHERE gm.user_id = $1
                ORDER BY g.created_at DESC
            `;
            const groups = await db.query(query, [req.user.id]);
            res.json(groups);
        } catch (error) {
            console.error('Error fetching groups:', error);
            res.status(500).json({ error: 'Failed to fetch groups' });
        }
    });

    // 2. POST /api/groups - create a group
    router.post('/', async (req, res) => {
        const { name, class_id } = req.body;

        if (!name) return res.status(400).json({ error: 'Group name is required' });

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

    // 3. GET /api/groups/:id - single group details
    router.get('/:id', async (req, res) => {
        const { id } = req.params;
        try {
            // Verify membership
            const memberCheck = await db.queryOne(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [id, req.user.id]
            );

            if (!memberCheck) return res.status(403).json({ error: 'Not a member of this group' });

            const query = `
                SELECT g.*, c.name as class_name
                FROM study_groups g
                LEFT JOIN classes c ON g.class_id = c.id
                WHERE g.id = $1
            `;
            const group = await db.queryOne(query, [id]);

            if (!group) return res.status(404).json({ error: 'Group not found' });

            res.json({
                ...group,
                my_role: memberCheck.role
            });
        } catch (error) {
            console.error('Error fetching group details:', error);
            res.status(500).json({ error: 'Failed to fetch group details' });
        }
    });

    // 4. PUT /api/groups/:id - update group (admin only)
    router.put('/:id', async (req, res) => {
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
    router.delete('/:id', async (req, res) => {
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
    router.post('/join', async (req, res) => {
        const { join_code } = req.body;

        if (!join_code) return res.status(400).json({ error: 'Join code is required' });

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
    router.delete('/:id/leave', async (req, res) => {
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

    // 8. GET /api/groups/:id/members
    router.get('/:id/members', async (req, res) => {
        const { id } = req.params;
        try {
            // Verify membership
            const memberCheck = await db.queryOne(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [id, req.user.id]
            );

            if (!memberCheck) return res.status(403).json({ error: 'Not a member of this group' });

            const members = await db.query(`
                SELECT u.id, u.username, u.display_name, u.avatar, gm.role, gm.joined_at
                FROM group_members gm
                JOIN users u ON gm.user_id = u.id
                WHERE gm.group_id = $1
                ORDER BY gm.role ASC, gm.joined_at ASC
            `, [id]);

            res.json(members);
        } catch (error) {
            console.error('Error fetching group members:', error);
            res.status(500).json({ error: 'Failed to fetch group members' });
        }
    });

    // 9. DELETE /api/groups/:id/members/:userId - remove member (admin only)
    router.delete('/:id/members/:userId', async (req, res) => {
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

    // 10. GET /api/groups/:id/decks
    router.get('/:id/decks', async (req, res) => {
        const { id } = req.params;
        try {
            // Verify membership
            const memberCheck = await db.queryOne(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [id, req.user.id]
            );

            if (!memberCheck) return res.status(403).json({ error: 'Not a member of this group' });

            const decks = await db.query(`
                SELECT d.*, gd.shared_at, u.username as shared_by_name, u.avatar as shared_by_avatar,
                       (SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id) as card_count
                FROM group_decks gd
                JOIN decks d ON gd.deck_id = d.id
                JOIN users u ON gd.shared_by = u.id
                WHERE gd.group_id = $1
                ORDER BY gd.shared_at DESC
            `, [id]);

            res.json(decks);
        } catch (error) {
            console.error('Error fetching group decks:', error);
            res.status(500).json({ error: 'Failed to fetch group decks' });
        }
    });

    // 11. POST /api/groups/:id/decks - share a deck
    router.post('/:id/decks', async (req, res) => {
        const { id } = req.params;
        const { deck_id } = req.body;

        if (!deck_id) return res.status(400).json({ error: 'Deck ID is required' });

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
    router.delete('/:id/decks/:deckId', async (req, res) => {
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

    // 13. GET /api/groups/:id/folders
    router.get('/:id/folders', async (req, res) => {
        const { id } = req.params;
        try {
            const memberCheck = await db.queryOne('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
            if (!memberCheck) return res.status(403).json({ error: 'Not a member' });

            const folders = await db.query(`
                SELECT f.*, u.username as created_by_name,
                       (SELECT COUNT(*) FROM group_files file WHERE file.folder_id = f.id) as file_count
                FROM group_folders f
                JOIN users u ON f.created_by = u.id
                WHERE f.group_id = $1
                ORDER BY f.name ASC
            `, [id]);
            res.json(folders);
        } catch (error) {
            console.error('Error fetching folders:', error);
            res.status(500).json({ error: 'Failed to fetch folders' });
        }
    });

    // 14. POST /api/groups/:id/folders
    router.post('/:id/folders', async (req, res) => {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Folder name required' });
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

    // 17. GET /api/groups/:id/files
    router.get('/:id/files', async (req, res) => {
        const { id } = req.params;
        const { folder_id } = req.query;
        try {
            const memberCheck = await db.queryOne('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
            if (!memberCheck) return res.status(403).json({ error: 'Not a member' });

            let query = `
                SELECT f.*, u.username as uploaded_by_name, u.avatar as uploaded_by_avatar
                FROM group_files f
                JOIN users u ON f.uploaded_by = u.id
                WHERE f.group_id = $1
            `;
            const params = [id];

            if (folder_id) {
                if (folder_id === 'null' || folder_id === 'root') {
                    query += ' AND f.folder_id IS NULL';
                } else {
                    query += ' AND f.folder_id = $2';
                    params.push(folder_id);
                }
            }

            query += ' ORDER BY f.uploaded_at DESC';

            const files = await db.query(query, params);
            res.json(files);
        } catch (error) {
            console.error('Error fetching files:', error);
            res.status(500).json({ error: 'Failed to fetch files' });
        }
    });

    // 18. POST /api/groups/:id/files
    router.post('/:id/files', async (req, res) => {
        const { id } = req.params;
        const { name, file_url, file_type, folder_id } = req.body;
        if (!name || !file_url || !file_type) return res.status(400).json({ error: 'Missing file metadata' });
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

    // 20. GET /api/groups/:id/sessions
    router.get('/:id/sessions', async (req, res) => {
        const { id } = req.params;
        try {
            const memberCheck = await db.queryOne('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
            if (!memberCheck) return res.status(403).json({ error: 'Not a member' });

            const sessions = await db.query(`
                SELECT s.*, d.title as deck_title, d.description as deck_desc, u.username as started_by_name,
                       (SELECT COUNT(DISTINCT user_id) FROM cram_responses WHERE session_id = s.id) as active_members
                FROM cram_sessions s
                JOIN decks d ON s.deck_id = d.id
                JOIN users u ON s.started_by = u.id
                WHERE s.group_id = $1 AND s.status = 'active'
                ORDER BY s.started_at DESC
            `, [id]);
            res.json(sessions);
        } catch (error) {
            console.error('Error fetching sessions:', error);
            res.status(500).json({ error: 'Failed to fetch active sessions' });
        }
    });

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

            // Optional: Broadcast explicitly to the group room if we track them
            if (io) {
                io.emit(`group-${id}-session-started`, { sessionId: newSession.id, deckId: deck_id });
            }

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

            // Just return success. Real-time presence is handled by clients tracking via socket.io rooms (e.g., room "session-UUID")
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

            // Broadcast via Socket so other group members see progress indicator blips
            if (io) {
                // We emit to everyone tracking this session ID
                io.to(`session-${sessionId}`).emit('session-progress', { userId: req.user.id });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Error recording session response:', error);
            res.status(500).json({ error: 'Failed to record response' });
        }
    });

    // 24. GET /api/groups/sessions/:sessionId/results
    router.get('/sessions/:sessionId/results', async (req, res) => {
        const { sessionId } = req.params;
        try {
            const session = await db.queryOne('SELECT * FROM cram_sessions WHERE id = $1', [sessionId]);
            if (!session) return res.status(404).json({ error: 'Session not found' });

            const memberCheck = await db.queryOne('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [session.group_id, req.user.id]);
            if (!memberCheck) return res.status(403).json({ error: 'Not a member' });

            // Calculate cards that the majority of the group got wrong
            const results = await db.query(`
                WITH CardStats as (
                    SELECT 
                        card_id, 
                        COUNT(user_id) as total_responses,
                        SUM(CASE WHEN knew_it = false THEN 1 ELSE 0 END) as incorrect_count
                    FROM cram_responses
                    WHERE session_id = $1
                    GROUP BY card_id
                )
                SELECT c.*, cs.total_responses, cs.incorrect_count
                FROM CardStats cs
                JOIN cards c ON cs.card_id = c.id
                WHERE cs.incorrect_count > 0 
                  AND CAST(cs.incorrect_count AS FLOAT) / cs.total_responses >= 0.5
                ORDER BY cs.incorrect_count DESC
                LIMIT 10
            `, [sessionId]);

            // Also send back personal stats for this specific user
            const personalStats = await db.queryOne(`
                SELECT 
                    COUNT(*) as total_answered,
                    SUM(CASE WHEN knew_it = true THEN 1 ELSE 0 END) as total_correct
                FROM cram_responses
                WHERE session_id = $1 AND user_id = $2
            `, [sessionId, req.user.id]);

            res.json({ weakSpots: results, personalStats });
        } catch (error) {
            console.error('Error fetching session results:', error);
            res.status(500).json({ error: 'Failed to compute session results' });
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

            if (io) {
                io.to(`session-${sessionId}`).emit('session-ended');
                io.emit(`group-${session.group_id}-session-ended`);
            }

            res.json({ message: 'Session ended' });
        } catch (error) {
            console.error('Error ending session:', error);
            res.status(500).json({ error: 'Failed to end session' });
        }
    });

}
