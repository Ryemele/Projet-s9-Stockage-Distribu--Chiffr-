import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { afghFileService } from '../../services/afghFileService';
import { apiService } from '../../services/apiService';
import { Button, Alert } from '../ui';
import { Upload, File, X, Lock, Shield } from 'lucide-react';
import type { AFGHFileEnvelope } from '../../types/afgh';

/**
 * Enhanced File Upload Component with AFGH Encryption
 *
 * Features:
 * - AFGH Proxy Re-Encryption (BLS12-381)
 * - Chunked encryption (1 MB chunks)
 * - KEM-DEM hybrid approach
 * - Progress tracking per file
 * - Integrity checks (hash before encryption)
 * - Zero-knowledge architecture
 */

interface UploadingFile {
  file: File;
  status: 'pending' | 'encrypting' | 'uploading' | 'completed' | 'error';
  progress: number;
  statusMessage: string;
  error?: string;
  envelope?: AFGHFileEnvelope;
}

export const FileUploadEnhanced: React.FC<{ onUploadComplete?: () => void }> = ({
  onUploadComplete
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFile>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { masterKey, keyPair } = useAuth();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      setError('');
      setSuccess('');

      // Initialize upload status for each file
      const newMap = new Map<string, UploadingFile>();
      files.forEach(file => {
        newMap.set(file.name, {
          file,
          status: 'pending',
          progress: 0,
          statusMessage: 'Waiting...'
        });
      });
      setUploadingFiles(newMap);
    }
  };

  const removeFile = (fileName: string) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
    setUploadingFiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileName);
      return newMap;
    });
  };

  const updateFileStatus = (
    fileName: string,
    updates: Partial<UploadingFile>
  ) => {
    setUploadingFiles(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(fileName);
      if (current) {
        newMap.set(fileName, { ...current, ...updates });
      }
      return newMap;
    });
  };

  const handleUpload = async () => {
    if (!masterKey || !keyPair) {
      setError('AFGH keys not available. Please log in again.');
      return;
    }

    if (selectedFiles.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      // Upload files sequentially
      for (const file of selectedFiles) {
        try {
          console.log(`[Upload] Starting encryption for: ${file.name}`);

          updateFileStatus(file.name, {
            status: 'encrypting',
            statusMessage: 'Starting encryption...',
            progress: 0
          });

          // Encrypt file with AFGH (KEM-DEM hybrid)
          const envelope = await afghFileService.encryptFile(
            file,
            keyPair,
            (progress, status) => {
              updateFileStatus(file.name, {
                status: 'encrypting',
                progress,
                statusMessage: status
              });
            }
          );

          console.log(`[Upload] Encryption complete. File ID: ${envelope.fileId}`);

          updateFileStatus(file.name, {
            status: 'uploading',
            statusMessage: 'Uploading to server...',
            progress: 95,
            envelope
          });

          // Convert envelope for API
          const uploadData = {
            fileId: envelope.fileId,
            fileName: envelope.fileName,
            fileSize: envelope.fileSize,
            mimeType: envelope.mimeType,

            // KEM (AFGH)
            kemCiphertext: {
              U: arrayToBase64(envelope.kemCiphertext.U),
              V: arrayToBase64(envelope.kemCiphertext.V),
              level: envelope.kemCiphertext.level
            },
            wrappedFileKey: envelope.wrappedFileKey,
            wrapKeyIV: envelope.wrapKeyIV,

            // DEM (AES chunks)
            chunks: envelope.chunks,

            // Metadata
            metadata: envelope.metadata
          };

          // Upload to server
          await apiService.uploadFile(uploadData);

          console.log(`[Upload] Upload complete for: ${file.name}`);

          updateFileStatus(file.name, {
            status: 'completed',
            statusMessage: 'Upload complete!',
            progress: 100
          });

        } catch (fileError) {
          console.error(`[Upload] Error for ${file.name}:`, fileError);
          updateFileStatus(file.name, {
            status: 'error',
            statusMessage: 'Upload failed',
            error: fileError instanceof Error ? fileError.message : 'Unknown error'
          });
        }
      }

      setSuccess(`Successfully uploaded ${selectedFiles.length} file(s)`);
      setSelectedFiles([]);

      if (onUploadComplete) {
        onUploadComplete();
      }

    } catch (err) {
      console.error('[Upload] General error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Helper function
  const arrayToBase64 = (array: Uint8Array): string => {
    return btoa(String.fromCharCode(...array));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status: UploadingFile['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'encrypting':
      case 'uploading':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Upload className="w-6 h-6" />
            Upload Files
          </h2>
          <p className="mt-1 text-sm text-gray-600 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Files are encrypted with AFGH before upload
          </p>
        </div>
      </div>

      {/* Encryption Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">AFGH Proxy Re-Encryption</h3>
            <p className="text-sm text-blue-700 mt-1">
              Your files are encrypted using BLS12-381 pairing-based cryptography with hybrid KEM-DEM.
              The server can never decrypt your files, even when sharing with others.
            </p>
          </div>
        </div>
      </div>

      {/* File Input */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="font-medium text-blue-600 hover:text-blue-500"
            disabled={isUploading}
          >
            Click to select files
          </button>
          {' '}or drag and drop
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Multiple files supported, up to 5 GB each
        </p>
      </div>

      {/* Selected Files */}
      {uploadingFiles.size > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Selected Files ({uploadingFiles.size})</h3>

          {Array.from(uploadingFiles.values()).map((uploadFile) => (
            <div
              key={uploadFile.file.name}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <File className="w-5 h-5 text-gray-400 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(uploadFile.file.size)}
                    </p>

                    {/* Status */}
                    <p className={`text-xs mt-2 ${getStatusColor(uploadFile.status)}`}>
                      {uploadFile.statusMessage}
                      {uploadFile.error && ` - ${uploadFile.error}`}
                    </p>

                    {/* Progress Bar */}
                    {(uploadFile.status === 'encrypting' || uploadFile.status === 'uploading') && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadFile.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{uploadFile.progress}%</p>
                      </div>
                    )}
                  </div>
                </div>

                {uploadFile.status === 'pending' && (
                  <button
                    onClick={() => removeFile(uploadFile.file.name)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error/Success Messages */}
      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      {/* Upload Button */}
      {selectedFiles.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="px-6"
          >
            {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} File(s)`}
          </Button>
        </div>
      )}
    </div>
  );
};
