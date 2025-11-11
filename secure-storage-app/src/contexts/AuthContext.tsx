import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthState, LoginCredentials, RegisterCredentials } from '../types';
import { apiService } from '../services/apiService';
import { cryptoService } from '../services/cryptoService';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateMasterKey: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    masterKey: null,
  });

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          const user = await apiService.getCurrentUser();
          setAuthState((prev) => ({
            ...prev,
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          }));
        } else {
          setAuthState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        localStorage.removeItem('authToken');
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await apiService.login(credentials);

      // Derive master key from password
      const { key: masterKey } = await cryptoService.deriveKeyFromPassword(credentials.password);

      setAuthState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        masterKey,
      });

      // Store master key securely (in memory only for this session)
      // In a production app, consider using IndexedDB with additional security
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      const response = await apiService.register(credentials);

      // Derive master key from password
      const { key: masterKey } = await cryptoService.deriveKeyFromPassword(credentials.password);

      // Generate RSA key pair for secure sharing
      const keyPair = await cryptoService.generateKeyPair();
      const publicKeyExported = await cryptoService.exportPublicKey(keyPair.publicKey);

      // Store public key on server
      // In a real implementation, you'd send this to the server
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      currentUser.publicKey = publicKeyExported;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      // Store private key securely (encrypted with master key)
      // This is simplified - in production, use proper key storage
      const privateKeyExported = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
      const encryptedPrivateKey = await cryptoService.encryptData(privateKeyExported, masterKey);
      localStorage.setItem('encryptedPrivateKey', cryptoService.arrayBufferToBase64(encryptedPrivateKey.encryptedData));
      localStorage.setItem('privateKeyIV', cryptoService.uint8ArrayToBase64(encryptedPrivateKey.iv));

      setAuthState({
        user: { ...response.user, publicKey: publicKeyExported },
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        masterKey,
      });
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear sensitive data
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        masterKey: null,
      });
    }
  };

  const updateMasterKey = async (password: string) => {
    const { key: masterKey } = await cryptoService.deriveKeyFromPassword(password);
    setAuthState((prev) => ({
      ...prev,
      masterKey,
    }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        register,
        logout,
        updateMasterKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
