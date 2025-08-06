"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/assets/icons/GoogleIcon";

export function SignInForm() {
  const handleSignIn = async () => {
    try {
      await signIn("google", { 
        callbackUrl: "/app",
        redirect: true 
      });
    } catch (error) {
      console.error("登录失败:", error);
    }
  };

  return (
    <Button 
      onClick={handleSignIn} 
      className="w-full" 
      size="lg"
    >
      <GoogleIcon className="mr-2 h-4 w-4" />
      使用 Google 登录
    </Button>
  );
} 