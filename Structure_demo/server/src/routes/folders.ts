import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get all folders for current user
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = getDB();
        const folders = await db.all(
            `SELECT * FROM folders WHERE user_id = ? ORDER BY created_at DESC`,
            [userId]
        );

        res.json({ folders });
    } catch (error) {
        console.error('Error fetching folders:', error);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});

// Create folder
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, parentId, color } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }

        const db = getDB();
        const id = uuidv4();
        const now = new Date().toISOString();

        await db.run(
            `INSERT INTO folders (id, user_id, name, parent_id, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, userId, name, parentId || null, color || '#6366f1', now, now]
        );

        const folder = await db.get('SELECT * FROM folders WHERE id = ?', [id]);
        res.status(201).json({ folder });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// Update folder
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const { name, color } = req.body;

        const db = getDB();

        // Check ownership
        const folder = await db.get(
            'SELECT * FROM folders WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const now = new Date().toISOString();
        await db.run(
            `UPDATE folders SET name = ?, color = ?, updated_at = ? WHERE id = ?`,
            [name || folder.name, color || folder.color, now, id]
        );

        const updated = await db.get('SELECT * FROM folders WHERE id = ?', [id]);
        res.json({ folder: updated });
    } catch (error) {
        console.error('Error updating folder:', error);
        res.status(500).json({ error: 'Failed to update folder' });
    }
});

// Delete folder
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const db = getDB();

        // Check ownership
        const folder = await db.get(
            'SELECT * FROM folders WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        // Delete folder (files inside will have null folder_id)
        await db.run('DELETE FROM folders WHERE id = ?', [id]);

        res.json({ message: 'Folder deleted successfully' });
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

export default router;
