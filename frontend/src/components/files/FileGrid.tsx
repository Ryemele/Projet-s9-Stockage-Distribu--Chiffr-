import React from "react";
import {
  Download,
  Trash2,
  Share2,
  FileIcon as File,
  Lock,
  Star,
  FileText,
  Image,
  Video,
  Archive,
  Music,
  Code,
} from "lucide-react";
import { categorizeFile } from "../../utils/fileCategories";

interface FileGridFile {
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

interface FileGridProps {
  files: FileGridFile[];
  onDownload: (file: FileGridFile) => void;
  onDelete?: (file: FileGridFile) => void;
  onShare?: (file: FileGridFile) => void;
  onToggleStar?: (file: FileGridFile) => void;
  downloadingId?: string | null;
}

export const FileGrid: React.FC<FileGridProps> = ({
  files,
  onDownload,
  onDelete,
  onShare,
  onToggleStar,
  downloadingId = null,
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getFileIcon = (file: FileGridFile) => {
    const category = categorizeFile(file.mimeType || '', file.name);

    switch (category) {
      case 'documents':
        return { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'images':
        return { icon: Image, color: 'text-green-600', bg: 'bg-green-50' };
      case 'videos':
        return { icon: Video, color: 'text-purple-600', bg: 'bg-purple-50' };
      case 'archives':
        return { icon: Archive, color: 'text-orange-600', bg: 'bg-orange-50' };
      default:
        return { icon: File, color: 'text-gray-600', bg: 'bg-gray-50' };
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {files.map((file) => {
        const isDownloading = downloadingId === file.id;
        const isEncrypted = file.encrypted !== false;
        const { icon: FileIcon, color, bg } = getFileIcon(file);

        return (
          <div
            key={file.id}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-all group relative"
          >
            {/* Star button */}
            {onToggleStar && (
              <button
                onClick={() => onToggleStar(file)}
                className="absolute top-3 right-3 p-1.5 hover:bg-gray-100 rounded transition-colors z-10"
                title={file.starred ? "Remove from favorites" : "Add to favorites"}
              >
                <Star
                  className={`h-4 w-4 transition-colors ${
                    file.starred
                      ? "fill-blue-300 text-blue-300"
                      : "text-gray-300 hover:text-blue-300"
                  }`}
                />
              </button>
            )}

            {/* File Icon */}
            <div className={`w-full aspect-square ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <FileIcon className={`h-12 w-12 ${color}`} />
            </div>

            {/* File Name */}
            <h3 className="text-sm font-medium text-gray-900 truncate mb-1" title={file.name}>
              {file.name}
            </h3>

            {/* File Info */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
              <span>{formatFileSize(file.size)}</span>
              <span>•</span>
              <span>{formatDate(file.uploadedAt)}</span>
            </div>

            {/* Encryption Badge */}
            {isEncrypted && (
              <div className="flex items-center gap-1 mb-3">
                <Lock className="h-3 w-3 text-green-600" />
                <span className="text-xs text-green-600 font-medium">Encrypted</span>
              </div>
            )}

            {/* Uploaded By */}
            {file.uploadedByUser && (
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-500 to-secondary-400 flex items-center justify-center overflow-hidden flex-shrink-0">
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
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {file.uploadedByUser.name}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDownload(file)}
                className="flex-1 p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all text-xs font-medium"
                title="Download"
                disabled={isDownloading}
              >
                <Download className="h-4 w-4 mx-auto" />
              </button>
              {onShare && (
                <button
                  onClick={() => onShare(file)}
                  className="flex-1 p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all text-xs font-medium"
                  title="Share"
                  disabled={isDownloading}
                >
                  <Share2 className="h-4 w-4 mx-auto" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(file)}
                  className="flex-1 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all text-xs font-medium"
                  title="Delete"
                  disabled={isDownloading}
                >
                  <Trash2 className="h-4 w-4 mx-auto" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
