import React, { useState } from 'react';
import { FileUploadEnhanced } from '../components/files/FileUploadEnhanced';
import { FileList } from '../components/files/FileList';
import { Card } from '../components/ui';
import { Upload, Files } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'files'>('files');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1);
    setActiveTab('files');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="glass-card">
        <h1 className="text-3xl font-bold gradient-text">My Files</h1>
        <p className="text-gray-600 mt-2 text-lg">
          Manage your encrypted files with AFGH proxy re-encryption
        </p>
      </div>

      {/* Tabs */}
      <div className="glass-card p-0 overflow-hidden">
        <nav className="flex">
          <button
            onClick={() => setActiveTab('files')}
            className={`
              flex-1 py-4 px-6 font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2
              ${
                activeTab === 'files'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-50'
              }
            `}
          >
            <Files className="h-5 w-5" />
            <span>My Files</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`
              flex-1 py-4 px-6 font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2
              ${
                activeTab === 'upload'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-50'
              }
            `}
          >
            <Upload className="h-5 w-5" />
            <span>Upload</span>
          </button>
        </nav>
      </div>

      {/* Content */}
      <Card>
        {activeTab === 'upload' ? (
          <FileUploadEnhanced onUploadComplete={handleUploadComplete} />
        ) : (
          <FileList key={refreshKey} />
        )}
      </Card>
    </div>
  );
};
