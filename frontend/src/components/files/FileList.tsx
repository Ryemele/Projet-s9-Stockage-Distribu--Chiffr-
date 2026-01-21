import React, { useEffect, useState } from "react";
import { apiService } from "../../services/apiService";
import { afghFileService } from "../../services/crypto/afghFileService";
import { useAuth } from "../../contexts/AuthContext";
import type { EncryptedFile } from "../../types";
import { ShareWithTeamModal } from "./ShareWithTeamModal";
import { FileTable } from "./FileTable";

export const FileList: React.FC<{ key?: number }> = () => {
  const { user, keyPair } = useAuth();
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [shareModalFile, setShareModalFile] = useState<EncryptedFile | null>(
    null
  );

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

  const handleShare = (file: EncryptedFile) => {
    setShareModalFile(file);
  };

  const handleShareWithTeams = (teamIds: string[]) => {
    console.log("[FileList] Sharing file with teams:", teamIds);
    alert(
      `File "${shareModalFile?.name}" shared with ${teamIds.length} team(s)!`
    );
    setShareModalFile(null);
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

      {/* Share with Team Modal */}
      {shareModalFile && (
        <ShareWithTeamModal
          fileName={shareModalFile.name}
          onClose={() => setShareModalFile(null)}
          onShare={handleShareWithTeams}
        />
      )}
    </>
  );
};
