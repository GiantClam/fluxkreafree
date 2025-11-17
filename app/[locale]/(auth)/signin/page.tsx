import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { unstable_setRequestLocale } from "next-intl/server";

import { authOptions } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth-utils";
import { env } from "@/env.mjs";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "./signin-form";

type Props = {
  params: { locale: string };
};

export default async function SignInPage({ params: { locale } }: Props) {
  unstable_setRequestLocale(locale);
  
  // 开发模式：如果启用了开发用户，自动登录并跳转
  const enableDevUser = env.ENABLE_DEV_USER === "true" || env.ENABLE_DEV_USER === "1";
  const isDevelopment = process.env.NODE_ENV === "development";
  
  if (enableDevUser && isDevelopment) {
    const user = await getCurrentUser();
    if (user) {
      console.log("🔧 开发模式：自动登录，跳转到应用页面");
      redirect(`/${locale}/app`);
    }
  }
  
  const session = await getServerSession(authOptions);
  
  if (session) {
    redirect(`/${locale}/app`);
  }

  return (
    <Container className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">欢迎回来</CardTitle>
          <CardDescription className="text-center">
            使用 Google 账户登录继续使用服务
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading...</div>}>
            <SignInForm />
          </Suspense>
        </CardContent>
      </Card>
    </Container>
  );
}

 