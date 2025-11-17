import React, { useState } from 'react';
import type { Team } from '../../types/teams';
import type { EncryptedFile } from '../../types';
import { FileTable } from '../files/FileTable';
import { getAllFiles, deleteFileById, toggleFileStarred } from '../../mocks';

interface TeamFilesTabProps {
  team: Team;
  isAdmin: boolean;
  canUpload: boolean;
}

export const TeamFilesTab: React.FC<TeamFilesTabProps> = ({ team, isAdmin, canUpload }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Get files shared with this team from the centralized mock data
  const teamFiles: EncryptedFile[] = getAllFiles().filter(file => file.teamId === team.id);

  const handleFileUpload = () => {
    // TODO: Implement file upload
    alert('File upload functionality will be connected to your existing upload system');
  };

  const handleDownload = (file: EncryptedFile) => {
    console.log('Download file:', file.id);
    alert(`Downloading ${file.name}...`);
  };

  const handleDelete = (file: EncryptedFile) => {
    deleteFileById(file.id);
    setRefreshKey(prev => prev + 1);
  };

  const handleShare = (file: EncryptedFile) => {
    console.log('Share file:', file.id);
    alert(`Share ${file.name} with team`);
  };

  const handleToggleStar = (file: EncryptedFile) => {
    toggleFileStarred(file.id);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <FileTable
      key={refreshKey}
      files={teamFiles}
      showStats={true}
      showSearch={true}
      showUploadButton={canUpload}
      canDelete={isAdmin}
      onDownload={handleDownload}
      onDelete={isAdmin ? handleDelete : undefined}
      onShare={handleShare}
      onToggleStar={handleToggleStar}
      onUpload={handleFileUpload}
    />
  );
};
