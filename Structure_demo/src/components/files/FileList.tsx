import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiService } from "../../services/apiService";
import { cryptoService } from "../../services/cryptoService";
import { useAuth } from "../../contexts/AuthContext";
import type { EncryptedFile } from "../../types";
import { FileShareDialog } from "./FileShareDialog";
import { FileTable } from "./FileTable";
import { FilePreview } from "./FilePreview";
import { Trash2 } from "lucide-react";

export const FileList: React.FC<{ key?: number }> = () => {
  const { user, keyPair } = useAuth();
  const location = useLocation();
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [shareModalFile, setShareModalFile] = useState<EncryptedFile | null>(
    null
  );

  // Selection & Preview State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<{ name: string, mimeType: string, data: Blob } | null>(null);

  // Reload files whenever we navigate to this component OR when location changes
  useEffect(() => {
    loadFiles();
  }, [location]); // Re-run when location changes

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected
      if (e.key === 'Delete' && selectedIds.size > 0) {
        handleBatchDelete();
      }
      // Select All
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(files.map(f => f.id)));
      }
      // Clear selection
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
        setPreviewFile(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, files]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const userFiles = await apiService.getFiles();
      setFiles(userFiles);
    } catch (err) {
      console.error("[FileList] Error loading files:", err);
      setError("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const decryptFile = async (file: EncryptedFile): Promise<Blob> => {
    if (!user || !keyPair) throw new Error("Not authenticated");

    // 1. Download the encrypted blob from the server
    // The encryptedDataUrl is now a URL to the file endpoint, not the data itself
    const blob = await apiService.downloadFile(file.id);

    // 2. Convert Blob to Base64 to reconstruct the envelope format expected by cryptoService
    const reader = new FileReader();
    const base64Data = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g. "data:application/octet-stream;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // 3. Reconstruct the envelope
    // We stored the encryption metadata JSON in the 'iv' field
    console.log('[DEBUG] File object:', JSON.stringify(file, null, 2));
    console.log('[DEBUG] file.iv value:', file.iv);
    console.log('[DEBUG] file.iv type:', typeof file.iv);

    let encryptionMetadata;
    try {
      encryptionMetadata = JSON.parse(file.iv);
    } catch (e) {
      console.error("Failed to parse encryption metadata from IV field", e);
      console.error("[DEBUG] Actual file.iv value that failed to parse:", file.iv);
      // Fallback for legacy files or if IV is actually just an IV string
      // This might fail decryption but it's better than crashing here
      throw new Error("Invalid file metadata: encryption metadata missing");
    }

    const envelope = {
      fileId: file.id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.mimeType,
      encryptedData: base64Data,
      encryptionMetadata: encryptionMetadata,
      timestamp: file.uploadedAt
    };

    const decryptedFile = await cryptoService.decryptFile(
      envelope,
      keyPair,
      (progress, message) => {
        setDownloadProgress(progress);
        console.log(`[FileList] ${message} (${progress}%)`);
      }
    );

    return new Blob([decryptedFile.data], { type: decryptedFile.mimeType });
  };

  const handleDownload = async (file: EncryptedFile) => {
    if (!user || !keyPair) {
      alert("You must be logged in to download files");
      return;
    }

    try {
      setDownloadingId(file.id);
      setDownloadProgress(0);

      const blob = await decryptFile(file);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name; // Use original name
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log("[FileList] Download complete!");
    } catch (err) {
      console.error("[FileList] Download error:", err);
      alert(
        `Failed to download file: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  const handleDelete = async (file: EncryptedFile) => {
    if (!confirm(`Delete ${file.name}?`)) return;

    try {
      await apiService.deleteFile(file.id);
      setFiles(files.filter((f) => f.id !== file.id));
      if (selectedIds.has(file.id)) {
        const newSelected = new Set(selectedIds);
        newSelected.delete(file.id);
        setSelectedIds(newSelected);
      }
    } catch (err) {
      console.error("[FileList] Delete error:", err);
      alert("Failed to delete file");
    }
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} files?`)) return;

    try {
      // Execute sequentially to avoid rate limits or race conditions
      for (const id of selectedIds) {
        await apiService.deleteFile(id);
      }
      setFiles(files.filter(f => !selectedIds.has(f.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Batch delete error:", err);
      alert("Failed to delete some files");
    }
  };

  const handleShare = (file: EncryptedFile) => {
    setShareModalFile(file);
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = (ids: string[]) => {
    if (selectedIds.size === ids.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ids));
    }
  };

  const handlePreview = async (file: any) => { // Using any for FileTableFile compatibility
    // Find the full EncryptedFile object
    const fullFile = files.find(f => f.id === file.id);
    if (!fullFile) return;

    try {
      setDownloadingId(fullFile.id);
      const blob = await decryptFile(fullFile);
      setPreviewFile({
        name: fullFile.name,
        mimeType: fullFile.mimeType,
        data: blob
      });
    } catch (err) {
      console.error("Preview error:", err);
      alert("Failed to decrypt file for preview");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      {/* Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-blue-700 font-medium">{selectedIds.size} files selected</span>
          <button
            onClick={handleBatchDelete}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected
          </button>
        </div>
      )}

      <FileTable
        files={files.map(f => ({
          ...f, // Keep all original fields including iv, salt, etc.
          encrypted: true,
        }))}
        loading={loading}
        error={error}
        showStats={true}
        showSearch={false}
        showUploadButton={false}
        canDelete={true}
        onDownload={handleDownload}
        onDelete={handleDelete}
        onShare={handleShare}
        downloadingId={downloadingId}
        downloadProgress={downloadProgress}
        // Selection & Preview
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
        onPreview={handlePreview}
      />

      {/* Share Modal */}
      {shareModalFile && (
        <FileShareDialog
          fileId={shareModalFile.id}
          fileName={shareModalFile.name}
          onClose={() => setShareModalFile(null)}
          onShareComplete={() => {
            setShareModalFile(null);
            // Optional: refresh list or show toast
          }}
        />
      )}

      {/* Preview Modal */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={() => {
            const url = URL.createObjectURL(previewFile.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = previewFile.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
        />
      )}
    </>
  );
};
