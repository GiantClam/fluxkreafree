import { redirect } from "next/navigation";
import { unstable_setRequestLocale } from "next-intl/server";

type Props = {
  params: { locale: string };
};

// 为静态导出生成参数
export function generateStaticParams() {
  return [
    { locale: 'en' },
    { locale: 'zh' },
    { locale: 'ja' },
    { locale: 'ko' },
    { locale: 'es' },
    { locale: 'fr' },
    { locale: 'de' },
    { locale: 'pt' },
    { locale: 'ar' },
    { locale: 'tw' },
  ];
}

export default function Page({ params: { locale } }: Props) {
  unstable_setRequestLocale(locale);
  
  // Redirect to our Google signin page
  redirect("/auth/signin");
}
