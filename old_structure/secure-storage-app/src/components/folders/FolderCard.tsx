import React from "react";
import { Folder, File, Trash2, Edit2, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Folder as FolderType } from "../../types/folder";
import { FOLDER_COLORS } from "../../types/folder";
import {
  getExactFileCount,
  getExactSubfolderCount,
  calculateFolderSize,
  formatSize,
} from "../../mocks";

interface FolderCardProps {
  folder: FolderType;
  onDelete?: (folderId: string) => void;
  onEdit?: (folder: FolderType) => void;
  viewMode?: "grid" | "list";
}

export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  onDelete,
  onEdit,
  viewMode = "grid",
}) => {
  const navigate = useNavigate();
  const colorConfig =
    FOLDER_COLORS[folder.color as keyof typeof FOLDER_COLORS] ||
    FOLDER_COLORS.blue;

  // Get exact counts and calculated size
  const exactFileCount = getExactFileCount(folder.id);
  const exactSubfolderCount = getExactSubfolderCount(folder.id);
  const folderSize = calculateFolderSize(folder.id);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleClick = () => {
    navigate(`/folder/${folder.id}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm(`Delete folder "${folder.name}"?`)) {
      onDelete(folder.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(folder);
    }
  };

  // List view (compact single-line layout)
  if (viewMode === "list") {
    return (
      <div
        onClick={handleClick}
        className="group flex items-center justify-between px-4 py-2 rounded-lg hover:bg-gray-50 transition-all duration-150 border border-transparent hover:border-gray-200 cursor-pointer"
      >
        {/* Folder Icon & Name */}
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <div
              className={`w-8 h-8 bg-gradient-to-br ${colorConfig.gradient} rounded-lg flex items-center justify-center`}
            >
              <Folder className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {folder.name}
            </h3>
          </div>
        </div>

        {/* File Count and Subfolder Count */}
        <div className="hidden md:flex items-center gap-3 px-4 w-32">
          <div className="flex items-center gap-1">
            <File className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-500">{exactFileCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <FolderOpen className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-500">{exactSubfolderCount}</span>
          </div>
        </div>

        {/* Size */}
        <div className="hidden lg:flex items-center px-4 w-24">
          <span className="text-xs text-gray-500">
            {formatSize(folderSize)}
          </span>
        </div>

        {/* Date */}
        <div className="hidden xl:flex items-center px-4 w-32">
          <span className="text-xs text-gray-500">
            {formatDate(folder.updatedAt)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleEdit}
            title="Edit"
            className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            title="Delete"
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Grid view (original card layout)
  return (
    <div
      onClick={handleClick}
      className="group relative bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Background Pattern */}
      <div
        className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorConfig.gradient} opacity-5 rounded-bl-full`}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div
            className={`w-14 h-14 bg-gradient-to-br ${colorConfig.gradient} rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-200`}
          >
            <Folder className="h-7 w-7 text-white" />
          </div>

          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <button
              onClick={handleEdit}
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
              title="Edit folder"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Delete folder"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Folder Info */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors truncate">
            {folder.name}
          </h3>
          {folder.description && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {folder.description}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <File className="h-4 w-4" />
                <span>
                  {exactFileCount} {exactFileCount === 1 ? "file" : "files"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FolderOpen className="h-4 w-4" />
                <span>
                  {exactSubfolderCount}{" "}
                  {exactSubfolderCount === 1 ? "folder" : "folders"}
                </span>
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-500">{formatSize(folderSize)}</div>
        </div>
      </div>
    </div>
  );
};
