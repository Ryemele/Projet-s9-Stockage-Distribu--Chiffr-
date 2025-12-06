import React from 'react';
import { FileUpload } from '../components/files/FileUpload';
import { FileList } from '../components/files/FileList';

export const MyFilesPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = React.useState(0);

  const handleUploadComplete = () => {
    // Refresh file list after upload
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Files</h1>
        <p className="text-gray-600 mt-1">
          Manage your encrypted files securely
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <FileUpload onUploadComplete={handleUploadComplete} />
        </div>
      </div>

      {/* Files List */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <FileList key={refreshKey} />
        </div>
      </div>
    </div>
  );
};
