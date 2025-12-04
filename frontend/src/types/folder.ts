export interface Folder {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
  size: number;
  parentFolderId?: string | null;
  subFolders?: Folder[];
}

export type FolderColor =
  | 'blue'
  | 'purple'
  | 'green'
  | 'orange'
  | 'red'
  | 'pink'
  | 'indigo'
  | 'yellow';

export const FOLDER_COLORS: Record<FolderColor, { bg: string; text: string; gradient: string }> = {
  blue: {
    bg: 'bg-primary-100',
    text: 'text-primary-700',
    gradient: 'from-primary-500 to-secondary-400',
  },
  purple: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    gradient: 'from-purple-500 to-purple-600',
  },
  green: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    gradient: 'from-green-500 to-green-600',
  },
  orange: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    gradient: 'from-orange-500 to-orange-600',
  },
  red: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    gradient: 'from-red-500 to-red-600',
  },
  pink: {
    bg: 'bg-pink-100',
    text: 'text-pink-700',
    gradient: 'from-pink-500 to-pink-600',
  },
  indigo: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-700',
    gradient: 'from-indigo-500 to-secondary-400',
  },
  yellow: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    gradient: 'from-yellow-500 to-yellow-600',
  },
};
