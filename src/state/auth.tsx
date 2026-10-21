import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as auth from '../services/google/auth';

interface AuthState {
  session: auth.Session | null;
  expired: boolean;
  gisReady: boolean;
  gisError: string | null;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(auth.getSession());
  const [expired, setExpired] = useState(auth.isExpired());
  const [gisReady, setGisReady] = useState(false);
  const [gisError, setGisError] = useState<string | null>(null);

  useEffect(() => {
    const off = auth.subscribe((s, e) => {
      setSession(s);
      setExpired(e);
    });
    auth
      .loadGis()
      .then(() => setGisReady(true))
      .catch((e: Error) => setGisError(e.message));
    return () => {
      off();
    };
  }, []);

  const signIn = useCallback(async () => {
    await auth.signIn();
  }, []);

  return (
    <AuthContext.Provider value={{ session, expired, gisReady, gisError, signIn, signOut: auth.signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
