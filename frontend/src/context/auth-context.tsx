 "use client";

 import { createContext, useContext, useEffect, useMemo, useState } from "react";

 import { fetchProfile } from "@/lib/api-client";
 import type { User } from "@/lib/types";

 type AuthContextValue = {
   token: string | null;
   user: User | null;
   loading: boolean;
   setSession: (token: string, profile: User) => void;
   logout: () => void;
   refreshProfile: () => Promise<User | null>;
 };

 const AuthContext = createContext<AuthContextValue>({
   token: null,
   user: null,
   loading: true,
   setSession: () => undefined,
   logout: () => undefined,
   refreshProfile: async () => null,
 });

 const STORAGE_KEY = "takeoff_ai_token";

 export function AuthProvider({ children }: { children: React.ReactNode }) {
   const [token, setToken] = useState<string | null>(null);
   const [user, setUser] = useState<User | null>(null);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
     if (typeof window === "undefined") return;
     const stored = window.localStorage.getItem(STORAGE_KEY);
     if (!stored) {
       setLoading(false);
       return;
     }
     setToken(stored);
     fetchProfile(stored)
       .then(setUser)
       .catch(() => {
         window.localStorage.removeItem(STORAGE_KEY);
         setToken(null);
       })
       .finally(() => setLoading(false));
   }, []);

   const setSession = (nextToken: string, profile: User) => {
     if (typeof window !== "undefined") {
       window.localStorage.setItem(STORAGE_KEY, nextToken);
     }
     setToken(nextToken);
     setUser(profile);
   };

   const logout = () => {
     if (typeof window !== "undefined") {
       window.localStorage.removeItem(STORAGE_KEY);
     }
     setToken(null);
     setUser(null);
   };

   const refreshProfile = async () => {
     if (!token) return null;
     const profile = await fetchProfile(token);
     setUser(profile);
     return profile;
   };

   const value = useMemo<AuthContextValue>(
     () => ({
       token,
       user,
       loading,
       setSession,
       logout,
       refreshProfile,
     }),
     [token, user, loading]
   );

   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
 }

 export function useAuth() {
   return useContext(AuthContext);
 }
