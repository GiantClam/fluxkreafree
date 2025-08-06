// 支持的语言列表
export const supportedLocales = [
  'en',
  'zh', 
  'ja',
  'ko',
  'es',
  'fr',
  'de',
  'pt',
  'ar',
  'tw',
];

// 生成语言参数
export function generateLocaleParams() {
  return supportedLocales.map(locale => ({ locale }));
}

// 生成分页参数
export function generatePageParams() {
  return Array.from({ length: 10 }, (_, i) => ({ page: String(i + 1) }));
}

// 生成示例 slug 参数
export function generateSlugParams() {
  return [
    { slug: 'example-1' },
    { slug: 'example-2' },
    { slug: 'example-3' },
  ];
}

// 生成示例 token 参数
export function generateTokenParams() {
  return [
    { token: 'example-token-1' },
    { token: 'example-token-2' },
  ];
}

// 生成示例 id 参数
export function generateIdParams() {
  return [
    { id: '1' },
    { id: '2' },
    { id: '3' },
  ];
} 