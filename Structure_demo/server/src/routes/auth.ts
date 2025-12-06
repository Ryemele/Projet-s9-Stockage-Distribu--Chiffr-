import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// SECURITY: JWT_SECRET must be defined in environment - no fallback allowed
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set!');
    process.exit(1);
}

// Email validation regex (stricter than client-side)
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Password validation
const validatePassword = (password: string): { valid: boolean; message: string } => {
    if (!password || password.length < 12) {
        return { valid: false, message: 'Password must be at least 12 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number' };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one special character' };
    }
    return { valid: true, message: '' };
};

// Register
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password, name, publicKey, keyDerivationSalt } = req.body;
        const db = getDB();

        // SECURITY: Validate email format
        if (!email || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // SECURITY: Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ message: passwordValidation.message });
        }

        // SECURITY: Validate name
        if (!name || name.trim().length < 2 || name.length > 100) {
            return res.status(400).json({ message: 'Name must be between 2 and 100 characters' });
        }

        const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 12); // Increased from 10 to 12
        const userId = uuidv4();
        const createdAt = new Date().toISOString();

        // Store public key as JSON string if it's an object
        const publicKeyStr = typeof publicKey === 'string' ? publicKey : JSON.stringify(publicKey);

        await db.run(
            'INSERT INTO users (id, email, password_hash, name, public_key, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, email, hashedPassword, name, publicKeyStr, createdAt]
        );

        const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            token,
            user: {
                id: userId,
                email,
                name,
                publicKey,
                createdAt,
                keyDerivationSalt
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const db = getDB();

        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

        // Parse public key if it's stored as JSON string
        let publicKey = user.public_key;
        try {
            publicKey = JSON.parse(user.public_key);
        } catch (e) {
            // Keep as string if not JSON
        }

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                publicKey: publicKey,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get Current User
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user?.id;
        const db = getDB();

        const user = await db.get('SELECT id, email, name, public_key, created_at FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let publicKey = user.public_key;
        try {
            publicKey = JSON.parse(user.public_key);
        } catch (e) { }

        res.json({
            ...user,
            publicKey
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Logout (Client-side mainly, but endpoint for consistency)
router.post('/logout', (req, res) => {
    res.sendStatus(200);
});

export default router;
