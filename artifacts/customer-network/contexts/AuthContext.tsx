import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

const TOKEN_KEY = "cn_customer_token";
const CUSTOMER_KEY = "cn_customer_info";

const storage = {
  getItem: (key: string) =>
    Platform.OS === "web"
      ? AsyncStorage.getItem(key)
      : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    Platform.OS === "web"
      ? AsyncStorage.setItem(key, value)
      : SecureStore.setItemAsync(key, value),
  deleteItem: (key: string) =>
    Platform.OS === "web"
      ? AsyncStorage.removeItem(key)
      : SecureStore.deleteItemAsync(key),
};

export interface MiniAppCustomerInfo {
  customerId: string;
  mobile: string;
  name?: string | null;
}

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  customer: MiniAppCustomerInfo | null;
  setSession: (token: string, customer: MiniAppCustomerInfo) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [customer, setCustomer] = useState<MiniAppCustomerInfo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedCustomer] = await Promise.all([
          storage.getItem(TOKEN_KEY),
          storage.getItem(CUSTOMER_KEY),
        ]);
        if (storedToken && storedCustomer) {
          setToken(storedToken);
          setCustomer(JSON.parse(storedCustomer) as MiniAppCustomerInfo);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setSession = useCallback(
    async (newToken: string, newCustomer: MiniAppCustomerInfo) => {
      await Promise.all([
        storage.setItem(TOKEN_KEY, newToken),
        storage.setItem(CUSTOMER_KEY, JSON.stringify(newCustomer)),
      ]);
      setToken(newToken);
      setCustomer(newCustomer);
    },
    [],
  );

  const logout = useCallback(async () => {
    await Promise.all([
      storage.deleteItem(TOKEN_KEY),
      storage.deleteItem(CUSTOMER_KEY),
    ]);
    setToken(null);
    setCustomer(null);
  }, []);

  const getToken = useCallback(async () => {
    return storage.getItem(TOKEN_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: !!token,
      token,
      customer,
      setSession,
      logout,
      getToken,
    }),
    [isLoading, token, customer, setSession, logout, getToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
