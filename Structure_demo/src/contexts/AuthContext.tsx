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
import type { KeyPair } from "../services/cryptoService";
import { apiService } from "../services/apiService";
import { cryptoService } from "../services/cryptoService";
import { keyStorageService } from "../services/keyStorageService";

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateMasterKey: (password: string) => Promise<void>;
  keyPair: KeyPair | null;
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

  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);

  // Session Timeout Logic
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (authState.isAuthenticated) {
        timeoutId = setTimeout(() => {
          console.log("[Auth] Session timed out due to inactivity");
          logout();
        }, 15 * 60 * 1000); // 15 minutes
      }
    };

    const handleActivity = () => {
      resetTimer();
    };

    // Attach listeners
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    // Initial timer
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [authState.isAuthenticated]);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (token) {
          const user = await apiService.getCurrentUser();

          // Restore keyPair from sessionStorage if available
          const storedKeyPair = sessionStorage.getItem("sessionKeyPair");
          if (storedKeyPair) {
            try {
              const parsedKeyPair = JSON.parse(storedKeyPair);
              // Restore Uint8Arrays from arrays
              const restoredKeyPair: KeyPair = {
                email: user.email,
                privateKey: {
                  u1: BigInt(parsedKeyPair.privateKey.u1),
                  u2: BigInt(parsedKeyPair.privateKey.u2)
                },
                publicKey: {
                  u1: new Uint8Array(parsedKeyPair.publicKey.u1),
                  u2: new Uint8Array(parsedKeyPair.publicKey.u2)
                }
              };
              setKeyPair(restoredKeyPair);
              console.log("[Auth] KeyPair restored from session");
            } catch (e) {
              console.error("[Auth] Failed to restore keyPair:", e);
            }
          }

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
        sessionStorage.removeItem("sessionKeyPair");
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

      // 2. Initialize key storage
      await keyStorageService.init();

      // 3. Derive password key
      const salt = response.user.keyDerivationSalt
        ? keyStorageService.base64ToArray(response.user.keyDerivationSalt)
        : undefined;

      const { key: passwordKey } =
        await keyStorageService.deriveKeyFromPassword(
          credentials.password,
          salt
        );
      console.log("[Auth] Password key derived");

      // 4. Load key pair from storage (skip for admin users)
      let keyPair = null;
      const isAdminUser = response.user.role === 'admin';

      if (!isAdminUser) {
        keyPair = await keyStorageService.getKeyPair(
          credentials.email,
          passwordKey
        );

        if (!keyPair) {
          throw new Error("Key pair not found. Please contact support.");
        }
        console.log("[Auth] Key pair loaded");
      } else {
        console.log("[Auth] Admin user - skipping key pair (monitoring only)");
      }

      localStorage.setItem("authToken", response.token);
      localStorage.setItem("currentUser", JSON.stringify(response.user));

      // Serialize keyPair to sessionStorage for persistence during page reload
      if (keyPair) {
        const serializableKeyPair = {
          email: keyPair.email,
          privateKey: {
            u1: keyPair.privateKey.u1.toString(),
            u2: keyPair.privateKey.u2.toString()
          },
          publicKey: {
            u1: Array.from(keyPair.publicKey.u1),
            u2: Array.from(keyPair.publicKey.u2)
          }
        };
        sessionStorage.setItem("sessionKeyPair", JSON.stringify(serializableKeyPair));
      }

      setAuthState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        masterKey: passwordKey,
      });

      setKeyPair(keyPair);

      console.log("[Auth] Login complete!");
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      console.log("[Auth] Registration started for:", credentials.email);

      // 1. Initialize key storage
      await keyStorageService.init();

      // 2. Derive password key
      const { key: passwordKey, salt } =
        await keyStorageService.deriveKeyFromPassword(credentials.password);
      console.log("[Auth] Password key derived");

      // 3. Generate key pair
      const keyPair = await cryptoService.generateKeyPair(
        credentials.email
      );
      console.log("[Auth] Key pair generated");

      // 4. Store key pair with the same salt used for derivation
      await keyStorageService.storeKeyPairWithSalt(
        credentials.email,
        keyPair,
        passwordKey,
        salt
      );
      console.log("[Auth] Key pair encrypted and stored");

      // 5. Prepare public key data for server
      const publicKeyData = {
        publicKey1: keyStorageService.arrayToBase64(keyPair.publicKey.u1),
        publicKey2: keyStorageService.arrayToBase64(keyPair.publicKey.u2),
      };

      // 6. Register with server
      const response = await apiService.register({
        ...credentials,
        publicKey: publicKeyData,
        keyDerivationSalt: keyStorageService.arrayToBase64(salt),
      });
      console.log("[Auth] Server registration successful");

      localStorage.setItem("authToken", response.token);
      localStorage.setItem("currentUser", JSON.stringify({ ...response.user, publicKey: publicKeyData }));

      // Serialize keyPair to sessionStorage for persistence during page reload
      const serializableKeyPair = {
        email: keyPair.email,
        privateKey: {
          u1: keyPair.privateKey.u1.toString(),
          u2: keyPair.privateKey.u2.toString()
        },
        publicKey: {
          u1: Array.from(keyPair.publicKey.u1),
          u2: Array.from(keyPair.publicKey.u2)
        }
      };
      sessionStorage.setItem("sessionKeyPair", JSON.stringify(serializableKeyPair));

      setAuthState({
        user: { ...response.user, publicKey: publicKeyData },
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        masterKey: passwordKey,
      });

      setKeyPair(keyPair);

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
      // Clear sensitive data (including sessionStorage keyPair)
      sessionStorage.removeItem("sessionKeyPair");
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
    const { key: passwordKey } = await keyStorageService.deriveKeyFromPassword(
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
