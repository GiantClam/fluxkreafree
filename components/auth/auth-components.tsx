"use client";

import { ReactNode } from "react";
import { signIn } from "next-auth/react";
import { useAuth } from "@/hooks/use-auth";

interface AuthComponentProps {
  children: ReactNode;
}

export function SignedIn({ children }: AuthComponentProps) {
  const { isSignedIn } = useAuth();
  
  if (!isSignedIn) return null;
  
  return <>{children}</>;
}

export function SignedOut({ children }: AuthComponentProps) {
  const { isSignedIn } = useAuth();
  
  if (isSignedIn) return null;
  
  return <>{children}</>;
}

interface SignInButtonProps {
  children: ReactNode;
  mode?: "modal" | "redirect";
  forceRedirectUrl?: string;
}

export function SignInButton({ children, mode, forceRedirectUrl }: SignInButtonProps) {
  const handleClick = () => {
    signIn("google", { 
      callbackUrl: forceRedirectUrl || window.location.href 
    });
  };

  return (
    <div onClick={handleClick} style={{ cursor: "pointer" }}>
      {children}
    </div>
  );
} 