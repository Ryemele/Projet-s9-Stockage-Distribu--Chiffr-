import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const uploadDir = path.join(__dirname, '../../uploads');

// SECURITY: Maximum file size (100 MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// SECURITY: Allowed MIME types
const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/zip', 'application/x-zip-compressed',
    'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript',
    'application/json', 'application/xml',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    'video/mp4', 'video/webm', 'video/ogg',
    'application/octet-stream' // For encrypted data
];

// SECURITY: Sanitize filename to prevent path traversal
const sanitizeFileName = (fileName: string): string => {
    // Remove null bytes and control characters
    let sanitized = fileName.replace(/[\x00-\x1f\x80-\x9f]/g, '');
    // Get only the basename (prevent path traversal)
    sanitized = path.basename(sanitized);
    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[^a-zA-Z0-9.\-_ ()\[\]]/g, '_');
    // Limit length
    if (sanitized.length > 255) {
        const extIndex = sanitized.lastIndexOf('.');
        if (extIndex !== -1) {
            const ext = sanitized.substring(extIndex);
            sanitized = sanitized.substring(0, 255 - ext.length) + ext;
        } else {
            sanitized = sanitized.substring(0, 255);
        }
    }
    return sanitized || 'unnamed_file';
};

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // SECURITY: Sanitize the original filename
        const sanitized = sanitizeFileName(file.originalname);
        cb(null, `${uuidv4()}-${sanitized}`);
    }
});

// SECURITY: Configure multer with file size limits and type filtering
const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1 // Only one file at a time
    },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} is not allowed`));
        }
    }
});

// Upload File
router.post('/upload', authenticateToken, upload.single('file'), async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user?.id;
        const db = getDB();

        let fileData;

        if (req.file) {
            // Multipart upload
            const metadata = JSON.parse(req.body.metadata || '{}');
            console.log('[DEBUG] Multipart upload - metadata received:', JSON.stringify(metadata, null, 2));
            console.log('[DEBUG] metadata.iv:', metadata.iv);
            console.log('[DEBUG] metadata.iv type:', typeof metadata.iv);

            fileData = {
                id: uuidv4(),
                userId,
                name: metadata.name || req.file.originalname,
                size: req.file.size,
                mimeType: metadata.mimeType || req.file.mimetype,
                storagePath: req.file.path,
                iv: metadata.iv || '',
                salt: metadata.salt || '',
                uploadedAt: new Date().toISOString(),
                encryptedDataUrl: '' // Not used for file-based storage
            };
            console.log('[DEBUG] fileData.iv being stored:', fileData.iv);
        } else if (req.body.fileId) {
            // Envelope upload (JSON body)
            const { fileId, fileName, fileSize, mimeType, encryptedData, encryptionMetadata, timestamp } = req.body;

            // SECURITY: Sanitize the filename
            const sanitizedFileName = sanitizeFileName(fileName);

            // Save base64 data to file
            const buffer = Buffer.from(encryptedData, 'base64');
            const filePath = path.join(uploadDir, `${fileId}-${sanitizedFileName}`);
            fs.writeFileSync(filePath, buffer);

            // Store encryptionMetadata as JSON string in the iv field
            // This is required for the frontend to decrypt the file
            const ivData = typeof encryptionMetadata === 'string'
                ? encryptionMetadata
                : JSON.stringify(encryptionMetadata);

            fileData = {
                id: fileId,
                userId,
                name: sanitizedFileName,
                size: fileSize,
                mimeType: mimeType,
                storagePath: filePath,
                iv: ivData, // Contains encryptionMetadata JSON
                salt: timestamp || '',
                uploadedAt: new Date().toISOString(),
                encryptedDataUrl: '' // We store on disk now
            };
        } else {
            return res.status(400).json({ message: 'No file provided' });
        }

        await db.run(
            `INSERT INTO files (id, user_id, name, size, mime_type, storage_path, iv, salt, uploaded_at, encrypted_data_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [fileData.id, fileData.userId, fileData.name, fileData.size, fileData.mimeType, fileData.storagePath, fileData.iv, fileData.salt, fileData.uploadedAt, fileData.encryptedDataUrl]
        );

        res.status(201).json({
            id: fileData.id,
            name: fileData.name,
            size: fileData.size,
            mimeType: fileData.mimeType,
            uploadedAt: fileData.uploadedAt,
            userId: fileData.userId,
            iv: fileData.iv,
            salt: fileData.salt,
            encryptedDataUrl: `/api/files/${fileData.id}/download`
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// List Files
router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user?.id;
        const db = getDB();

        const files = await db.all('SELECT * FROM files WHERE user_id = ?', [userId]);

        const mappedFiles = files.map((f: any) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            mimeType: f.mime_type,
            uploadedAt: f.uploaded_at,
            userId: f.user_id,
            iv: f.iv,
            salt: f.salt,
            encryptedDataUrl: `/api/files/${f.id}/download`
        }));

        res.json(mappedFiles);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get Shared Files (must be before /:id route)
