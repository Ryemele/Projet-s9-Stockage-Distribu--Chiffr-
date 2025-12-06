import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUpload } from "../components/files/FileUpload";

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();

  const handleUploadComplete = () => {
    // Redirect to My Files after upload
    navigate('/files');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Files</h1>
        <p className="text-gray-600 mt-1">
          Upload and encrypt your files
        </p>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <FileUpload onUploadComplete={handleUploadComplete} />
        </div>
      </div>
    </div>
  );
};
