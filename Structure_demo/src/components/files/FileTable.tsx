import React, { useState } from "react";
import {
  Download,
  Trash2,
  Share2,
  FileIcon as File,
  Lock,
  Calendar,
  User,
  Search,
  Upload,
  Star,
  FileText,
  Image,
  Video,
  Archive,
  Eye,
} from "lucide-react";
import { categorizeFile } from "../../utils/fileCategories";

interface FileTableFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string;
  uploadedByUser?: {
    name: string;
    email: string;
    avatar?: string;
  };
  encrypted?: boolean;
  starred?: boolean;
  mimeType?: string;
}

interface FileTableProps {
  files: FileTableFile[];
  loading?: boolean;
  error?: string | null;
  showStats?: boolean;
  showSearch?: boolean;
  showUploadButton?: boolean;
  canUpload?: boolean;
  canDelete?: boolean;
  onDownload: (file: FileTableFile) => void;
  onDelete?: (file: FileTableFile) => void;
  onShare?: (file: FileTableFile) => void;
  onUpload?: () => void;
  onToggleStar?: (file: FileTableFile) => void;
  downloadingId?: string | null;
  downloadProgress?: number;
  // Selection props
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  onPreview?: (file: FileTableFile) => void;
}

export const FileTable: React.FC<FileTableProps> = ({
  files,
  loading = false,
  error = null,
  showSearch = false,
  showUploadButton = false,
  canUpload = true,
  canDelete = true,
  onDownload,
  onDelete,
  onShare,
  onUpload,
  onToggleStar,
  downloadingId = null,
  selectedIds = new Set(),
  onToggleSelect,
  onSelectAll,
  onPreview,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFileIcon = (file: FileTableFile) => {
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

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allSelected = filteredFiles.length > 0 && filteredFiles.every(f => selectedIds.has(f.id));

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
          <File className="h-10 w-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No files yet</h3>
        <p className="text-gray-500 text-sm mb-6">
          Upload your first file to get started
        </p>
        {canUpload && onUpload && (
          <button
            onClick={onUpload}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-all"
          >
            <Upload className="h-5 w-5" />
            Upload First File
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      {(showSearch || showUploadButton) && (
        <div className="flex items-center justify-between gap-4">
          {showSearch && (
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          {showUploadButton && canUpload && onUpload && (
            <button
              onClick={onUpload}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              <Upload className="h-4 w-4" />
              Upload File
            </button>
          )}
        </div>
      )}

      {/* Files Table */}
      {filteredFiles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
            <File className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No files found
          </h3>
          <p className="text-gray-500 text-sm">
            Try adjusting your search terms
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {onSelectAll && (
                    <th className="px-6 py-3 w-4">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => onSelectAll(filteredFiles.map(f => f.id))}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  {files.some((f) => f.uploadedBy || f.uploadedByUser) && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploaded By
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredFiles.map((file) => {
                  const isDownloading = downloadingId === file.id;
                  const isEncrypted = file.encrypted !== false;
                  const { icon: FileIcon, color, bg } = getFileIcon(file);
                  const isSelected = selectedIds.has(file.id);

                  return (
                    <tr
                      key={file.id}
                      className={`hover:bg-gray-50 transition-colors group ${isSelected ? 'bg-blue-50' : ''}`}
                      onClick={() => onPreview && onPreview(file)}
                    >
                      {onToggleSelect && (
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect(file.id)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 cursor-pointer">
                          {onToggleStar && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleStar(file); }}
                              className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
                              title={
                                file.starred
                                  ? "Remove from favorites"
                                  : "Add to favorites"
                              }
                            >
                              <Star
                                className={`h-5 w-5 transition-colors ${file.starred
                                  ? "fill-blue-300 text-blue-300"
                                  : "text-gray-300 hover:text-blue-300"
                                  }`}
                              />
                            </button>
                          )}
                          <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <FileIcon className={`h-5 w-5 ${color}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {file.name}
                            </p>
                            {isEncrypted && (
                              <div className="flex items-center gap-1 mt-1">
                                <Lock className="h-3 w-3 text-green-600" />
                                <span className="text-xs text-green-600 font-medium">
                                  Encrypted
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {formatFileSize(file.size)}
                        </span>
                      </td>
                      {files.some((f) => f.uploadedBy || f.uploadedByUser) && (
                        <td className="px-6 py-4">
                          {file.uploadedByUser ? (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-400 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {file.uploadedByUser.avatar ? (
                                  <img
                                    src={file.uploadedByUser.avatar}
                                    alt={file.uploadedByUser.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-white text-xs font-semibold">
                                    {file.uploadedByUser.name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {file.uploadedByUser.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {file.uploadedByUser.email}
                                </p>
                              </div>
                            </div>
                          ) : file.uploadedBy ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-900">
                                {file.uploadedBy}
                              </span>
                            </div>
                          ) : null}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {formatDate(file.uploadedAt)}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 transition-opacity">
                          {onPreview && (
                            <button
                              onClick={() => onPreview(file)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                              title="Preview"
                              disabled={isDownloading}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onDownload(file)}
                            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                            title="Download"
                            disabled={isDownloading}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          {onShare && (
                            <button
                              onClick={() => onShare(file)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                              title="Share"
                              disabled={isDownloading}
                            >
                              <Share2 className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && onDelete && (
                            <button
                              onClick={() => onDelete(file)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete"
                              disabled={isDownloading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security Info */}
      <div className="bg-primary-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700">
            <p className="font-medium text-gray-900 mb-1">
              End-to-End Encryption
            </p>
            <p className="text-gray-600">
              All files are encrypted end-to-end. Only authorized users with the
              proper keys can access them.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
