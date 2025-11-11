# Secure Storage - End-to-End Encrypted File Storage

A modern, secure file storage application with client-side encryption built with React, TypeScript, and Web Crypto API.

## Features

- **End-to-End Encryption**: All files are encrypted on your device before upload using AES-256-GCM
- **Zero-Knowledge Architecture**: Your encryption keys never leave your device in plaintext
- **Secure File Sharing**: Share files securely using RSA-OAEP asymmetric encryption
- **Modern UI**: Beautiful, responsive interface built with Tailwind CSS
- **Type-Safe**: Built with TypeScript for enhanced code quality and developer experience

## Security Architecture

### Client-Side Encryption

All encryption/decryption happens in your browser:

1. **Key Derivation**: Your password is used to derive an AES-256 key using PBKDF2 (100,000 iterations)
2. **File Encryption**: Each file is encrypted with AES-256-GCM before upload
3. **Secure Storage**: Encrypted files are stored on the server; only you can decrypt them

### Technologies

- **Web Crypto API**: Native browser cryptography for maximum security
- **AES-256-GCM**: Authenticated encryption with 256-bit keys
- **RSA-OAEP**: 2048-bit asymmetric encryption for secure sharing
- **PBKDF2**: Key derivation with SHA-256 and 100,000 iterations

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd secure-storage-app
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file (optional):
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

## Usage

### 1. Create an Account

- Click "Sign Up" and create an account
- **Important**: Your password is used to generate your encryption keys
- Use a strong password and remember it - it cannot be recovered!

### 2. Upload Files

- Navigate to the "Upload" tab
- Select one or more files
- Files are automatically encrypted before upload
- Monitor upload progress with the progress bar

### 3. Download Files

- View your files in the "My Files" tab
- Click the download icon to decrypt and download a file
- Files are decrypted in your browser

### 4. Share Files

- Click the share icon next to any file
- Enter the recipient's email address
- The file encryption key is encrypted with the recipient's public key
- Only the recipient can decrypt the shared file

### 5. Manage Account

- Click on your name in the top right
- View account details and security information
- Manage your profile settings

## Project Structure

```
src/
├── components/
│   ├── auth/           # Authentication components
│   ├── files/          # File management components
│   ├── layout/         # Layout and navigation
│   └── ui/             # Reusable UI components
├── contexts/           # React contexts (Auth)
├── pages/              # Page components
├── services/           # Business logic
│   ├── apiService.ts   # API communication
│   └── cryptoService.ts # Encryption/decryption
├── types/              # TypeScript types
└── utils/              # Utility functions
```

## Development Mode

The application includes a mock backend using localStorage for development and testing:

- No server setup required
- Data persists in browser localStorage
- Perfect for testing and demonstration

To connect to a real backend:

1. Set `USE_MOCK = false` in `src/services/apiService.ts`
2. Configure `VITE_API_URL` in `.env`
3. Implement the backend API endpoints

## Backend API Requirements

If you want to implement a real backend, it should provide these endpoints:

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - End session
- `GET /api/auth/me` - Get current user

### Files
- `POST /api/files/upload` - Upload encrypted file
- `GET /api/files` - List user's files
- `GET /api/files/:id` - Get file metadata
- `GET /api/files/:id/download` - Download encrypted file
- `DELETE /api/files/:id` - Delete file

### Sharing
- `POST /api/files/:id/share` - Share file with user
- `GET /api/files/shared` - Get files shared with user
- `GET /api/users/:email/public-key` - Get user's public key

## Building for Production

```bash
npm run build
```

The optimized production build will be in the `dist/` directory.

## Security Considerations

### What's Secure

- All files are encrypted before leaving your device
- Your master encryption key never leaves your device
- Even if the server is compromised, your files remain encrypted
- Secure file sharing using public-key cryptography

### What to Consider

- **Password Security**: Your password protects everything - use a strong one
- **Browser Security**: Encryption happens in the browser - keep it updated
- **HTTPS Required**: Always use HTTPS in production
- **Key Storage**: Master keys are kept in memory only during session

### Recommendations

1. Use strong, unique passwords (12+ characters)
2. Enable 2FA on your account (when backend supports it)
3. Don't share your password with anyone
4. Keep your browser and OS updated
5. Use HTTPS in production environments

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Web Crypto API** - Cryptography
- **Axios** - HTTP client
- **Lucide React** - Icons

## Browser Compatibility

Requires a modern browser with Web Crypto API support:

- Chrome 60+
- Firefox 57+
- Safari 11+
- Edge 79+

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for learning or production.

## Disclaimer

This is a demonstration project. While it implements real cryptography using industry-standard algorithms, it should be thoroughly audited before use in production with sensitive data.

## Support

For issues, questions, or contributions, please open an issue on GitHub.
