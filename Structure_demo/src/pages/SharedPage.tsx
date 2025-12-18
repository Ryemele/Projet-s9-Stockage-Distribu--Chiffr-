import React, { useState, useEffect } from 'react';
import {
  Share2,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  File,
  Search,
  Clock,
  ArrowUpRight,
  Inbox,
  Loader2,
  AlertCircle,
  Lock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { cryptoService, type FileEnvelope } from '../services/cryptoService';
import { FilePreview } from '../components/files/FilePreview';

interface SharedFile {
  id: string;
  file_id: string;
  name: string;
  size: number;
  mime_type: string;
  shared_by: string;
  shared_by_email: string;
  shared_at: string;
  permissions: string;
  iv?: string;
  encryptedKey?: string;  // Re-encryption key (rk) from the sharer
  ownerPublicKey?: any;   // Owner's public key for re-encryption
}

export const SharedPage: React.FC = () => {
  const { keyPair } = useAuth();
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ data: ArrayBuffer; name: string; mimeType: string } | null>(null);

  useEffect(() => {
    fetchSharedFiles();
  }, []);

  const fetchSharedFiles = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/files/shared', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const files = Array.isArray(data) ? data : (data.sharedFiles || []);
        setSharedFiles(files.map((f: any) => ({
          id: f.id,
          file_id: f.fileId,
          name: f.fileName,
          size: f.fileSize,
          mime_type: f.mimeType,
          shared_by: f.sharedBy,
          shared_by_email: f.ownerEmail || f.sharedBy,
          shared_at: f.sharedAt,
          permissions: f.permissions,
          iv: f.iv,
          encryptedKey: f.encryptedKey,
          ownerPublicKey: f.ownerPublicKey
        })));
      }
    } catch (error) {
      console.error('Error fetching shared files:', error);
      setError('Failed to fetch shared files');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Decrypt a shared file using Proxy Re-Encryption
   * 
   * Mathematical flow:
   * 1. Original encryption: C = (U, V) where U = g^k, V = M * e(A1,A2)^k
   * 2. Re-encryption key: rk = B2^(a1*a2) where B2 = g2^b2
   * 3. Re-encrypt: C' = (C1', C2') where C1' = e(U, rk), C2' = V
   * 4. Decrypt: M = C2' / (C1')^(1/b2)
   */
  const decryptSharedFile = async (file: SharedFile): Promise<{ data: ArrayBuffer; fileName: string; mimeType: string }> => {
    if (!keyPair) {
      throw new Error('No key pair available. Please log in.');
    }

    console.log('[SharedPage] Starting PRE decryption for:', file.name);

    // 1. Download encrypted file from distributed storage
    console.log('[SharedPage] Downloading encrypted file...');
    const blob = await apiService.downloadFile(file.file_id);
    const encryptedData = await blob.arrayBuffer();
    const base64Data = cryptoService.arrayBufferToBase64(encryptedData);

    // 2. Parse the encryption metadata (IV field contains the envelope metadata)
    if (!file.iv) {
      throw new Error('Missing encryption metadata');
    }
    const encryptionMetadata = JSON.parse(file.iv);
    console.log('[SharedPage] Encryption type:', encryptionMetadata.type);

    // 3. Parse the re-encryption key from the share
    if (!file.encryptedKey) {
      throw new Error('Missing re-encryption key');
    }
    const rkData = JSON.parse(file.encryptedKey);
    const rk = {
      rk: cryptoService.base64ToUint8Array(rkData.rk)
    };
    console.log('[SharedPage] Re-encryption key loaded');

    // 4. Parse owner's public key
    if (!file.ownerPublicKey) {
      throw new Error('Missing owner public key');
    }
    const ownerPk = file.ownerPublicKey;
    const pkA = {
      u1: typeof ownerPk.publicKey1 === 'string'
        ? cryptoService.base64ToUint8Array(ownerPk.publicKey1)
        : ownerPk.u1,
      u2: typeof ownerPk.publicKey2 === 'string'
        ? cryptoService.base64ToUint8Array(ownerPk.publicKey2)
        : ownerPk.u2
    };
    console.log('[SharedPage] Owner public key loaded');

    // 5. Build the original envelope (level2)
    const originalEnvelope: FileEnvelope = {
      fileId: file.file_id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.mime_type,
      encryptedData: base64Data,
      encryptionMetadata: {
        type: 'level2',
        u: encryptionMetadata.u,
        v: encryptionMetadata.v
      },
      timestamp: file.shared_at
    };

    // 6. Re-encrypt the ciphertext (this transforms it for our key)
    console.log('[SharedPage] Applying proxy re-encryption transform...');
    const reEncryptedEnvelope = cryptoService.reEncrypt(originalEnvelope, rk, pkA);
    console.log('[SharedPage] Ciphertext transformed to re-encrypted form');

    // 7. Decrypt with our private key
    console.log('[SharedPage] Decrypting with recipient private key...');
    const decrypted = await cryptoService.decryptFile(reEncryptedEnvelope, keyPair);
    console.log('[SharedPage] Decryption successful!');

    return decrypted;
  };

  const handleDownload = async (file: SharedFile) => {
    try {
      setDownloadingId(file.id);
      setError(null);

      const decrypted = await decryptSharedFile(file);

      // Download the decrypted file
      const blob = new Blob([decrypted.data], { type: decrypted.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = decrypted.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error('Download error:', err);
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (file: SharedFile) => {
    try {
      setDownloadingId(file.id);
      setError(null);

      const decrypted = await decryptSharedFile(file);
      setPreviewFile({ data: decrypted.data, name: decrypted.fileName, mimeType: decrypted.mimeType });

    } catch (err: any) {
      console.error('Preview error:', err);
      setError(`Preview failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) return <ImageIcon className="h-6 w-6 text-pink-500" />;
    if (mimeType?.startsWith('video/')) return <Film className="h-6 w-6 text-purple-500" />;
    if (mimeType?.startsWith('audio/')) return <Music className="h-6 w-6 text-green-500" />;
    if (mimeType?.includes('pdf') || mimeType?.includes('document')) return <FileText className="h-6 w-6 text-blue-500" />;
    return <File className="h-6 w-6 text-gray-500" />;
  };

  const filteredFiles = sharedFiles.filter(f =>
    f.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 rounded-2xl p-8 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-pink-400/20 rounded-full blur-3xl"></div>

        <div className="relative">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Lock className="h-8 w-8" />
            Proxy Re-Encrypted Files
          </h1>
          <p className="text-white/80">Files shared with you using mathematical proxy re-encryption (BLS12-381)</p>

          <div className="flex items-center gap-4 mt-6">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
              <input
                type="text"
                placeholder="Search shared files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PRE Explanation Card */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
        <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
          <Lock className="h-4 w-4" />
          How Proxy Re-Encryption Works
        </h3>
        <p className="text-sm text-purple-700">
          Files are encrypted with <strong>BLS12-381 bilinear pairings</strong>.
          The sharer generates a <strong>re-encryption key</strong> that transforms the ciphertext
          so only you can decrypt it — without ever exposing the original data or private keys.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'received'
            ? 'bg-white shadow text-pink-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Inbox className="h-4 w-4" />
          Received
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'sent'
            ? 'bg-white shadow text-pink-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <ArrowUpRight className="h-4 w-4" />
          Sent
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Share2 className="h-4 w-4" />
        <span>{sharedFiles.length} shared file{sharedFiles.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Files List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-100 to-purple-100 rounded-2xl mb-4">
            <Share2 className="h-10 w-10 text-pink-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchQuery ? 'No files found' : 'No shared files yet'}
          </h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            {searchQuery
              ? 'Try a different search term'
              : activeTab === 'received'
                ? 'When someone shares a file with you, it will appear here.'
                : 'Files you share with others will appear here.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">File</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Shared by</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Date</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Size</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                        {getFileIcon(file.mime_type)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          PRE encrypted
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                        {file.shared_by_email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="text-gray-700">{file.shared_by_email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock className="h-4 w-4" />
                      <span>{formatDate(file.shared_at)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatFileSize(file.size)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handlePreview(file)}
                        disabled={downloadingId === file.id}
                        title="Preview (PRE decrypt)"
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all disabled:opacity-50"
                      >
                        {downloadingId === file.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDownload(file)}
                        disabled={downloadingId === file.id}
                        title="Download (PRE decrypt)"
                        className="p-2 rounded-lg hover:bg-pink-50 text-gray-500 hover:text-pink-600 transition-all disabled:opacity-50"
                      >
                        {downloadingId === file.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Download className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreview
          file={{
            name: previewFile.name,
            mimeType: previewFile.mimeType,
            data: new Blob([previewFile.data], { type: previewFile.mimeType })
          }}
          onClose={() => setPreviewFile(null)}
          onDownload={() => {
            const blob = new Blob([previewFile.data], { type: previewFile.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = previewFile.name;
            a.click();
            URL.revokeObjectURL(url);
          }}
        />
      )}
    </div>
  );
};
