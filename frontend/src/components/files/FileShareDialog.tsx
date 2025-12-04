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
 * FileShareDialog Component - Placeholder
 * TODO: Implement file sharing with pyUmbrel backend
 *
 * Future implementation:
 * - Use pyUmbrel for re-encryption on the gateway
 * - Send share request to backend
 * - Backend handles encryption key management
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
              <Share2 className="h-5 w-5 text-primary-600" />
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
            message="File sharing will be implemented with pyUmbrel backend integration."
          />
          <div className="bg-primary-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h3 className="font-semibold text-blue-900 mb-2">Coming Soon</h3>
            <p className="text-sm text-primary-700">
              File sharing will be implemented using pyUmbrel for secure re-encryption on the gateway.
            </p>
            <ul className="text-sm text-primary-700 mt-2 list-disc list-inside space-y-1">
              <li>Gateway-based re-encryption using pyUmbrel</li>
              <li>Secure key management on backend</li>
              <li>End-to-end encryption maintained</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
