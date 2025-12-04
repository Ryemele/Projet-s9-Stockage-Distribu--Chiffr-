# Secure Storage - AFGH Proxy Re-Encryption

A modern, secure file storage application with **AFGH Proxy Re-Encryption** built with React, TypeScript, and Web Crypto API.

## 🔐 Features

- **🎯 AFGH Proxy Re-Encryption**: Advanced unidirectional, non-transitive, collusion-safe proxy re-encryption
- **🔒 End-to-End Encryption**: All files are encrypted on your device using hybrid KEM-DEM approach
- **🔑 Zero-Knowledge Architecture**: Your encryption keys never leave your device in plaintext
- **🤝 Secure File Sharing**: Share files without revealing your private key using proxy re-encryption
- **🎨 Modern UI**: Professional glass morphism design with elegant animations
- **✅ Type-Safe**: Built with TypeScript for enhanced code quality

## 🏗️ Security Architecture

### AFGH Proxy Re-Encryption

This application implements the **Ateniese-Fu-Green-Hohenberger (AFGH)** proxy re-encryption scheme, a state-of-the-art cryptographic protocol.

**Key Properties:**
- ✅ **Unidirectional**: Alice can share files with Bob without Bob being able to share back
- ✅ **Non-transitive**: Proxy cannot re-delegate without Alice's permission
- ✅ **Collusion-safe**: Proxy and Bob cannot recover Alice's private key
- ✅ **CCA-secure**: Secure against chosen-ciphertext attacks

### Hybrid Encryption (KEM-DEM)

Files are encrypted using a hybrid approach for optimal performance and security:

**KEM (Key Encapsulation Mechanism) - AFGH:**
1. Generate random secret S in G2 (BLS12-381 curve)
2. Encrypt S with AFGH Level 2 → (U, V) using owner's public key
3. Derive symmetric key K_sym from S using PBKDF2

**DEM (Data Encapsulation Mechanism) - AES-GCM:**
1. Generate random file key K_file (AES-256)
2. Wrap K_file with K_sym using AES-KW
3. Encrypt file chunks with K_file using AES-256-GCM

**Why Hybrid?**
- 🚀 **Performance**: AES-GCM is hardware-accelerated and very fast
- 🔐 **Security**: Combines AFGH's re-encryption capabilities with AES's proven security
- 💪 **Flexibility**: AFGH only encrypts a small secret, not the entire file

### Cryptographic Technologies

- **BLS12-381**: Pairing-friendly elliptic curve for AFGH
- **@noble/curves**: Secure, audited elliptic curve library
- **AES-256-GCM**: Authenticated encryption for file data
- **AES-KW**: Key wrapping for secure key storage
- **PBKDF2**: Key derivation with 100,000 iterations
- **Web Crypto API**: Native browser cryptography

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

5. Open [http://localhost:5174](http://localhost:5174) in your browser

## 🧪 Testing

### Quick Test (5 minutes)

See **[QUICK_TEST.md](./QUICK_TEST.md)** for a rapid walkthrough of key features.

### Complete Test Suite

See **[TEST_GUIDE.md](./TEST_GUIDE.md)** for comprehensive testing instructions including:
- Registration & key generation
- File upload & encryption
- File download & decryption
- File sharing with proxy re-encryption
- Security tests

### Test Files Available

- `test-sample.txt` - Sample text file for testing
- `test-upload-flow.html` - Interactive test page
- `TEST_SUMMARY.md` - Complete testing overview

## Usage

### 1. Create an Account

- Click "Sign Up" and create an account
- **Important**: Your password is used to derive your AFGH key pair
- Use a strong password and remember it - it cannot be recovered!
- AFGH keys (G1 points) are automatically generated and stored securely

### 2. Upload Files

- Navigate to the "Upload" tab
- Select a file to upload
- Watch the encryption process:
  - **Phase 1**: Generate random secret S (G2 element)
  - **Phase 2**: Encrypt S with AFGH Level 2
  - **Phase 3**: Encrypt file with AES-256-GCM
- Monitor upload progress with the progress bar
- Files are automatically encrypted before upload

### 3. Download Files

- View your files in the "My Files" tab
- Click the download icon to decrypt and download a file
- Decryption process:
  - **Level 2 Decryption**: Recover secret S using your private key
  - **Unwrap**: Recover file key from wrapped key
  - **Decrypt**: Decrypt chunks with AES-256-GCM
- Files are decrypted in your browser

### 4. Share Files (Proxy Re-Encryption)

- Click the share icon next to any file
- Enter the recipient's email address
- **Magic happens**:
  - A re-encryption key `rk = g^(b2/a2)` is generated
  - Proxy can transform your ciphertext for Bob
  - Bob can decrypt without your private key
- Only the recipient can decrypt the shared file
- **Security**: Proxy + Bob cannot recover your private key

### 5. Manage Account

- Click on your name in the top right
- View account details and AFGH key information
- Manage your profile settings

## Project Structure

```
src/
├── components/
│   ├── auth/              # Authentication components
│   ├── files/             # File management components
│   │   ├── FileUploadEnhanced.tsx   # AFGH file upload
│   │   ├── FileList.tsx             # File listing
│   │   └── FileShareDialog.tsx      # Share with re-encryption
│   ├── layout/            # Layout and navigation
│   └── ui/                # Reusable UI components
├── contexts/
│   └── AuthContext.tsx    # Auth + AFGH key management
├── pages/                 # Page components
├── services/
│   ├── apiService.ts      # API communication (mock/real)
│   ├── afghService.ts     # AFGH crypto operations ⭐
│   ├── afghFileService.ts # File encryption with AFGH ⭐
│   └── keyStorageService.ts # IndexedDB key storage
├── types/
│   ├── afgh.ts            # AFGH type definitions ⭐
│   └── index.ts           # General types
└── utils/                 # Utility functions
```

**Key Files:**
- `afghService.ts` - Core AFGH implementation (Level 1/2, re-encryption)
- `afghFileService.ts` - Hybrid KEM-DEM file encryption
- `keyStorageService.ts` - Secure key storage in IndexedDB

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

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling (glass morphism design)
- **React Router** - Navigation
- **Lucide React** - Icons

### Cryptography
- **@noble/curves** - Elliptic curve operations (BLS12-381)
- **@noble/hashes** - Cryptographic hashing (SHA-256)
- **Web Crypto API** - AES-GCM, AES-KW, PBKDF2

### Storage
- **IndexedDB** - Secure local key storage
- **localStorage** - Mock backend (development)

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
