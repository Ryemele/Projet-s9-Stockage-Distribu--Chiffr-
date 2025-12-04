/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type {
  AuthState,
  LoginCredentials,
  RegisterCredentials,
} from "../types";
import type { MockKeyPair } from "../services/mockCryptoService";
import { apiService } from "../services/apiService";
import { mockCryptoService } from "../services/mockCryptoService";
import { mockStorageService } from "../services/mockStorageService";

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateMasterKey: (password: string) => Promise<void>;
  keyPair: MockKeyPair | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
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

  const [keyPair, setKeyPair] = useState<MockKeyPair | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem("authToken");
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
        console.error("Auth initialization error:", error);
        localStorage.removeItem("authToken");
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      console.log("[Auth] Login started for:", credentials.email);

      // 1. Authenticate with server
      const response = await apiService.login(credentials);
      console.log("[Auth] Server authentication successful");

      // 2. Initialize mock storage
      await mockStorageService.init();

      // 3. Derive password key
      const salt = response.user.keyDerivationSalt
        ? mockStorageService.base64ToArray(response.user.keyDerivationSalt)
        : undefined;

      const { key: passwordKey } =
        await mockStorageService.deriveKeyFromPassword(
          credentials.password,
          salt
        );
      console.log("[Auth] Password key derived");

      // 4. Load mock key pair from storage
      const mockKeyPair = await mockStorageService.getKeyPair(
        credentials.email,
        passwordKey
      );

      if (!mockKeyPair) {
        throw new Error("Key pair not found. Please contact support.");
      }

      console.log("[Auth] Key pair loaded");

      setAuthState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        masterKey: passwordKey,
      });

      setKeyPair(mockKeyPair);

      console.log("[Auth] Login complete!");
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      console.log("[Auth] Registration started for:", credentials.email);

      // 1. Initialize mock storage
      await mockStorageService.init();

      // 2. Derive password key
      const { key: passwordKey, salt } =
        await mockStorageService.deriveKeyFromPassword(credentials.password);
      console.log("[Auth] Password key derived");

      // 3. Generate mock key pair
      const mockKeyPair = await mockCryptoService.generateKeyPair(
        credentials.email
      );
      console.log("[Auth] Mock key pair generated");

      // 4. Store key pair
      await mockStorageService.storeKeyPair(
        credentials.email,
        mockKeyPair,
        passwordKey
      );
      console.log("[Auth] Key pair stored");

      // 5. Prepare public key data for server
      const publicKeyData = {
        publicKey1: mockKeyPair.publicKey,
        publicKey2: mockKeyPair.publicKey, // Simplified for mock
      };

      // 6. Register with server
      const response = await apiService.register({
        ...credentials,
        publicKey: publicKeyData,
        keyDerivationSalt: mockStorageService.arrayToBase64(salt),
      });
      console.log("[Auth] Server registration successful");

      setAuthState({
        user: { ...response.user, publicKey: publicKeyData },
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        masterKey: passwordKey,
      });

      setKeyPair(mockKeyPair);

      console.log("[Auth] Registration complete!");
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error("Logout error:", error);
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
    const { key: passwordKey } = await mockStorageService.deriveKeyFromPassword(
      password
    );
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
