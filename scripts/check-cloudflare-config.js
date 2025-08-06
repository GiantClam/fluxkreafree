#!/usr/bin/env node

/**
 * Cloudflare 配置检查脚本
 * 验证所有必需的环境变量是否正确设置
 */

const fs = require('fs');
const path = require('path');

// 必需的环境变量
const REQUIRED_VARS = {
  'Cloudflare KV': [
    'CLOUDFLARE_KV_NAMESPACE_ID',
    'CLOUDFLARE_KV_ACCOUNT_ID', 
    'CLOUDFLARE_KV_API_TOKEN'
  ],
  'Cloudflare R2': [
    'R2_ENDPOINT',
    'R2_ACCESS_KEY',
    'R2_SECRET_KEY',
    'R2_URL_BASE',
    'R2_BUCKET',
    'R2_ACCOUNT_ID'
  ],
  'Cloudflare AI Gateway': [
    'CLOUDFLARE_AI_GATEWAY_URL',
    'CLOUDFLARE_AI_GATEWAY_TOKEN'
  ],
  'AI 模型 API': [
    'REPLICATE_API_TOKEN',
    'GEMINI_API_KEY',
    'FLUX_AI_PROMPT'
  ]
};

// 可选的环境变量
const OPTIONAL_VARS = {
  '基础配置': [
    'NEXT_PUBLIC_SITE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL'
  ],
  '支付服务': [
    'STRIPE_API_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ],
  '其他服务': [
    'RESEND_API_KEY',
    'HASHID_SALT',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ]
};

function checkEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ 未找到 .env.local 文件');
    console.log('');
    console.log('📝 请按照以下步骤创建配置文件：');
    console.log('1. 复制 env.template 为 .env.local');
    console.log('2. 按照 CLOUDFLARE_QUICK_SETUP.md 指南填写配置');
    console.log('');
    return false;
  }

  console.log('✅ 找到 .env.local 文件');
  return true;
}

function loadEnvVars() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    
    return envVars;
  } catch (error) {
    console.log('❌ 读取 .env.local 文件失败:', error.message);
    return null;
  }
}

function checkRequiredVars(envVars) {
  console.log('\n🔍 检查必需的环境变量...\n');
  
  let allValid = true;
  
  Object.entries(REQUIRED_VARS).forEach(([category, vars]) => {
    console.log(`📂 ${category}:`);
    
    vars.forEach(varName => {
      const value = envVars[varName];
      
      if (!value || value === '') {
        console.log(`  ❌ ${varName}: 未设置`);
        allValid = false;
      } else if (value.includes('placeholder') || value.includes('你的')) {
        console.log(`  ⚠️  ${varName}: 包含占位符，需要替换为真实值`);
        allValid = false;
      } else {
        console.log(`  ✅ ${varName}: 已设置`);
      }
    });
    
    console.log('');
  });
  
  return allValid;
}

function checkOptionalVars(envVars) {
  console.log('🔍 检查可选的环境变量...\n');
  
  Object.entries(OPTIONAL_VARS).forEach(([category, vars]) => {
    console.log(`📂 ${category}:`);
    
    vars.forEach(varName => {
      const value = envVars[varName];
      
      if (!value || value === '') {
        console.log(`  ⚪ ${varName}: 未设置（可选）`);
      } else if (value.includes('placeholder') || value.includes('你的')) {
        console.log(`  ⚠️  ${varName}: 包含占位符`);
      } else {
        console.log(`  ✅ ${varName}: 已设置`);
      }
    });
    
    console.log('');
  });
}

function validateCloudflareConfig(envVars) {
  console.log('🌐 验证 Cloudflare 配置格式...\n');
  
  const validations = [
    {
      name: 'KV Namespace ID',
      key: 'CLOUDFLARE_KV_NAMESPACE_ID',
      validate: (value) => value && value.length >= 8 && !value.includes('placeholder')
    },
    {
      name: 'Account ID',
      key: 'CLOUDFLARE_KV_ACCOUNT_ID', 
      validate: (value) => value && value.length >= 16 && !value.includes('placeholder')
    },
    {
      name: 'KV API Token',
      key: 'CLOUDFLARE_KV_API_TOKEN',
      validate: (value) => value && value.startsWith('_') && value.length > 20
    },
    {
      name: 'R2 Endpoint',
      key: 'R2_ENDPOINT',
      validate: (value) => value && value.startsWith('https://') && value.includes('r2.cloudflarestorage.com')
    },
    {
      name: 'R2 Access Key',
      key: 'R2_ACCESS_KEY',
      validate: (value) => value && value.length >= 16 && !value.includes('placeholder')
    },
    {
      name: 'AI Gateway URL',
      key: 'CLOUDFLARE_AI_GATEWAY_URL',
      validate: (value) => value && value.startsWith('https://gateway.ai.cloudflare.com/')
    },
    {
      name: 'Replicate Token',
      key: 'REPLICATE_API_TOKEN',
      validate: (value) => value && value.startsWith('r8_')
    }
  ];
  
  let formatValid = true;
  
  validations.forEach(({ name, key, validate }) => {
    const value = envVars[key];
    if (value && validate(value)) {
      console.log(`  ✅ ${name}: 格式正确`);
    } else if (value) {
      console.log(`  ❌ ${name}: 格式可能有误`);
      formatValid = false;
    } else {
      console.log(`  ⚠️  ${name}: 未设置`);
      formatValid = false;
    }
  });
  
  return formatValid;
}

function printNextSteps(allValid, formatValid) {
  console.log('\n' + '='.repeat(50));
  
  if (allValid && formatValid) {
    console.log('🎉 配置检查通过！');
    console.log('');
    console.log('📝 下一步：');
    console.log('1. 运行 npm run build 验证配置');
    console.log('2. 运行 npm run dev 启动开发服务器');
    console.log('3. 部署到 Cloudflare Pages');
  } else {
    console.log('⚠️  配置需要完善');
    console.log('');
    console.log('📋 请完成以下任务：');
    
    if (!allValid) {
      console.log('- 设置所有必需的环境变量');
      console.log('- 替换所有占位符为真实值');
    }
    
    if (!formatValid) {
      console.log('- 检查并修正格式错误的配置');
    }
    
    console.log('');
    console.log('📖 参考资料：');
    console.log('- CLOUDFLARE_QUICK_SETUP.md - 详细设置指南');
    console.log('- env.template - 环境变量模板');
    console.log('- CLOUDFLARE_SETUP.md - 完整文档');
  }
  
  console.log('='.repeat(50));
}

function main() {
  console.log('🔧 Cloudflare 配置检查工具\n');
  
  // 检查 .env.local 文件是否存在
  if (!checkEnvFile()) {
    return;
  }
  
  // 加载环境变量
  const envVars = loadEnvVars();
  if (!envVars) {
    return;
  }
  
  // 检查必需变量
  const allValid = checkRequiredVars(envVars);
  
  // 检查可选变量
  checkOptionalVars(envVars);
  
  // 验证配置格式
  const formatValid = validateCloudflareConfig(envVars);
  
  // 显示下一步指导
  printNextSteps(allValid, formatValid);
}

main(); 