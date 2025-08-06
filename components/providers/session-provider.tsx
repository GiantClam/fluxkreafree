"use client";

import { SessionProvider } from "next-auth/react";

interface ClientSessionProviderProps {
  children: React.ReactNode;
}

export function ClientSessionProvider({ children }: ClientSessionProviderProps) {
  return <SessionProvider>{children}</SessionProvider>;
} 