import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Upload, Search, Folder as FolderIcon, FolderPlus } from "lucide-react";
import type { EncryptedFile } from "../types";
import type { Folder } from "../types/folder";
import { FOLDER_COLORS } from "../types/folder";
import { CreateFolderModal } from "../components/folders/CreateFolderModal";
import { Breadcrumb } from "../components/folders/Breadcrumb";
import { UnifiedFolderTable } from "../components/folders/UnifiedFolderTable";
import {
  getFolderById,
  getSubFolders,
  getFilesByFolder,
  addFolder,
  deleteFolderById,
  deleteFileById,
  toggleFileStarred,
  getExactFileCount,
  calculateFolderSize,
  formatSize,
} from "../mocks";

export const FolderDetailPage: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [subFolders, setSubFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [refreshKey] = useState(0);

  // Get folder data from centralized mock data
  const folder = getFolderById(folderId || "1") || {
    id: folderId || "1",
    name: "Unknown Folder",
    description: "Folder description",
    color: "blue",
    fileCount: 0,
    size: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const colorConfig =
    FOLDER_COLORS[folder.color as keyof typeof FOLDER_COLORS] ||
    FOLDER_COLORS.blue;

  // Get exact counts and calculated size
  const currentFolderId = folderId || "1";
  const exactFileCount = getExactFileCount(currentFolderId);
  const folderSize = calculateFolderSize(currentFolderId);

  // Reload data when folderId changes
  useEffect(() => {
    setSubFolders(getSubFolders(currentFolderId));
    setFiles(getFilesByFolder(currentFolderId));
    setSearchQuery(""); // Reset search when changing folders
  }, [folderId, currentFolderId]);

  const handleDeleteFile = (file: EncryptedFile) => {
    deleteFileById(file.id);
    setFiles(getFilesByFolder(folderId || "1"));
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
    setFiles(getFilesByFolder(folderId || "1"));
  };

  const handleUpload = () => {
    navigate("/upload", { state: { folderId: folder.id } });
  };

  const handleCreateSubFolder = (newFolder: Folder) => {
    addFolder(newFolder);
    setSubFolders(getSubFolders(folderId || "1"));
  };

  const handleDeleteSubFolder = (subFolderId: string) => {
    deleteFolderById(subFolderId);
    setSubFolders(getSubFolders(folderId || "1"));
  };

  const handleEditSubFolder = (subFolder: Folder) => {
    console.log("Edit subfolder:", subFolder);
  };

  // Breadcrumb items
  const breadcrumbItems = [
    { id: folder.id!, name: folder.name, path: `/folder/${folder.id}` },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div
        className={`flex items-center gap-4 bg-gradient-to-r ${colorConfig.gradient} rounded-xl p-6 text-white shadow-lg`}
      >
        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
          <FolderIcon className="h-8 w-8 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{folder.name}</h1>
          <p className="text-white/90 mt-1">{folder.description}</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-white/80">
            <span>{subFolders.length} folders</span>
            <span>•</span>
            <span>{exactFileCount} files</span>
            <span>•</span>
            <span>{formatSize(folderSize)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateFolderModal(true)}
            className="px-4 py-3 bg-white/10 backdrop-blur-sm text-white font-medium rounded-lg hover:bg-white/20 transition-colors border border-white/20 flex items-center gap-2"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
          <button
            onClick={handleUpload}
            className="px-6 py-3 bg-white text-gray-900 font-medium rounded-lg hover:bg-white/90 transition-colors shadow-md flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Unified Folder and File Table */}
      <UnifiedFolderTable
        key={refreshKey}
        folderId={folderId || "1"}
        folders={subFolders}
        files={files}
        onDeleteFolder={handleDeleteSubFolder}
        onEditFolder={handleEditSubFolder}
        onDeleteFile={handleDeleteFile}
        onDownloadFile={handleDownloadFile}
        onShareFile={handleShareFile}
        onToggleStar={handleToggleStar}
        searchQuery={searchQuery}
      />

      {/* Create Subfolder Modal */}
      {showCreateFolderModal && (
        <CreateFolderModal
          onClose={() => setShowCreateFolderModal(false)}
          onCreate={handleCreateSubFolder}
          parentFolderId={folderId}
          parentFolderName={folder.name}
        />
      )}
    </div>
  );
};
