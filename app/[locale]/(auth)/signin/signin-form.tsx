"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/assets/icons/GoogleIcon";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function SignInForm() {
  // 检查是否是开发模式
  // 注意：客户端组件无法直接访问服务器端环境变量
  // 开发模式下，登录页面会自动跳转，所以这里主要显示提示信息
  const isDevelopment = process.env.NODE_ENV === "development";

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

  // 开发模式下显示提示（如果设置了 ENABLE_DEV_USER，页面会自动跳转，这里作为备用）
  if (isDevelopment) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            🔧 开发模式：如果已设置 ENABLE_DEV_USER=true，系统会自动使用默认开发用户并跳转。
            如果页面没有自动跳转，请检查 .env.local 中的 ENABLE_DEV_USER 设置。
          </AlertDescription>
        </Alert>
        <Button 
          onClick={() => window.location.href = "/app"} 
          className="w-full" 
          size="lg"
        >
          直接访问应用（开发模式）
        </Button>
      </div>
    );
  }

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