import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // This is optional because it's only used in development.
    // See https://next-auth.js.org/deployment.
    DATABASE_URL: z.string().min(1).default("file:./dev.db"),
    // DIRECT_URL 用于 Prisma 迁移，使用直接连接（非连接池）
    // 在 Supabase 中，使用端口 5432 的直接连接 URL
    DIRECT_URL: z.string().min(1).optional(),
    RESEND_API_KEY: z.string().min(1).default("re_placeholder"),
    HASHID_SALT: z.string().min(1).default("your-hashid-salt-here"),
    VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
    // Cloudflare KV Configuration
    CLOUDFLARE_KV_NAMESPACE_ID: z.string().min(1).default("placeholder"),
    CLOUDFLARE_KV_ACCOUNT_ID: z.string().min(1).default("placeholder"),
    CLOUDFLARE_KV_API_TOKEN: z.string().min(1).default("placeholder"),
    LINK_PREVIEW_API_BASE_URL: z.string().optional(),
    SITE_NOTIFICATION_EMAIL_TO: z.string().optional(),

    // Cloudflare R2 Storage Configuration
    R2_ENDPOINT: z.string().min(1).default("https://placeholder.com"),
    R2_REGION: z.string().min(1).default("auto"),
    R2_ACCESS_KEY: z.string().min(1).default("placeholder"),
    R2_SECRET_KEY: z.string().min(1).default("placeholder"),
    R2_URL_BASE: z.string().min(1).default("https://placeholder.com"),
    R2_BUCKET: z.string().min(1).default("placeholder"),
    R2_ACCOUNT_ID: z.string().min(1).default("placeholder"),

    STRIPE_API_KEY: z.string().min(1).default("sk_test_placeholder"),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).default("whsec_placeholder"),
    WEBHOOK_SECRET: z.string().min(1).default("webhook-secret-placeholder"),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    NEXTAUTH_SECRET: z.string().min(1).optional(),
    NEXTAUTH_URL: z.string().min(1).optional(),
    // 开发模式：启用匿名/默认用户（仅在开发环境中生效）
    ENABLE_DEV_USER: z.string().optional().default("false"),
    LOG_SNAG_TOKEN: z.string().min(1).default("log-snag-token-placeholder"),
    TASK_HEADER_KEY: z.string().min(1).default("task-header-key-placeholder"),
    FLUX_HEADER_KEY: z.string().min(1).default("flux-header-key-placeholder"),
    FLUX_CREATE_URL: z.string().min(1).default("https://placeholder.com/create"),
    APP_ENV: z
      .enum(["development", "production", "staging"])
      .default("development"),
    
    // Cloudflare AI Gateway Configuration
    CLOUDFLARE_AI_GATEWAY_URL: z.string().url().default("https://placeholder.com"),
    CLOUDFLARE_AI_GATEWAY_TOKEN: z.string().min(1).default("placeholder"),
    
    // Model API Keys (accessed via AI Gateway)
    REPLICATE_API_TOKEN: z.string().min(1).default("placeholder"),
    REPLICATE_WEBHOOK_SECRET: z.string().optional(),
    GEMINI_API_KEY: z.string().min(1).default("placeholder"),
    
    // RunningHub Configuration
    RUNNINGHUB_API_BASE_URL: z.string().url().default("https://www.runninghub.cn"),
    RUNNINGHUB_API_KEY: z.string().min(1).default("placeholder"),
    RUNNINGHUB_WEBHOOK_SECRET: z.string().optional(),
    RUNNINGHUB_SINGLE_ITEM_WORKFLOW_ID: z.string().min(1).default("1980526002948493313"),
    RUNNINGHUB_TOP_BOTTOM_WORKFLOW_ID: z.string().min(1).default("1978804072985825281"),
    RUNNINGHUB_NODE_USER_PHOTO: z.string().min(1).default("254"),
    RUNNINGHUB_NODE_TOP_CLOTHES: z.string().min(1).default("253"),
    RUNNINGHUB_NODE_BOTTOM_CLOTHES: z.string().min(1).default("300"),
    
    // Legacy OpenAI config (now replaced by Gemini via AI Gateway)
    OPEN_AI_API_ENDPOINT: z.string().url().optional(),
    OPEN_AI_API_KEY: z.string().optional(),
    FLUX_AI_PROMPT: z.string().min(1).default("placeholder"),
    GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.string().min(1).default("http://localhost:3000"),
    NEXT_PUBLIC_SITE_EMAIL_FROM: z.string().min(1).default("noreply@localhost"),
    NEXT_PUBLIC_SITE_LINK_PREVIEW_ENABLED: z
      .boolean()
      .optional()
      .default(false),

    NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PLAN_ID: z.string().min(1).default("price_placeholder_monthly"),
    NEXT_PUBLIC_STRIPE_PRO_YEARLY_PLAN_ID: z.string().min(1).default("price_placeholder_yearly"),
    NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PLAN_ID: z.string().min(1).default("price_placeholder_business_monthly"),
    NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PLAN_ID: z.string().min(1).default("price_placeholder_business_yearly"),

    NEXT_PUBLIC_UMAMI_DATA_ID: z.string().optional(),
    NEXT_PUBLIC_GA_ID: z.string().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",
    DIRECT_URL: process.env.DIRECT_URL,
    HASHID_SALT: process.env.HASHID_SALT || "your-hashid-salt-here",
    LOG_SNAG_TOKEN: process.env.LOG_SNAG_TOKEN || "log-snag-token-placeholder",
    RESEND_API_KEY: process.env.RESEND_API_KEY || "re_placeholder",
    VERCEL_ENV: process.env.VERCEL_ENV,
    // Cloudflare KV Configuration
    CLOUDFLARE_KV_NAMESPACE_ID: process.env.CLOUDFLARE_KV_NAMESPACE_ID,
    CLOUDFLARE_KV_ACCOUNT_ID: process.env.CLOUDFLARE_KV_ACCOUNT_ID,
    CLOUDFLARE_KV_API_TOKEN: process.env.CLOUDFLARE_KV_API_TOKEN,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    NEXT_PUBLIC_SITE_EMAIL_FROM: process.env.NEXT_PUBLIC_SITE_EMAIL_FROM || "noreply@localhost",
    NEXT_PUBLIC_SITE_LINK_PREVIEW_ENABLED:
      process.env.NEXT_PUBLIC_SITE_LINK_PREVIEW_ENABLED == "true",
    LINK_PREVIEW_API_BASE_URL: process.env.LINK_PREVIEW_API_BASE_URL,
    SITE_NOTIFICATION_EMAIL_TO: process.env.SITE_NOTIFICATION_EMAIL_TO,
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || "webhook-secret-placeholder",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_REGION: process.env.R2_REGION || "auto", // R2 使用 'auto' 作为 region
    R2_ACCESS_KEY: process.env.R2_ACCESS_KEY,
    R2_SECRET_KEY: process.env.R2_SECRET_KEY,
    R2_URL_BASE: process.env.R2_URL_BASE,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,

    STRIPE_API_KEY: process.env.STRIPE_API_KEY || "sk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "whsec_placeholder",
    NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PLAN_ID:
      process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PLAN_ID || "price_placeholder_monthly",
    NEXT_PUBLIC_STRIPE_PRO_YEARLY_PLAN_ID:
      process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PLAN_ID || "price_placeholder_yearly",
    NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PLAN_ID:
      process.env.NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PLAN_ID || "price_placeholder_business_monthly",
    NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PLAN_ID:
      process.env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PLAN_ID || "price_placeholder_business_yearly",
    TASK_HEADER_KEY: process.env.TASK_HEADER_KEY || "task-header-key-placeholder",
    FLUX_HEADER_KEY: process.env.FLUX_HEADER_KEY || "flux-header-key-placeholder",
    FLUX_CREATE_URL: process.env.FLUX_CREATE_URL || "https://placeholder.com/create",
    APP_ENV: process.env.APP_ENV,
    
    // Cloudflare AI Gateway Configuration
    CLOUDFLARE_AI_GATEWAY_URL: process.env.CLOUDFLARE_AI_GATEWAY_URL,
    CLOUDFLARE_AI_GATEWAY_TOKEN: process.env.CLOUDFLARE_AI_GATEWAY_TOKEN,
    
    // Model API Keys
    REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
    REPLICATE_WEBHOOK_SECRET: process.env.REPLICATE_WEBHOOK_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    
    // RunningHub Configuration
    RUNNINGHUB_API_BASE_URL: process.env.RUNNINGHUB_API_BASE_URL || "https://www.runninghub.cn",
    RUNNINGHUB_API_KEY: process.env.RUNNINGHUB_API_KEY,
    RUNNINGHUB_WEBHOOK_SECRET: process.env.RUNNINGHUB_WEBHOOK_SECRET,
    RUNNINGHUB_SINGLE_ITEM_WORKFLOW_ID: process.env.RUNNINGHUB_SINGLE_ITEM_WORKFLOW_ID || "1980526002948493313",
    RUNNINGHUB_TOP_BOTTOM_WORKFLOW_ID: process.env.RUNNINGHUB_TOP_BOTTOM_WORKFLOW_ID || "1978804072985825281",
    RUNNINGHUB_NODE_USER_PHOTO: process.env.RUNNINGHUB_NODE_USER_PHOTO || "254",
    RUNNINGHUB_NODE_TOP_CLOTHES: process.env.RUNNINGHUB_NODE_TOP_CLOTHES || "253",
    RUNNINGHUB_NODE_BOTTOM_CLOTHES: process.env.RUNNINGHUB_NODE_BOTTOM_CLOTHES || "300",
    ENABLE_DEV_USER: process.env.ENABLE_DEV_USER || "false",
    
    // Legacy OpenAI config
    OPEN_AI_API_ENDPOINT: process.env.OPEN_AI_API_ENDPOINT,
    OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY,
    FLUX_AI_PROMPT: process.env.FLUX_AI_PROMPT,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    NEXT_PUBLIC_UMAMI_DATA_ID: process.env.NEXT_PUBLIC_UMAMI_DATA_ID,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
  },
  skipValidation: process.env.NODE_ENV === 'development' || process.env.SKIP_ENV_VALIDATION === 'true', // 在开发环境或设置SKIP_ENV_VALIDATION时跳过环境变量验证
  emptyStringAsUndefined: true,
});
