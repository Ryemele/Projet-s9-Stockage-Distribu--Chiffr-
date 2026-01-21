import React, { useEffect, useState } from "react";
import { apiService } from "../../services/apiService";
import { afghFileService } from "../../services/crypto/afghFileService";
import { useAuth } from "../../contexts/AuthContext";
import type { EncryptedFile } from "../../types";
import type { AFGHFileEnvelope } from "../../types/afgh";
import { FileShareDialog } from "./FileShareDialog";
import { FileTable } from "./FileTable";

export const FileList: React.FC<{ key?: number }> = () => {
  const { user, keyPair } = useAuth();
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [shareModalFile, setShareModalFile] = useState<EncryptedFile | null>(null);
  const [shareEnvelope, setShareEnvelope] = useState<AFGHFileEnvelope | null>(null);
  const [loadingShareEnvelope, setLoadingShareEnvelope] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

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

  const handleDownload = async (file: EncryptedFile) => {
    if (!user || !keyPair) {
      alert("You must be logged in to download files");
      return;
    }

    try {
      setDownloadingId(file.id);
      setDownloadProgress(0);
      console.log("[FileList] Starting download for:", file.name);

      // Step 1: Download encrypted file from backend
      console.log("[FileList] Fetching encrypted file from server...");
      setDownloadProgress(10);
      const encryptedBlob = await apiService.downloadFile(file.id);

      // Step 2: Read blob as text (it's a JSON envelope)
      console.log("[FileList] Reading encrypted envelope...");
      setDownloadProgress(20);
      const envelopeText = await encryptedBlob.text();

      // Step 3: Deserialize the AFGH envelope
      console.log("[FileList] Deserializing envelope...");
      const envelope = afghFileService.deserializeEnvelope(envelopeText);
      console.log("[FileList] Envelope loaded:", envelope.fileId);

      // Step 4: Decrypt the file with AFGH service
      console.log("[FileList] Decrypting file with AFGH...");
      const decryptedFile = await afghFileService.decryptFileOwner(
        envelope,
        keyPair,
        (progress, message) => {
          // Map progress from 0-100 to 30-90
          const mappedProgress = 30 + Math.round(progress * 0.6);
          setDownloadProgress(mappedProgress);
          console.log(`[FileList] ${message} (${progress}%)`);
        }
      );

      console.log(
        "[FileList] File decrypted successfully:",
        decryptedFile.fileName
      );
      setDownloadProgress(95);

      // Step 5: Create Blob and trigger download
      const blob = new Blob([decryptedFile.data], {
        type: decryptedFile.mimeType,
      });
      const decryptedFileName = decryptedFile.fileName;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = decryptedFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadProgress(100);
      console.log("[FileList] Download complete!");
      alert(`File "${file.name}" downloaded successfully!`);
    } catch (err) {
      console.error("[FileList] Download error:", err);
      alert(
        `Failed to download file: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
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
    } catch (err) {
      console.error("[FileList] Delete error:", err);
      alert("Failed to delete file");
    }
  };

  const handleShare = async (file: EncryptedFile) => {
    try {
      setLoadingShareEnvelope(true);
      setShareModalFile(file);

      // Download and parse the envelope for sharing
      console.log("[FileList] Loading envelope for sharing:", file.name);
      const encryptedBlob = await apiService.downloadFile(file.id);
      const envelopeText = await encryptedBlob.text();
      const envelope = afghFileService.deserializeEnvelope(envelopeText);

      setShareEnvelope(envelope);
      console.log("[FileList] Envelope loaded for sharing");
    } catch (err) {
      console.error("[FileList] Error loading envelope for share:", err);
      alert("Failed to prepare file for sharing. Please try again.");
      setShareModalFile(null);
    } finally {
      setLoadingShareEnvelope(false);
    }
  };

  const handleShareComplete = () => {
    setShareModalFile(null);
    setShareEnvelope(null);
  };

  return (
    <>
      <FileTable
        files={files.map(f => ({
          id: f.id,
          name: f.name,
          size: f.size,
          uploadedAt: f.uploadedAt,
          encrypted: true,
          mimeType: f.mimeType,
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
      />

      {/* Share File Dialog */}
      {shareModalFile && shareEnvelope && (
        <FileShareDialog
          fileId={shareModalFile.id}
          fileName={shareModalFile.name}
          envelope={shareEnvelope}
          onClose={() => {
            setShareModalFile(null);
            setShareEnvelope(null);
          }}
          onShareComplete={handleShareComplete}
        />
      )}

      {/* Loading overlay when preparing to share */}
      {loadingShareEnvelope && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <span className="text-gray-700">Preparing file for sharing...</span>
          </div>
        </div>
      )}
    </>
  );
};
