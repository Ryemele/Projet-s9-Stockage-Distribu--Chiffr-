/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { cryptoService } from '../../services/cryptoService';
import { apiService } from '../../services/apiService';
import type { EncryptedFile } from '../../types';
import { Button, Modal, Input, Alert } from '../ui';
import { Download, Trash2, Share2, File, Loader } from 'lucide-react';

export const FileList: React.FC = () => {
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');

  const { masterKey } = useAuth();

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const fileList = await apiService.getFiles();
      setFiles(fileList);
    } catch (err: any) {
      setError(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: EncryptedFile) => {
    if (!masterKey) {
      setError('Encryption key not available. Please log in again.');
      return;
    }

    setDownloadingId(file.id);
    setError('');

    try {
      // Download encrypted file
      const encryptedBlob = await apiService.downloadFile(file.id);
      const encryptedData = await encryptedBlob.arrayBuffer();

      // Decrypt file
      const iv = cryptoService.base64ToUint8Array(file.iv);
      const decryptedData = await cryptoService.decryptFile(
        encryptedData,
        masterKey,
        iv
      );

      // Create download link
      const blob = new Blob([decryptedData], { type: file.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    setDeletingId(fileId);
    setError('');

    try {
      await apiService.deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const openShareModal = (fileId: string) => {
    setShareFileId(fileId);
    setShareModalOpen(true);
    setShareError('');
    setShareEmail('');
  };

  const handleShare = async () => {
    if (!shareFileId || !masterKey) return;

    setShareLoading(true);
    setShareError('');

    try {
      // Get recipient's public key
      const recipientPublicKey = await apiService.getUserPublicKey(shareEmail);
      const importedPublicKey = await cryptoService.importPublicKey(recipientPublicKey);

      // Encrypt the file's encryption key with recipient's public key
      const encryptedKey = await cryptoService.encryptKeyForSharing(
        masterKey,
        importedPublicKey
      );

      // Share the file
      await apiService.shareFile(shareFileId, shareEmail, encryptedKey);

      setShareModalOpen(false);
      setShareEmail('');
      alert('File shared successfully!');
    } catch (err: any) {
      setShareError(err.message || 'Failed to share file');
    } finally {
      setShareLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <File className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No files yet</h3>
        <p className="text-gray-600">Upload your first file to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <File className="h-10 w-10 text-primary-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)} • {formatDate(file.uploadedAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(file)}
                  disabled={downloadingId === file.id}
                  title="Download"
                >
                  {downloadingId === file.id ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openShareModal(file.id)}
                  title="Share"
                >
                  <Share2 className="h-4 w-4" />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(file.id)}
                  disabled={deletingId === file.id}
                  title="Delete"
                >
                  {deletingId === file.id ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-red-600" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Share Modal */}
      <Modal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Share File"
      >
        <div className="space-y-4">
          {shareError && <Alert type="error" message={shareError} />}

          <p className="text-sm text-gray-600">
            Enter the email address of the person you want to share this file with.
            They must have an account to receive shared files.
          </p>

          <Input
            type="email"
            label="Recipient Email"
            placeholder="user@example.com"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            required
          />

          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={() => setShareModalOpen(false)}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              isLoading={shareLoading}
              disabled={!shareEmail || shareLoading}
              fullWidth
            >
              Share
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
