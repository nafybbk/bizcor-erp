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
// Last-used mobile/PIN on THIS device — separate from the session above so
// login.tsx can prefill the form, and so the offline PIN-unlock path (and a
// PIN change from the profile screen) can keep this cache in sync without
// depending on any other module's internals.
export const SAVED_MOBILE_KEY = "cn_saved_mobile";
export const SAVED_PIN_KEY = "cn_saved_pin";

export const credStore = {
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
  businessName?: string | null;
  showSupplierRealName?: boolean;
  avatarUrl?: string | null;
}

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  customer: MiniAppCustomerInfo | null;
  setSession: (token: string, customer: MiniAppCustomerInfo) => Promise<void>;
  updateCustomer: (customer: MiniAppCustomerInfo) => Promise<void>;
  // Re-hydrates in-memory state from whatever's already cached in
  // SecureStore, with zero network calls — the offline PIN-unlock path
  // (login.tsx) uses this once it's confirmed the entered PIN matches the
  // one cached from this device's last real login.
  restoreSession: () => Promise<boolean>;
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
          credStore.getItem(TOKEN_KEY),
          credStore.getItem(CUSTOMER_KEY),
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
        credStore.setItem(TOKEN_KEY, newToken),
        credStore.setItem(CUSTOMER_KEY, JSON.stringify(newCustomer)),
      ]);
      setToken(newToken);
      setCustomer(newCustomer);
    },
    [],
  );

  const updateCustomer = useCallback(async (newCustomer: MiniAppCustomerInfo) => {
    await credStore.setItem(CUSTOMER_KEY, JSON.stringify(newCustomer));
    setCustomer(newCustomer);
  }, []);

  // Deliberately does NOT wipe the cached token/customer from SecureStore —
  // the JWT is already a stateless 30-day token (server-side deletion would
  // achieve nothing extra), and keeping it cached is what lets the offline
  // PIN-unlock path on the login screen restore this exact session with zero
  // network calls. This is a "lock", not a server-side sign-out; only
  // logging into a DIFFERENT mobile number replaces the cached session.
  const logout = useCallback(async () => {
    setToken(null);
    setCustomer(null);
  }, []);

  const restoreSession = useCallback(async () => {
    const [storedToken, storedCustomer] = await Promise.all([
      credStore.getItem(TOKEN_KEY),
      credStore.getItem(CUSTOMER_KEY),
    ]);
    if (!storedToken || !storedCustomer) return false;
    setToken(storedToken);
    setCustomer(JSON.parse(storedCustomer) as MiniAppCustomerInfo);
    return true;
  }, []);

  const getToken = useCallback(async () => {
    return credStore.getItem(TOKEN_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: !!token,
      token,
      customer,
      setSession,
      updateCustomer,
      restoreSession,
      logout,
      getToken,
    }),
    [isLoading, token, customer, setSession, updateCustomer, restoreSession, logout, getToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Reads the last-cached customer info directly from storage, without going
// through the AuthContext provider — used by the login screen to show a
// name/avatar/code for whoever last used this device, even before a fresh
// session is restored/authenticated.
export async function getCachedCustomer(): Promise<MiniAppCustomerInfo | null> {
  const stored = await credStore.getItem(CUSTOMER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as MiniAppCustomerInfo;
  } catch {
    return null;
  }
}
