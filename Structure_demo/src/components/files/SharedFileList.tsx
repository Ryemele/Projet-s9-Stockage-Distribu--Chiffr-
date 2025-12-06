import React, { useEffect, useState } from "react";
import { apiService } from "../../services/apiService";
import { cryptoService } from "../../services/cryptoService";
import { useAuth } from "../../contexts/AuthContext";
import type { FileShare } from "../../types";
import { FileTable } from "./FileTable";
import { FilePreview } from "./FilePreview";

export const SharedFileList: React.FC<{ key?: number }> = () => {
    const { user, keyPair } = useAuth();
    const [shareFiles, setShareFiles] = useState<FileShare[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [previewFile, setPreviewFile] = useState<{ name: string, mimeType: string, data: Blob } | null>(null);

    useEffect(() => {
        loadSharedFiles();
    }, []);

    const loadSharedFiles = async () => {
        try {
            setLoading(true);
            setError(null);
            const shares = await apiService.getSharedFiles();
            setShareFiles(shares);
        } catch (err) {
            console.error("[SharedFileList] Error loading shared files:", err);
            setError("Failed to load shared files");
        } finally {
            setLoading(false);
        }
    };

    const decryptSharedFile = async (share: FileShare): Promise<Blob> => {
        if (!user || !keyPair) throw new Error("Not authenticated");

        const blob = await apiService.downloadFile(share.fileId);

        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        const fileMetadata = await apiService.getFile(share.fileId);

        let encryptionMetadata;
        try {
            encryptionMetadata = JSON.parse(fileMetadata.iv);
        } catch (e) {
            console.error("Failed to parse encryption metadata", e);
            throw new Error("Invalid file metadata");
        }

        let rk;
        try {
            const rkData = JSON.parse(share.encryptedKey);
            rk = { rk: cryptoService.base64ToUint8Array(rkData.rk) };
        } catch (e) {
            console.error("Failed to parse re-encryption key", e);
            throw new Error("Invalid re-encryption key");
        }

        if (!share.ownerPublicKey) {
            throw new Error("Owner's public key not available");
        }

        let ownerPublicKey;
        if (typeof share.ownerPublicKey === 'string') {
            try {
                ownerPublicKey = JSON.parse(share.ownerPublicKey);
            } catch {
                throw new Error("Invalid owner public key format");
            }
        } else {
            ownerPublicKey = share.ownerPublicKey;
        }

        if (!ownerPublicKey.publicKey1 || !ownerPublicKey.publicKey2) {
            throw new Error("Invalid owner public key structure");
        }

        const pkA = {
            u1: cryptoService.base64ToUint8Array(ownerPublicKey.publicKey1),
            u2: cryptoService.base64ToUint8Array(ownerPublicKey.publicKey2)
        };

        const envelope = {
            fileId: share.fileId,
            fileName: fileMetadata.name,
            fileSize: fileMetadata.size,
            mimeType: fileMetadata.mimeType,
            encryptedData: base64Data,
            encryptionMetadata: encryptionMetadata,
            timestamp: fileMetadata.uploadedAt
        };

        console.log("[SharedFileList] Re-encrypting file for recipient...");
        const reEncryptedEnvelope = cryptoService.reEncrypt(envelope, rk, pkA);

        console.log("[SharedFileList] Decrypting re-encrypted file...");
        const decryptedFile = await cryptoService.decryptFile(
            reEncryptedEnvelope,
            keyPair,
            (progress, message) => {
                setDownloadProgress(progress);
                console.log(`[SharedFileList] ${message} (${progress}%)`);
            }
        );

        return new Blob([decryptedFile.data], { type: decryptedFile.mimeType });
    };

    const handleDownload = async (share: FileShare) => {
        if (!user || !keyPair) {
            alert("You must be logged in to download files");
            return;
        }

        try {
            setDownloadingId(share.id);
            setDownloadProgress(0);

            const blob = await decryptSharedFile(share);

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = share.fileName || `file_${share.id}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error("[SharedFileList] Download error:", err);
            alert(`Failed to download file: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setDownloadingId(null);
            setDownloadProgress(0);
        }
    };

    const handlePreview = async (file: any) => {
        const share = shareFiles.find(s => s.id === file.id);
        if (!share) return;

        try {
            setDownloadingId(share.id);
            const blob = await decryptSharedFile(share);
            setPreviewFile({
                name: share.fileName || `file_${share.id}`,
                mimeType: share.mimeType || 'application/octet-stream',
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
            <FileTable
                files={shareFiles.map(s => ({
                    id: s.id,
                    name: s.fileName || `Shared File ${s.id}`,
                    size: s.fileSize || 0,
                    uploadedAt: s.sharedAt,
                    uploadedBy: s.ownerEmail || s.sharedBy,
                    encrypted: true,
                    mimeType: s.mimeType || 'application/octet-stream',
                }))}
                loading={loading}
                error={error}
                showStats={true}
                showSearch={false}
                showUploadButton={false}
                canDelete={false}
                onDownload={(file: any) => {
                    const share = shareFiles.find(s => s.id === file.id);
                    if (share) handleDownload(share);
                }}
                onPreview={handlePreview}
                downloadingId={downloadingId}
                downloadProgress={downloadProgress}
            />

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
