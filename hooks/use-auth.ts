"use client";

import { useSession } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    userId: session?.user?.id || null,
    user: session?.user || null,
    isLoaded: status !== "loading",
    isSignedIn: !!session?.user,
    signOut: () => {
      // This will be handled by NextAuth signOut
      return Promise.resolve();
    },
  };
} 