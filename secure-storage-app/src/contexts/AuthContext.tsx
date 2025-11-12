import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthState, LoginCredentials, RegisterCredentials } from '../types';
import type { AFGHKeyPair } from '../types/afgh';
import { apiService } from '../services/apiService';
import { afghService } from '../services/afghService';
import { afghStorageService } from '../services/afghStorageService';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateMasterKey: (password: string) => Promise<void>;
  keyPair: AFGHKeyPair | null;
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

  const [keyPair, setKeyPair] = useState<AFGHKeyPair | null>(null);

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
      console.log('[Auth] Login started for:', credentials.email);

      // 1. Authenticate with server
      const response = await apiService.login(credentials);
      console.log('[Auth] Server authentication successful');

      // 2. Initialize AFGH storage
      await afghStorageService.init();

      // 3. Derive password key with PBKDF2
      const salt = response.user.keyDerivationSalt
        ? afghStorageService['base64ToArray'](response.user.keyDerivationSalt)
        : undefined;

      const { key: passwordKey } = await afghStorageService.deriveKeyFromPassword(
        credentials.password,
        salt
      );
      console.log('[Auth] Password key derived');

      // 4. Load AFGH key pair from IndexedDB
      const storedKeyPair = await afghStorageService.getEncryptedKeyPair(credentials.email);

      if (!storedKeyPair) {
        throw new Error('AFGH key pair not found. Please contact support.');
      }

      // 5. Decrypt key pair
      const afghanKeyPair = await afghStorageService.decryptKeyPair(
        storedKeyPair.encryptedKeyPair,
        storedKeyPair.iv,
        passwordKey
      );
      console.log('[Auth] AFGH key pair loaded and decrypted');

      setAuthState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        masterKey: passwordKey,
      });

      setKeyPair(afghanKeyPair);

      console.log('[Auth] Login complete!');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      console.log('[Auth] Registration started for:', credentials.email);

      // 1. Initialize AFGH storage
      await afghStorageService.init();

      // 2. Derive password key with PBKDF2
      const { key: passwordKey, salt } = await afghStorageService.deriveKeyFromPassword(
        credentials.password
      );
      console.log('[Auth] Password key derived');

      // 3. Generate AFGH key pair (2 components)
      const afghanKeyPair = await afghService.generateKeyPair(credentials.email);
      console.log('[Auth] AFGH key pair generated');

      // 4. Encrypt and store key pair in IndexedDB
      const { encryptedKeyPair, iv } = await afghStorageService.encryptKeyPair(
        afghanKeyPair,
        passwordKey
      );

      await afghStorageService.storeEncryptedKeyPair(
        credentials.email,
        encryptedKeyPair,
        iv
      );
      console.log('[Auth] AFGH key pair encrypted and stored');

      // 5. Extract public key for server
      const publicKey = afghService.extractPublicKey(afghanKeyPair);
      const publicKeyData = {
        publicKey1: afghStorageService['arrayToBase64'](publicKey.publicKey1),
        publicKey2: afghStorageService['arrayToBase64'](publicKey.publicKey2),
      };

      // 6. Register with server
      const response = await apiService.register({
        ...credentials,
        publicKey: publicKeyData,
        keyDerivationSalt: afghStorageService['arrayToBase64'](salt),
      });
      console.log('[Auth] Server registration successful');

      setAuthState({
        user: { ...response.user, publicKey: publicKeyData },
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        masterKey: passwordKey,
      });

      setKeyPair(afghanKeyPair);

      console.log('[Auth] Registration complete!');
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
      setKeyPair(null);
    }
  };

  const updateMasterKey = async (password: string) => {
    const { key: passwordKey } = await afghStorageService.deriveKeyFromPassword(password);
    setAuthState((prev) => ({
      ...prev,
      masterKey: passwordKey,
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
        keyPair,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
