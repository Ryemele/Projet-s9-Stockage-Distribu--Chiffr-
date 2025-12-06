import React, { useState } from 'react';
import {
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Download,
  Trash2,
  Share2,
  Edit2,
  Star,
  FileText,
  Image,
  Video,
  Archive,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Folder as FolderType } from '../../types/folder';
import type { EncryptedFile } from '../../types';
import { FOLDER_COLORS } from '../../types/folder';
import { categorizeFile } from '../../utils/fileCategories';

// Placeholder functions - folders not implemented in backend
const getSubFolders = (_folderId: string): FolderType[] => [];
const getFilesByFolder = (_folderId: string): EncryptedFile[] => [];

type ItemType = 'folder' | 'file';

interface UnifiedItem {
  id: string;
  name: string;
  type: ItemType;
  size: number;
  uploadedAt: string;
  color?: string;
  starred?: boolean;
  data: FolderType | EncryptedFile;
}

interface UnifiedFolderTableProps {
  folderId: string;
  folders: FolderType[];
  files: EncryptedFile[];
  onDeleteFolder?: (folderId: string) => void;
  onEditFolder?: (folder: FolderType) => void;
  onDeleteFile?: (file: EncryptedFile) => void;
  onDownloadFile?: (file: EncryptedFile) => void;
  onShareFile?: (file: EncryptedFile) => void;
  onToggleStar?: (file: EncryptedFile) => void;
  searchQuery?: string;
}

export const UnifiedFolderTable: React.FC<UnifiedFolderTableProps> = ({
  //folderId,
  folders,
  files,
  onDeleteFolder,
  onEditFolder,
  onDeleteFile,
  onDownloadFile,
  onShareFile,
  onToggleStar,
  searchQuery = '',
}) => {
  const navigate = useNavigate();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getFileIcon = (file: EncryptedFile) => {
    const category = categorizeFile(file.mimeType || '', file.name);

    switch (category) {
      case 'documents':
        return { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' };
      case 'images':
        return { icon: Image, color: 'text-green-600', bg: 'bg-green-100' };
      case 'videos':
        return { icon: Video, color: 'text-purple-600', bg: 'bg-purple-100' };
      case 'archives':
        return { icon: Archive, color: 'text-orange-600', bg: 'bg-orange-100' };
      default:
        return { icon: File, color: 'text-gray-600', bg: 'bg-gray-100' };
    }
  };

  const toggleFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFolderClick = (folder: FolderType) => {
    navigate(`/folder/${folder.id}`);
  };

  // Combine folders and files into unified items
  const unifiedItems: UnifiedItem[] = [
    ...folders.map((folder) => ({
      id: folder.id!,
      name: folder.name,
      type: 'folder' as ItemType,
      size: folder.size,
      uploadedAt: folder.updatedAt,
      color: folder.color,
      data: folder,
    })),
    ...files.map((file) => ({
      id: file.id,
      name: file.name,
      type: 'file' as ItemType,
      size: file.size,
      uploadedAt: file.uploadedAt,
      starred: file.starred,
      data: file,
    })),
  ];

  // Filter items based on search query
  const filteredItems = unifiedItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: folders first, then files, both alphabetically
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  const renderItem = (item: UnifiedItem, level: number = 0) => {
    const isFolder = item.type === 'folder';
    const isExpanded = expandedFolders.has(item.id);
    const hasChildren = isFolder && (getSubFolders(item.id).length > 0 || getFilesByFolder(item.id).length > 0);

    const folder = isFolder ? (item.data as FolderType) : null;
    const file = !isFolder ? (item.data as EncryptedFile) : null;

    const colorConfig = folder ? FOLDER_COLORS[folder.color as keyof typeof FOLDER_COLORS] || FOLDER_COLORS.blue : null;

    return (
      <React.Fragment key={item.id}>
        <tr
          className={`hover:bg-gray-50 transition-colors group ${isFolder ? 'cursor-pointer' : ''}`}
          onClick={isFolder ? () => handleFolderClick(folder!) : undefined}
        >
          <td className="px-6 py-3">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
              {/* Expand/Collapse Icon */}
              {isFolder && hasChildren && (
                <button
                  className="expand-icon p-0.5 hover:bg-gray-200 rounded transition-colors"
                  onClick={(e) => toggleFolder(item.id, e)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                </button>
              )}
              {isFolder && !hasChildren && <div className="w-5" />}

              {/* Star Icon for Files */}
              {!isFolder && onToggleStar && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStar(file!);
                  }}
                  className="flex-shrink-0 p-0.5 hover:bg-gray-100 rounded transition-colors"
                  title={file?.starred ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star
                    className={`h-4 w-4 transition-colors ${file?.starred
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300 hover:text-yellow-400'
                      }`}
                  />
                </button>
              )}

              {/* Icon */}
              {isFolder ? (
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${colorConfig?.gradient}`}
                >
                  <Folder className="h-4 w-4 text-white" />
                </div>
              ) : (
                (() => {
                  const { icon: FileIcon, color, bg } = getFileIcon(file!);
                  return (
                    <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <FileIcon className={`h-4 w-4 ${color}`} />
                    </div>
                  );
                })()
              )}

              {/* Name */}
              <span className={`text-sm ${isFolder ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                {item.name}
              </span>
            </div>
          </td>

          {/* Size */}
          <td className="px-6 py-3">
            <span className="text-sm text-gray-600">{formatSize(item.size)}</span>
          </td>

          {/* Modified Date */}
          <td className="px-6 py-3">
            <span className="text-sm text-gray-600">{formatDate(item.uploadedAt)}</span>
          </td>

          {/* Actions */}
          <td className="px-6 py-3">
            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isFolder ? (
                <>
                  {onEditFolder && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditFolder(folder!);
                      }}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                      title="Edit folder"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                  {onDeleteFolder && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete folder "${folder!.name}"?`)) {
                          onDeleteFolder(folder!.id!);
                        }
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete folder"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  {onDownloadFile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadFile(file!);
                      }}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                  {onShareFile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShareFile(file!);
                      }}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                      title="Share"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  )}
                  {onDeleteFile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete file "${file!.name}"?`)) {
                          onDeleteFile(file!);
                        }
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </td>
        </tr>

        {/* Render children if folder is expanded */}
        {isFolder && isExpanded && hasChildren && (
          <>
            {renderChildItems(item.id, level + 1)}
          </>
        )}
      </React.Fragment>
    );
  };

  const renderChildItems = (parentId: string, level: number) => {
    const childFolders = getSubFolders(parentId);
    const childFiles = getFilesByFolder(parentId);

    const childItems: UnifiedItem[] = [
      ...childFolders.map((folder) => ({
        id: folder.id!,
        name: folder.name,
        type: 'folder' as ItemType,
        size: folder.size,
        uploadedAt: folder.updatedAt,
        color: folder.color,
        data: folder,
      })),
      ...childFiles.map((file) => ({
        id: file.id,
        name: file.name,
        type: 'file' as ItemType,
        size: file.size,
        uploadedAt: file.uploadedAt,
        starred: file.starred,
        data: file,
      })),
    ];

    // Sort: folders first, then files
    const sortedChildItems = [...childItems].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return sortedChildItems.map((item) => renderItem(item, level));
  };

  if (sortedItems.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
          <File className="h-10 w-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {searchQuery ? 'No items found' : 'No items in this folder'}
        </h3>
        <p className="text-gray-500 text-sm">
          {searchQuery
            ? 'Try adjusting your search terms'
            : 'Upload files or create folders to get started'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Modified
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedItems.map((item) => renderItem(item, 0))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
