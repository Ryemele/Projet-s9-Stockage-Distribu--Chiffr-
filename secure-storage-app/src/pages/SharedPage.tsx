import React, { useState } from 'react';
import { Share2, Search } from 'lucide-react';
import type { EncryptedFile } from '../types';
import { FileTable } from '../components/files/FileTable';
import { getSharedWithMeFiles, deleteFileById, toggleFileStarred } from '../mocks';

export const SharedPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Get files shared with current user
  const allSharedFiles: EncryptedFile[] = getSharedWithMeFiles();

  // Filter files based on search query
  const sharedFiles = allSharedFiles.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.uploadedBy?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteFile = (file: EncryptedFile) => {
    deleteFileById(file.id);
    setRefreshKey((prev) => prev + 1);
  };

  const handleDownloadFile = (file: EncryptedFile) => {
    console.log('Download file:', file.id);
    alert(`Downloading ${file.name}...`);
  };

  const handleShareFile = (file: EncryptedFile) => {
    console.log('Share file:', file.id);
    alert(`Share ${file.name} with others`);
  };

  const handleToggleStar = (file: EncryptedFile) => {
    toggleFileStarred(file.id);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shared with me</h1>
          <p className="text-gray-600 mt-1">
            {allSharedFiles.length} {allSharedFiles.length === 1 ? 'file' : 'files'} shared with you
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search shared files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Files */}
      {sharedFiles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
            <Share2 className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No shared files yet</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            When others share files with you, they will appear here
          </p>
        </div>
      ) : (
        <FileTable
          key={refreshKey}
          files={sharedFiles}
          onDelete={handleDeleteFile}
          onDownload={handleDownloadFile}
          onShare={handleShareFile}
          onToggleStar={handleToggleStar}
        />
      )}
    </div>
  );
};
