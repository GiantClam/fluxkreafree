/**
 * Cloudflare Workers 入口文件
 * 用于运行 Remove Anything 应用
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 设置环境变量
    env.DATABASE_URL = env.DB ? `file:./dev.db` : undefined;
    env.NEXTAUTH_URL = url.origin;
    env.NEXTAUTH_SECRET = env.NEXTAUTH_SECRET || 'your-nextauth-secret-placeholder';
    
    // 处理静态文件
    if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/static/')) {
      return handleStaticFiles(request, env);
    }
    
    // 处理 API 路由
    if (url.pathname.startsWith('/api/')) {
      return handleApiRoutes(request, env, ctx);
    }
    
    // 处理页面路由 - 代理到 Next.js 应用
    return handlePageRoutes(request, env, ctx);
  },
};

async function handleStaticFiles(request, env) {
  // 对于静态文件，返回 404，让 Cloudflare 处理
  return new Response('Static files not found', { status: 404 });
}

async function handleApiRoutes(request, env, ctx) {
  // 对于 API 路由，返回一个简单的响应
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 根据不同的 API 路由返回不同的响应
  switch (path) {
    case '/api/generate':
      return new Response(JSON.stringify({
        message: 'Background removal API endpoint',
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: {
          kv: !!env.KV,
          db: !!env.DB,
          r2: !!env.R2,
          ai: !!env.AI
        }
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
    case '/api/order':
      return new Response(JSON.stringify({
        message: 'Order API endpoint',
        status: 'ready',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
    default:
      return new Response(JSON.stringify({
        message: 'API route accessed',
        path: path,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
  }
}

async function handlePageRoutes(request, env, ctx) {
  // 由于 Next.js standalone 构建产物是 Node.js 服务器，不适合在 Cloudflare Workers 中直接运行
  // 我们返回一个重定向页面，指导用户如何正确访问应用
  
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 如果是根路径，返回一个信息页面
  if (path === '/' || path === '/en' || path === '/zh') {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Remove Anything - AI 背景去除工具</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #333;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.95);
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                text-align: center;
            }
            
            h1 {
                font-size: 2.5rem;
                margin-bottom: 1rem;
                background: linear-gradient(45deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            
            .subtitle {
                font-size: 1.2rem;
                color: #666;
                margin-bottom: 2rem;
            }
            
            .info-box {
                background: #f8f9fa;
                border-radius: 10px;
                padding: 2rem;
                margin: 2rem 0;
                text-align: left;
            }
            
            .info-box h3 {
                color: #667eea;
                margin-bottom: 1rem;
            }
            
            .info-box ul {
                list-style: none;
                padding: 0;
            }
            
            .info-box li {
                padding: 0.5rem 0;
                border-bottom: 1px solid #eee;
            }
            
            .info-box li:last-child {
                border-bottom: none;
            }
            
            .status {
                display: inline-block;
                padding: 0.25rem 0.75rem;
                border-radius: 20px;
                font-size: 0.875rem;
                font-weight: 600;
            }
            
            .status.connected {
                background: #e8f5e8;
                color: #28a745;
            }
            
            .status.not-available {
                background: #f8d7da;
                color: #dc3545;
            }
            
            .btn {
                display: inline-block;
                padding: 12px 24px;
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 0.5rem;
                transition: transform 0.3s ease;
            }
            
            .btn:hover {
                transform: translateY(-2px);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎨 Remove Anything</h1>
            <p class="subtitle">AI 背景去除工具 - 运行在 Cloudflare Workers 上</p>
            
            <div class="info-box">
                <h3>📋 当前状态</h3>
                <ul>
                    <li><strong>环境:</strong> ${env.ENVIRONMENT || 'production'}</li>
                    <li><strong>URL:</strong> ${url.href}</li>
                    <li><strong>路径:</strong> ${path}</li>
                </ul>
            </div>
            
            <div class="info-box">
                <h3>🔧 Cloudflare 服务状态</h3>
                <ul>
                    <li>
                        <strong>KV 存储:</strong> 
                        <span class="status ${env.KV ? 'connected' : 'not-available'}">
                            ${env.KV ? '✅ 已连接' : '❌ 不可用'}
                        </span>
                    </li>
                    <li>
                        <strong>D1 数据库:</strong> 
                        <span class="status ${env.DB ? 'connected' : 'not-available'}">
                            ${env.DB ? '✅ 已连接' : '❌ 不可用'}
                        </span>
                    </li>
                    <li>
                        <strong>R2 存储:</strong> 
                        <span class="status ${env.R2 ? 'connected' : 'not-available'}">
                            ${env.R2 ? '✅ 已连接' : '❌ 不可用'}
                        </span>
                    </li>
                    <li>
                        <strong>AI Gateway:</strong> 
                        <span class="status ${env.AI ? 'connected' : 'not-available'}">
                            ${env.AI ? '✅ 已连接' : '❌ 不可用'}
                        </span>
                    </li>
                </ul>
            </div>
            
            <div class="info-box">
                <h3>⚠️ 重要说明</h3>
                <p>这是一个 Cloudflare Workers 部署。Remove Anything 应用目前运行在简化模式下。要获得完整的 Next.js SSR 功能，你需要：</p>
                <ul>
                    <li>使用 <code>@cloudflare/next-on-pages</code> 生成正确的 Worker 代码</li>
                    <li>或部署到支持 Next.js standalone 构建的 Node.js 环境</li>
                    <li>或使用 Vercel 获得完整的 Next.js 兼容性</li>
                </ul>
            </div>
            
            <div>
                <a href="/api/generate" class="btn">测试 API</a>
                <a href="/api/order" class="btn">测试订单 API</a>
            </div>
        </div>
    </body>
    </html>
    `;
    
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
  
  // 对于其他路径，返回 404
  return new Response('Page not found', { status: 404 });
} 