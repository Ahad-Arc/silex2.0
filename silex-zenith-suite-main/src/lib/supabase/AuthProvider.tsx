import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./client";

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  error: Error | null;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let isMounted = true;

    // Initial session check
    async function initSession() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw sessionError;
        }

        if (isMounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    }

    initSession();

    // Auth state listener setup
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, currentSession: Session | null) => {
        if (!isMounted) return;

        console.log(`[SILEX Auth Event] ${event}`);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);

        if (event === "SIGNED_OUT") {
          setUser(null);
          setSession(null);
        }
      },
    );

    // Clean up subscription on unmount to prevent memory leaks
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setIsLoading(false);
    }
  };

  const refreshSession = async (): Promise<Session | null> => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) {
      setError(refreshErr);
      return null;
    }
    setSession(data.session);
    setUser(data.session?.user ?? null);
    return data.session;
  };

  const value: AuthState = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user && !!session,
    accessToken: session?.access_token ?? null,
    error,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
