export type FileCategory = 'documents' | 'images' | 'videos' | 'archives' | 'other';

export interface CategoryInfo {
  size: number;
  color: string;
  label: string;
}

export const FILE_CATEGORIES: Record<FileCategory, Omit<CategoryInfo, 'size'>> = {
  documents: { color: '#3B82F6', label: 'Documents' },
  images: { color: '#10B981', label: 'Images' },
  videos: { color: '#8B5CF6', label: 'Videos' },
  archives: { color: '#F59E0B', label: 'Archives' },
  other: { color: '#6B7280', label: 'Other' },
};

/**
 * Categorize a file based on its mimeType and filename extension
 */
export function categorizeFile(mimeType: string, filename: string): FileCategory {
  const lowerMimeType = mimeType.toLowerCase();
  const lowerFilename = filename.toLowerCase();

  // Documents - PDFs, Office files, text files
  if (
    lowerMimeType.includes('pdf') ||
    lowerMimeType.includes('document') ||
    lowerMimeType.includes('word') ||
    lowerMimeType.includes('spreadsheet') ||
    lowerMimeType.includes('excel') ||
    lowerMimeType.includes('presentation') ||
    lowerMimeType.includes('powerpoint') ||
    lowerMimeType.includes('text/plain') ||
    lowerMimeType.includes('text/csv') ||
    lowerFilename.endsWith('.pdf') ||
    lowerFilename.endsWith('.doc') ||
    lowerFilename.endsWith('.docx') ||
    lowerFilename.endsWith('.xls') ||
    lowerFilename.endsWith('.xlsx') ||
    lowerFilename.endsWith('.ppt') ||
    lowerFilename.endsWith('.pptx') ||
    lowerFilename.endsWith('.txt') ||
    lowerFilename.endsWith('.csv') ||
    lowerFilename.endsWith('.odt') ||
    lowerFilename.endsWith('.ods') ||
    lowerFilename.endsWith('.odp')
  ) {
    return 'documents';
  }

  // Images
  if (
    lowerMimeType.includes('image') ||
    lowerFilename.endsWith('.jpg') ||
    lowerFilename.endsWith('.jpeg') ||
    lowerFilename.endsWith('.png') ||
    lowerFilename.endsWith('.gif') ||
    lowerFilename.endsWith('.svg') ||
    lowerFilename.endsWith('.webp') ||
    lowerFilename.endsWith('.bmp') ||
    lowerFilename.endsWith('.ico') ||
    lowerFilename.endsWith('.tiff')
  ) {
    return 'images';
  }

  // Videos
  if (
    lowerMimeType.includes('video') ||
    lowerFilename.endsWith('.mp4') ||
    lowerFilename.endsWith('.avi') ||
    lowerFilename.endsWith('.mov') ||
    lowerFilename.endsWith('.wmv') ||
    lowerFilename.endsWith('.flv') ||
    lowerFilename.endsWith('.mkv') ||
    lowerFilename.endsWith('.webm') ||
    lowerFilename.endsWith('.m4v')
  ) {
    return 'videos';
  }

  // Archives - zip, rar, tar, etc.
  if (
    lowerMimeType.includes('zip') ||
    lowerMimeType.includes('archive') ||
    lowerMimeType.includes('compressed') ||
    lowerMimeType.includes('x-rar') ||
    lowerMimeType.includes('x-tar') ||
    lowerMimeType.includes('x-7z') ||
    lowerFilename.endsWith('.zip') ||
    lowerFilename.endsWith('.rar') ||
    lowerFilename.endsWith('.7z') ||
    lowerFilename.endsWith('.tar') ||
    lowerFilename.endsWith('.gz') ||
    lowerFilename.endsWith('.bz2') ||
    lowerFilename.endsWith('.xz')
  ) {
    return 'archives';
  }

  // Everything else
  return 'other';
}

/**
 * Calculate storage by category for a list of files
 */
export function calculateStorageByCategory(files: Array<{ name: string; size: number; mimeType: string }>) {
  const categories: Record<FileCategory, CategoryInfo> = {
    documents: { size: 0, ...FILE_CATEGORIES.documents },
    images: { size: 0, ...FILE_CATEGORIES.images },
    videos: { size: 0, ...FILE_CATEGORIES.videos },
    archives: { size: 0, ...FILE_CATEGORIES.archives },
    other: { size: 0, ...FILE_CATEGORIES.other },
  };

  files.forEach(file => {
    const category = categorizeFile(file.mimeType, file.name);
    categories[category].size += file.size;
  });

  return categories;
}
