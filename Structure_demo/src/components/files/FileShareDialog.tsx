import React, { useState } from 'react';
import { Alert } from '../ui';
import { X, Share2, Mail, Loader2, CheckCircle } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { cryptoService } from '../../services/cryptoService';
import { useAuth } from '../../contexts/AuthContext';

interface FileShareDialogProps {
  fileId: string;
  fileName: string;
  onClose: () => void;
  onShareComplete?: () => void;
}

export const FileShareDialog: React.FC<FileShareDialogProps> = ({
  fileId,
  fileName,
  onClose,
  onShareComplete
}) => {
  const { keyPair } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'processing' | 'success'>('input');
  const [statusMessage, setStatusMessage] = useState('');

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!keyPair) {
      setError("You must be logged in to share files.");
      return;
    }

    setLoading(true);
    setError(null);
    setStep('processing');

    try {
      // 1. Get Recipient's Public Key
      console.log('[FileShareDialog] Starting share process for email:', email);
      setStatusMessage("Fetching recipient's public key...");
      const recipientPublicKeyData = await apiService.getUserPublicKey(email);
      console.log('[FileShareDialog] Received recipient public key data:', recipientPublicKeyData);

      // Parse the public key (it might be a string or object depending on API)
      // For AFGH, we need the object { u1: ..., u2: ... }
      // The apiService.getUserPublicKey returns string | object. 
      // We need to ensure it's in the format cryptoService expects.

      let recipientPublicKey;
      if (typeof recipientPublicKeyData === 'string') {
        // If it's a string, it might be JSON stringified
        try {
          recipientPublicKey = JSON.parse(recipientPublicKeyData);
        } catch {
          throw new Error("Invalid public key format from server");
        }
      } else {
        recipientPublicKey = recipientPublicKeyData;
      }

      // Convert base64 strings back to Uint8Array for the crypto service
      // The cryptoService expects { u1: Uint8Array, u2: Uint8Array }
      // But the API returns { publicKey1: base64, publicKey2: base64 } or similar

      // Let's assume the API returns what we stored: { publicKey1: base64, publicKey2: base64 }
      // We need to map this to { u1: Uint8Array, u2: Uint8Array }

      if (!recipientPublicKey.publicKey1 || !recipientPublicKey.publicKey2) {
        throw new Error("Recipient has invalid public key structure");
      }

      console.log('[FileShareDialog] Converting recipient public key to Uint8Array');
      const pkB = {
        u1: cryptoService.base64ToUint8Array(recipientPublicKey.publicKey1),
        u2: cryptoService.base64ToUint8Array(recipientPublicKey.publicKey2)
      };
      console.log('[FileShareDialog] pkB.u1 length:', pkB.u1.length, 'pkB.u2 length:', pkB.u2.length);

      // 2. Generate Re-Encryption Key
      setStatusMessage("Generating re-encryption key...");
      // Wait a tick to allow UI to update
      await new Promise(r => setTimeout(r, 100));

      console.log('[FileShareDialog] Generating re-encryption key...');
      const rk = cryptoService.generateReEncryptionKey(keyPair.privateKey, pkB);
      console.log('[FileShareDialog] RK generated, rk.rk length:', rk.rk.length);

      // Serialize RK for transport
      // Use slice to get exact bytes without extra buffer padding
      console.log('[FileShareDialog] Serializing RK for transport...');
      console.log('[FileShareDialog] rk.rk.byteOffset:', rk.rk.byteOffset, 'rk.rk.byteLength:', rk.rk.byteLength);
      const rkSerialized = JSON.stringify({
        rk: cryptoService.arrayBufferToBase64(
          rk.rk.buffer.slice(rk.rk.byteOffset, rk.rk.byteOffset + rk.rk.byteLength) as ArrayBuffer
        )
      });
      console.log('[FileShareDialog] RK serialized, length:', rkSerialized.length);

      // 3. Send to Server
      setStatusMessage("Sending share request...");
      console.log('[FileShareDialog] Sending share request to server...');
      await apiService.shareFile(fileId, email, rkSerialized);
      console.log('[FileShareDialog] Share request completed successfully');

      setStep('success');
      if (onShareComplete) onShareComplete();

    } catch (err) {
      console.error("[FileShareDialog] Share error:", err);
      console.error("[FileShareDialog] Error stack:", err instanceof Error ? err.stack : 'No stack trace');
      setError(err instanceof Error ? err.message : "Failed to share file");
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transform transition-all">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary-600" />
            Share File
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-1">File to share:</p>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="p-2 bg-white rounded-md shadow-sm">
                <Share2 className="h-5 w-5 text-blue-600" />
              </div>
              <span className="font-medium text-gray-900 truncate">{fileName}</span>
            </div>
          </div>

          {step === 'success' ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Shared Successfully!</h3>
              <p className="text-gray-600 mb-6">
                The file has been securely shared with <strong>{email}</strong>.
              </p>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleShare} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                    placeholder="friend@example.com"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <Alert type="error" message={error} />
              )}

              {step === 'processing' && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {statusMessage}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md font-medium"
                >
                  {loading ? 'Processing...' : 'Share Securely'}
                </button>
                <p className="text-xs text-center text-gray-500 mt-3">
                  A re-encryption key will be generated. Your private key remains safe.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
