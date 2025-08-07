import { type Metadata } from "next";
import { notFound } from "next/navigation";

import { unstable_setRequestLocale } from "next-intl/server";
import ReactMarkdown from "react-markdown";

import { Container } from "@/components/layout/container";
import { withRetry } from "@/lib/db-connection";

export async function generateStaticParams() {
  // 在standalone模式下，返回空数组，路由将在运行时动态处理
  return [];
}

async function getNewsletter(id: string) {
  try {
    const { prisma } = await import("@/lib/db-connection");
    const newsletter = await withRetry(async () => {
      return await prisma.newsletters.findFirst({
        where: {
          id: parseInt(id),
        },
      });
    });

    if (!newsletter || !newsletter.body) {
      notFound();
    }

    return newsletter;
  } catch (error) {
    console.error("❌ getNewsletter 数据库查询错误:", error);
    notFound();
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string; locale: string };
}) {
  const newsletter = await getNewsletter(params.id);
  unstable_setRequestLocale(params.locale);

  const imageUrlRegex = /!\[[^\]]*\]\((.*?)\)/;
  const match = newsletter.body?.match(imageUrlRegex);
  let imageUrl: string | undefined = undefined;

  if (match) {
    imageUrl = match[1];
  }

  return {
    title: newsletter.subject,
    description: newsletter.subject,
    openGraph: {
      images: imageUrl ? [{ url: imageUrl }] : undefined,
      title: newsletter.subject ?? "",
      description: newsletter.subject ?? "",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: newsletter.subject ?? "",
      description: newsletter.subject ?? "",
      images: imageUrl ? [{ url: imageUrl }] : undefined,
      site: "@koyaguo",
      creator: "@koyaguo",
    },
  } satisfies Metadata;
}

export default async function NewsletterRenderPage({
  params,
}: {
  params: { id: string };
}) {
  const newsletter = await getNewsletter(params.id);

  if (!newsletter.body) {
    return null;
  }

  return (
    <Container className="mt-16">
      <article className="prose mx-auto max-w-[500px] dark:prose-invert">
        <ReactMarkdown>{newsletter.body}</ReactMarkdown>
      </article>
    </Container>
  );
}

export const revalidate = 3600;
