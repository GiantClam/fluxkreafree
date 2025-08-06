import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { unstable_setRequestLocale } from "next-intl/server";

import { authOptions } from "@/lib/auth";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "./signin-form";

type Props = {
  params: { locale: string };
};

export default async function SignInPage({ params: { locale } }: Props) {
  unstable_setRequestLocale(locale);
  
  const session = await getServerSession(authOptions);
  
  if (session) {
    redirect("/app");
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

 