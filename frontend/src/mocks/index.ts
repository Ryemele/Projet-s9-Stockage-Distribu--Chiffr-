/**
 * Central export point for all data services
 * Provides unified interface for files, folders, and teams
 */
export * from "./folders";
export * from "./files";
export * from "./teams";

// Import for internal use
import { getFilesByFolder, getAllFiles } from "./files";
import { getSubFolders } from "./folders";

/**
 * Get exact file count for a folder
 */
export const getExactFileCount = (folderId: string): number => {
  return getFilesByFolder(folderId).length;
};

/**
 * Get exact subfolder count for a folder
 */
export const getExactSubfolderCount = (folderId: string): number => {
  return getSubFolders(folderId).length;
};

/**
 * Calculate real folder size recursively (including all subfolders and files)
 */
export const calculateFolderSize = (folderId: string): number => {
  // Get direct files in this folder
  const directFiles = getFilesByFolder(folderId);
  const directFilesSize = directFiles.reduce((acc, file) => acc + file.size, 0);

  // Get subfolders and calculate their sizes recursively
  const subFolders = getSubFolders(folderId);
  const subFoldersSize = subFolders.reduce((acc, folder) => {
    return acc + calculateFolderSize(folder.id!);
  }, 0);

  return directFilesSize + subFoldersSize;
};

/**
 * Calculate total storage used (all files)
 */
export const calculateTotalStorage = (): number => {
  const allFiles = getAllFiles();
  return allFiles.reduce((acc, file) => acc + file.size, 0);
};

/**
 * Format size helper - converts bytes to human readable format
 */
export const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(2) + " GB";
};

/**
 * Get exact file count for a team
 */
export const getTeamFileCount = (teamId: string): number => {
  const allFiles = getAllFiles();
  return allFiles.filter((file) => file.teamId === teamId).length;
};
