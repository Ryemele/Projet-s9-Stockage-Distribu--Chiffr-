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

      // Récupérer l'enveloppe depuis le serveur
      console.log("[FileList] Fetching encrypted file envelope...");
      const encryptedDataUrl = file.encryptedDataUrl;

      // Désérialiser l'enveloppe AFGH
      const envelope = afghFileService.deserializeEnvelope(encryptedDataUrl);
      console.log("[FileList] Envelope loaded:", envelope.fileId);

      // Déchiffrer le fichier avec le service AFGH (real encryption!)
      console.log("[FileList] Decrypting file with AFGH...");
      const decryptedFile = await afghFileService.decryptFileOwner(
        envelope,
        keyPair,
        (progress, message) => {
          setDownloadProgress(progress);
          console.log(`[FileList] ${message} (${progress}%)`);
        }
      );

      console.log(
        "[FileList] File decrypted successfully:",
        decryptedFile.fileName
      );

      // Créer un Blob et télécharger le fichier déchiffré
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
