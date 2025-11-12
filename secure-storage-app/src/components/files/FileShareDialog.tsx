/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Alert } from '../ui';
import { X, Share2 } from 'lucide-react';

interface FileShareDialogProps {
  fileId: string;
  fileName: string;
  wrappedKey: string;
  onClose: () => void;
  onShareComplete?: () => void;
}

/**
 * FileShareDialog Component - Temporary Stub
 * TODO: Implement with AFGH re-encryption
 *
 * To implement:
 * - Use afghService.generateReEncryptionKey() to create rk_{A→B}
 * - Send re-encryption key to HSM service on backend
 * - See WHAT_TO_DO_NEXT.md for complete implementation guide
 */
export const FileShareDialog: React.FC<FileShareDialogProps> = ({
  fileName,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Share2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Share File</h2>
              <p className="text-sm text-gray-500 truncate max-w-xs">{fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <Alert
            type="info"
            message="File sharing coming soon. Backend HSM implementation required."
          />
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h3 className="font-semibold text-blue-900 mb-2">Implementation Note</h3>
            <p className="text-sm text-blue-700">
              This component needs to be implemented with AFGH re-encryption.
            </p>
            <ul className="text-sm text-blue-700 mt-2 list-disc list-inside space-y-1">
              <li>Get recipient's public key from server</li>
              <li>Generate re-encryption key: <code className="bg-blue-100 px-1">afghService.generateReEncryptionKey()</code></li>
              <li>Send to HSM service for proxy re-encryption</li>
              <li>See <code className="bg-blue-100 px-1">WHAT_TO_DO_NEXT.md</code> for the complete code</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
