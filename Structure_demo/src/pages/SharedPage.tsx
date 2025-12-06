import React from 'react';
import { SharedFileList } from '../components/files/SharedFileList';

export const SharedPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Shared with me</h1>
        <p className="text-gray-600 mt-1">
          Files securely shared with you
        </p>
      </div>

      {/* Shared Files List */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <SharedFileList />
        </div>
      </div>
    </div>
  );
};