router.get('/shared', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userEmail = (req as AuthRequest).user?.email;
        const db = getDB();

        const shares = await db.all(`
      SELECT s.*, f.name as file_name, f.size as file_size, f.mime_type, f.iv, f.salt,
             u.public_key as owner_public_key, u.email as owner_email
      FROM shares s
      JOIN files f ON s.file_id = f.id
      JOIN users u ON f.user_id = u.id
      WHERE s.shared_with = ?
    `, [userEmail]);

        res.json(shares.map((s: any) => {
            // Parse owner's public key
            let ownerPublicKey;
            try {
                ownerPublicKey = JSON.parse(s.owner_public_key);
            } catch (e) {
                ownerPublicKey = s.owner_public_key;
            }

            return {
                id: s.id,
                fileId: s.file_id,
                sharedBy: s.shared_by,
                sharedWith: s.shared_with,
                encryptedKey: s.encrypted_key,
                permissions: s.permissions,
                sharedAt: s.created_at,
                fileName: s.file_name,
                fileSize: s.file_size,
                mimeType: s.mime_type,
                ownerPublicKey: ownerPublicKey,
                ownerEmail: s.owner_email
            };
        }));
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get File Metadata
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user?.id;
        const userEmail = (req as AuthRequest).user?.email;
        const db = getDB();

        // First, get the file without user_id filter
        const file = await db.get('SELECT * FROM files WHERE id = ?', [req.params.id]);

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Check if user owns the file OR has been shared the file
        if (file.user_id !== userId) {
            const share = await db.get(
                'SELECT * FROM shares WHERE file_id = ? AND shared_with = ?',
                [file.id, userEmail]
            );
            if (!share) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        res.json({
            id: file.id,
            name: file.name,
            size: file.size,
            mimeType: file.mime_type,
            uploadedAt: file.uploaded_at,
            userId: file.user_id,
            iv: file.iv,
            salt: file.salt,
            encryptedDataUrl: `/api/files/${file.id}/download`
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Download File
router.get('/:id/download', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user?.id;
        const db = getDB();

        const file = await db.get('SELECT * FROM files WHERE id = ?', [req.params.id]);

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        if (file.user_id !== userId) {
            const share = await db.get(
                'SELECT * FROM shares WHERE file_id = ? AND shared_with = ?',
                [file.id, (req as AuthRequest).user?.email]
            );
            if (!share) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        if (!fs.existsSync(file.storage_path)) {
            return res.status(404).json({ message: 'File content not found on server' });
        }

        res.download(file.storage_path, file.name);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Delete File
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user?.id;
        const db = getDB();

        const file = await db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [req.params.id, userId]);

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        if (fs.existsSync(file.storage_path)) {
            fs.unlinkSync(file.storage_path);
        }

        await db.run('DELETE FROM files WHERE id = ?', [req.params.id]);
        await db.run('DELETE FROM shares WHERE file_id = ?', [req.params.id]);

        res.sendStatus(200);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Share File
router.post('/:id/share', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user?.id;
        const { email, encryptedKey } = req.body;
        const db = getDB();

        const file = await db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [req.params.id, userId]);
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        const shareId = uuidv4();
        await db.run(
            `INSERT INTO shares (id, file_id, shared_by, shared_with, encrypted_key, permissions, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [shareId, file.id, userId, email, encryptedKey, 'read', new Date().toISOString()]
        );

        res.status(201).json({
            id: shareId,
            fileId: file.id,
            sharedBy: userId,
            sharedWith: email,
            encryptedKey,
            permissions: 'read',
            sharedAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});


export default router;
