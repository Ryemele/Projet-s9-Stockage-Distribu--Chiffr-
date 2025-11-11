import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { cryptoService } from '../../services/cryptoService';
import { apiService } from '../../services/apiService';
import { Button, Alert } from '../ui';
import { Upload, File, X } from 'lucide-react';

export const FileUpload: React.FC<{ onUploadComplete?: () => void }> = ({ onUploadComplete }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { masterKey } = useAuth();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
      setError('');
      setSuccess('');
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!masterKey) {
      setError('Encryption key not available. Please log in again.');
      return;
    }

    if (selectedFiles.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setUploading(true);
    setError('');
    setProgress(0);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        // Update progress - encrypting
        setProgress(Math.round(((i + 0.3) / selectedFiles.length) * 100));

        // Encrypt file
        const encrypted = await cryptoService.encryptFile(file);

        // Update progress - uploading
        setProgress(Math.round(((i + 0.7) / selectedFiles.length) * 100));

        // Create blob from encrypted data
        const encryptedBlob = new Blob([encrypted.encryptedData], {
          type: 'application/octet-stream',
        });

        // Upload to server
        await apiService.uploadFile(encryptedBlob, {
          name: file.name,
          size: file.size,
          mimeType: file.type,
          iv: cryptoService.uint8ArrayToBase64(encrypted.iv),
          salt: cryptoService.uint8ArrayToBase64(encrypted.salt),
        });

        setProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      }

      setSuccess(`Successfully uploaded ${selectedFiles.length} file(s)`);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center space-y-2"
        >
          <Upload className="h-12 w-12 text-gray-400" />
          <span className="text-sm text-gray-600">
            Click to upload or drag and drop
          </span>
          <span className="text-xs text-gray-500">
            All files are encrypted before upload
          </span>
        </label>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Selected Files:</h3>
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <File className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-gray-400 hover:text-red-600 transition-colors"
                disabled={uploading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ))}

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Encrypting and uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            fullWidth
            isLoading={uploading}
            disabled={uploading}
          >
            Upload {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  );
};
