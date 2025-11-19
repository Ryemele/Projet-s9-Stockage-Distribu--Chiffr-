import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  Folder as FolderIcon,
  FileIcon,
  Plus,
  HardDrive,
  Users,
} from "lucide-react";
import type { Folder } from "../types/folder";
import type { EncryptedFile } from "../types";
import { FolderCard } from "../components/folders/FolderCard";
import { CreateFolderModal } from "../components/folders/CreateFolderModal";
import { FileTable } from "../components/files/FileTable";
import {
  getRootFolders,
  getAllFiles,
  addFolder,
  calculateTotalStorage,
  formatSize,
  toggleFileStarred,
  deleteFileById,
} from "../mocks";
import { getUserByEmail } from "../mocks/teams";
import { calculateStorageByCategory } from "../utils/fileCategories";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Use mock data from centralized location
  const [folders, setFolders] = useState<Folder[]>(getRootFolders());

  // Get recent files (last 5 files)
  const recentFiles: EncryptedFile[] = getAllFiles()
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )
    .slice(0, 5);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Handle file upload
    navigate("/upload");
  };

  const handleCreateFolder = (folder: Folder) => {
    addFolder(folder);
    setFolders(getRootFolders());
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders(folders.filter((f) => f.id !== folderId));
  };

  const handleEditFolder = (folder: Folder) => {
    console.log("Edit folder:", folder);
  };

  const handleDeleteFile = (file: EncryptedFile) => {
    deleteFileById(file.id);
    setRefreshKey((prev) => prev + 1);
  };

  const handleDownloadFile = (file: EncryptedFile) => {
    console.log("Download file:", file.id);
    alert(`Downloading ${file.name}...`);
  };

  const handleShareFile = (file: EncryptedFile) => {
    console.log("Share file:", file.id);
    alert(`Share ${file.name} with team`);
  };

  const handleToggleStar = (file: EncryptedFile) => {
    toggleFileStarred(file.id);
    setRefreshKey((prev) => prev + 1);
  };

  // Calculate storage by category using the utility function
  const allFiles = getAllFiles();
  const storageByCategory = calculateStorageByCategory(allFiles);
  const totalStorage = calculateTotalStorage();

  // Calculate percentages and create segments for the circle
  const segments = Object.entries(storageByCategory)
    .filter(([_, data]) => data.size > 0)
    .map(([key, data]) => ({
      key,
      ...data,
      percentage: (data.size / totalStorage) * 100,
    }));

  // Get all unique participants from files
  const getParticipants = () => {
    const allFiles = getAllFiles();
    const uniqueEmails = new Set(
      allFiles.map((f) => f.uploadedBy).filter(Boolean)
    );
    return Array.from(uniqueEmails).slice(0, 8); // Show max 8 participants
  };

  const participants = getParticipants();

  return (
    <div className="space-y-8">
      {/* Hero Section with Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
          isDragging
            ? "bg-primary-50 border-2 border-primary-400 border-dashed"
            : "bg-gradient-to-br from-primary-600 via-primary-500 to-secondary-400"
        }`}
      >
        <div className="relative z-10 px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-1">
                {isDragging ? "Drop files to upload" : "Welcome to SecureBox !"}
              </h1>
              <p className="text-white/90 text-sm">
                {isDragging
                  ? "Release to start uploading your files securely"
                  : "Your secure, encrypted file storage solution"}
              </p>
            </div>

            {!isDragging && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/upload")}
                  className="px-5 py-2.5 bg-white text-primary-600 font-semibold rounded-lg hover:bg-white/90 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 text-sm"
                >
                  <Upload className="h-4 w-4" />
                  Upload Files
                </button>
                <button
                  onClick={() => setShowCreateFolderModal(true)}
                  className="px-5 py-2.5 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-lg hover:bg-white/20 transition-all border border-white/20 flex items-center gap-2 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  New Folder
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary-400/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Files & Folders Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                  <FolderIcon className="h-5 w-5 text-primary-600" />
                </div>
                <span className="text-sm text-gray-600">Folders</span>
              </div>
              <span className="text-xl font-bold text-gray-900">
                {folders.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary-50 rounded-lg flex items-center justify-center">
                  <FileIcon className="h-5 w-5 text-secondary-400" />
                </div>
                <span className="text-sm text-gray-600">Files</span>
              </div>
              <span className="text-xl font-bold text-gray-900">
                {getAllFiles().length}
              </span>
            </div>
          </div>
        </div>

        {/* Participants Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Participants
            </h3>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Users className="h-4 w-4" />
              <span>{participants.length}</span>
            </div>
          </div>
          <div className="space-y-3">
            {participants.slice(0, 3).map((email, index) => {
              const user = getUserByEmail(email);
              return (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-400 flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-sm font-semibold">
                        {(user?.name || email).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user?.name || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{email}</p>
                  </div>
                </div>
              );
            })}
            {participants.length > 3 && (
              <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-100">
                +{participants.length - 3} more participants
              </div>
            )}
          </div>
        </div>

        {/* Storage by Category Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Storage</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatSize(totalStorage)}
                  </p>
                </div>
              </div>

              {/* Storage Categories Legend */}
              <div className="space-y-1.5">
                {segments.map((segment) => (
                  <div
                    key={segment.key}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: segment.color }}
                      />
                      <span className="text-gray-600">{segment.label}</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {formatSize(segment.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Circular Chart */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="transform -rotate-90" viewBox="0 0 100 100">
                {(() => {
                  let currentAngle = 0;
                  return segments.map((segment) => {
                    const angle = (segment.percentage / 100) * 360;
                    const startAngle = currentAngle;
                    currentAngle += angle;

                    // Calculate path for segment
                    const radius = 40;
                    const centerX = 50;
                    const centerY = 50;

                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (currentAngle * Math.PI) / 180;

                    const x1 = centerX + radius * Math.cos(startRad);
                    const y1 = centerY + radius * Math.sin(startRad);
                    const x2 = centerX + radius * Math.cos(endRad);
                    const y2 = centerY + radius * Math.sin(endRad);

                    const largeArc = angle > 180 ? 1 : 0;

                    return (
                      <path
                        key={segment.key}
                        d={`M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                        fill={segment.color}
                        className="transition-opacity hover:opacity-80"
                      />
                    );
                  });
                })()}
                {/* Center white circle */}
                <circle cx="50" cy="50" r="25" fill="white" />
              </svg>
              {/* Center icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <HardDrive className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Folders Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Folders</h2>
            <p className="text-sm text-gray-600 mt-1">Organize your files</p>
          </div>
          <button
            onClick={() => navigate("/folders")}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View all →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {folders.slice(0, 4).map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onDelete={handleDeleteFolder}
              onEdit={handleEditFolder}
            />
          ))}
        </div>
      </div>

      {/* Recent Files Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recent Files</h2>
            <p className="text-sm text-gray-600 mt-1">Your latest uploads</p>
          </div>
          <button
            onClick={() => navigate("/files")}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View all →
          </button>
        </div>

        <FileTable
          key={refreshKey}
          files={recentFiles.map((file) => ({
            id: file.id,
            name: file.name,
            size: file.size,
            uploadedAt: file.uploadedAt,
            encrypted: true,
            starred: file.starred,
            uploadedBy: file.uploadedBy,
            uploadedByUser: file.uploadedBy
              ? getUserByEmail(file.uploadedBy)
              : undefined,
            mimeType: file.mimeType,
          }))}
          onDelete={handleDeleteFile}
          onDownload={handleDownloadFile}
          onShare={handleShareFile}
          onToggleStar={handleToggleStar}
        />
      </div>

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <CreateFolderModal
          onClose={() => setShowCreateFolderModal(false)}
          onCreate={handleCreateFolder}
        />
      )}
    </div>
  );
};
