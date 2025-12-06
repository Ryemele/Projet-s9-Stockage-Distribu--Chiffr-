import { Router, Request, Response } from 'express';
import { getDB } from '../db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get User Public Key
router.get('/:email/public-key', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { email } = req.params;
        const db = getDB();

        const user = await db.get('SELECT public_key FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let publicKey = user.public_key;
        try {
            publicKey = JSON.parse(user.public_key);
        } catch (e) { }

        res.json({ publicKey });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
