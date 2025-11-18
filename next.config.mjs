/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
// import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";
import { withSentryConfig } from "@sentry/nextjs";
import { withContentlayer } from "next-contentlayer2";
import withNextIntl from "next-intl/plugin";

import("./env.mjs");

const withNextIntlConfig = withNextIntl('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 为了在Cloudflare Workers上运行，使用standalone模式支持SSR和API路由
  output: 'standalone',
  // trailingSlash: true, // 注释掉，standalone模式不需要
  
  // 禁用API路由的静态生成，避免构建时数据库查询
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  
  // Use Cloudflare Functions instead of static export to support API routes
  // output: 'export', // Removed for NextAuth compatibility
  // trailingSlash: true, // Removed for NextAuth compatibility
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "meme-static.douni.one",
        port: "",
      },
      {
        protocol: "https",
        hostname: "no-person-static.douni.one",
        port: "",
      },
      {
        protocol: "https",
        hostname: "img.douni.one",
        port: "",
      },
    ],
  },
  
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  
  // Environment variable prefixes that should be available on the client side
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
  },

  experimental: {
    mdxRs: true,
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
    instrumentationHook: false, // Disable instrumentation hook to avoid development issues
  },

  redirects() {
    return [
      {
        source: "/twitter",
        destination: "https://x.com/koyaguo",
        permanent: true,
      },
      {
        source: "/x",
        destination: "https://x.com/koyaguo",
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/feed",
        destination: "/feed.xml",
      },
      {
        source: "/rss",
        destination: "/feed.xml",
      },
      {
        source: "/rss.xml",
        destination: "/feed.xml",
      },
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },

  // Cloudflare-specific optimizations
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  webpack: (config, { webpack, isServer }) => {
    // config.plugins.push(
    //   new webpack.IgnorePlugin({
    //     resourceRegExp: /^pg-native$|^cloudflare:sockets$|^onnxruntime-node$/,
    //   }),
    // );
    // config.plugins.push(
    //   new webpack.IgnorePlugin({
    //     resourceRegExp: /^onnxruntime-node$/,
    //     exclude: [/node:/],
    //   }),
    // );

    // 确保 modules 目录中的依赖能够正确解析到主项目的 node_modules
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
      },
      // 确保解析时优先查找主项目的 node_modules
      modules: [
        'node_modules', // 优先查找主项目的 node_modules
        ...(config.resolve?.modules || []).filter(m => m !== 'node_modules'),
      ],
      // 防止从 modules 子目录的 package.json 解析依赖
      symlinks: false,
    };

    // 忽略对 aws-sdk 的解析请求（因为代码已经使用 @aws-sdk/client-s3）
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^aws-sdk$/,
        contextRegExp: /modules/,
      })
    );

    // 如果 webpack 尝试解析 aws-sdk，重定向到 @aws-sdk/client-s3
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^aws-sdk$/,
        (resource) => {
          // 重定向到 AWS SDK v3
          resource.request = '@aws-sdk/client-s3';
        }
      )
    );

    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    return config;
  },
};

// if (process.env.NODE_ENV === "development") {
//   await setupDevPlatform();
// }

// 暂时禁用Sentry以避免Vercel部署警告
// export default withSentryConfig(withNextIntlConfig(withContentlayer(nextConfig)), {
//   org: "koya",
//   project: "fluxaiproart",
//   silent: !process.env.CI,
//   widenClientFileUpload: true,
//   hideSourceMaps: true,
//   disableLogger: true,
//   automaticVercelMonitors: true,
//   async headers() {
//     return [
//       {
//         source: '/(.*)',
//         headers: [
//           {
//             key: 'X-Frame-Options',
//             value: 'DENY',
//           },
//           {
//             key: 'X-Content-Type-Options',
//             value: 'nosniff',
//           },
//           {
//             key: 'Referrer-Policy',
//             value: 'strict-origin-when-cross-origin',
//           },
//         ],
//       },
//     ];
//   },
// });

export default withNextIntlConfig(withContentlayer(nextConfig));
