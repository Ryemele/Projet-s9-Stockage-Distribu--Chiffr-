import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get all teams for current user
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = getDB();
        // Get teams where user is owner or member
        const teams = await db.all(
            `SELECT t.*, 
              (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
              CASE WHEN t.owner_id = ? THEN 'owner' ELSE 'member' END as user_role
       FROM teams t
       LEFT JOIN team_members tm ON t.id = tm.team_id
       WHERE t.owner_id = ? OR tm.user_id = ?
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
            [userId, userId, userId]
        );

        res.json({ teams });
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

// Get team by ID with members
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const db = getDB();

        // Check access
        const access = await db.get(
            `SELECT t.* FROM teams t
       LEFT JOIN team_members tm ON t.id = tm.team_id
       WHERE t.id = ? AND (t.owner_id = ? OR tm.user_id = ?)`,
            [id, userId, userId]
        );

        if (!access) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Get members
        const members = await db.all(
            `SELECT u.id, u.email, u.name, tm.role, tm.joined_at
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = ?`,
            [id]
        );

        // Get team files
        const files = await db.all(
            `SELECT f.*, tf.shared_at, u.email as shared_by_email
       FROM team_files tf
       JOIN files f ON tf.file_id = f.id
       JOIN users u ON tf.shared_by = u.id
       WHERE tf.team_id = ?`,
            [id]
        );

        res.json({ team: access, members, files });
    } catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({ error: 'Failed to fetch team' });
    }
});

// Create team
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, description, color } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Team name is required' });
        }

        const db = getDB();
        const id = uuidv4();
        const now = new Date().toISOString();

        await db.run(
            `INSERT INTO teams (id, name, description, owner_id, avatar_color, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [id, name, description || '', userId, color || '#6366f1', now]
        );

        // Add owner as a member with 'owner' role
        await db.run(
            `INSERT INTO team_members (id, team_id, user_id, role, joined_at)
       VALUES (?, ?, ?, 'owner', ?)`,
            [uuidv4(), id, userId, now]
        );

        const team = await db.get('SELECT * FROM teams WHERE id = ?', [id]);
        res.status(201).json({ team });
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ error: 'Failed to create team' });
    }
});

// Add member to team
router.post('/:id/members', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const { email, role } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const db = getDB();

        // Check if user is owner
        const team = await db.get(
            'SELECT * FROM teams WHERE id = ? AND owner_id = ?',
            [id, userId]
        );

        if (!team) {
            return res.status(403).json({ error: 'Only team owner can add members' });
        }

        // Find user by email
        const newMember = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (!newMember) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if already a member
        const existing = await db.get(
            'SELECT * FROM team_members WHERE team_id = ? AND user_id = ?',
            [id, newMember.id]
        );

        if (existing) {
            return res.status(400).json({ error: 'User is already a member' });
        }

        const now = new Date().toISOString();
        await db.run(
            `INSERT INTO team_members (id, team_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), id, newMember.id, role || 'member', now]
        );

        res.status(201).json({ message: 'Member added successfully' });
    } catch (error) {
        console.error('Error adding member:', error);
        res.status(500).json({ error: 'Failed to add member' });
    }
});

// Remove member from team
router.delete('/:id/members/:memberId', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id, memberId } = req.params;
        const db = getDB();

        // Check if user is owner
        const team = await db.get(
            'SELECT * FROM teams WHERE id = ? AND owner_id = ?',
            [id, userId]
        );

        if (!team) {
            return res.status(403).json({ error: 'Only team owner can remove members' });
        }

        // Can't remove owner
        if (memberId === userId) {
            return res.status(400).json({ error: 'Owner cannot be removed' });
        }

        await db.run(
            'DELETE FROM team_members WHERE team_id = ? AND user_id = ?',
            [id, memberId]
        );

        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

// Share file with team
router.post('/:id/files', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const { fileId } = req.body;

        if (!fileId) {
            return res.status(400).json({ error: 'File ID is required' });
        }

        const db = getDB();

        // Check team membership
        const member = await db.get(
            `SELECT * FROM team_members WHERE team_id = ? AND user_id = ?`,
            [id, userId]
        );

        if (!member) {
            return res.status(403).json({ error: 'You are not a member of this team' });
        }

        const now = new Date().toISOString();
        await db.run(
            `INSERT INTO team_files (id, team_id, file_id, shared_by, shared_at)
       VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), id, fileId, userId, now]
        );

        res.status(201).json({ message: 'File shared with team' });
    } catch (error) {
        console.error('Error sharing file:', error);
        res.status(500).json({ error: 'Failed to share file' });
    }
});

// Delete team
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const db = getDB();

        // Check if user is owner
        const team = await db.get(
            'SELECT * FROM teams WHERE id = ? AND owner_id = ?',
            [id, userId]
        );

        if (!team) {
            return res.status(403).json({ error: 'Only team owner can delete team' });
        }

        // Delete team files, members, then team
        await db.run('DELETE FROM team_files WHERE team_id = ?', [id]);
        await db.run('DELETE FROM team_members WHERE team_id = ?', [id]);
        await db.run('DELETE FROM teams WHERE id = ?', [id]);

        res.json({ message: 'Team deleted successfully' });
    } catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({ error: 'Failed to delete team' });
    }
});

export default router;
