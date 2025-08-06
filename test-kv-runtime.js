#!/usr/bin/env node

/**
 * Cloudflare KV 运行时测试脚本
 * 在运行时环境中验证 KV 客户端是否能正常工作
 */

// 加载环境变量
require('dotenv').config({ path: '.env.local' });

async function testKVRuntime() {
  console.log('🧪 测试 Cloudflare KV 运行时配置...\n');

  // 设置运行时环境
  process.env.NODE_ENV = 'development';
  
  try {
    // 动态导入 KV 模块
    const { kv } = await import('./lib/kv.ts');
    
    console.log('✅ KV 客户端初始化成功');
    console.log('🔍 客户端类型:', kv.constructor.name);
    
    // 测试写入
    const testKey = 'test:kv:runtime';
    const testValue = { 
      message: 'Hello from Cloudflare KV Runtime!', 
      timestamp: new Date().toISOString(),
      test: true
    };
    
    console.log('📝 测试写入数据...');
    const setResult = await kv.set(testKey, testValue, { ex: 60 }); // 60秒过期
    console.log('✅ 数据写入成功:', setResult);
    
    // 测试读取
    console.log('📖 测试读取数据...');
    const retrievedValue = await kv.get(testKey);
    console.log('✅ 数据读取成功:', retrievedValue);
    
    // 验证数据完整性
    if (retrievedValue && retrievedValue.message === testValue.message) {
      console.log('✅ 数据完整性验证通过');
    } else {
      console.log('❌ 数据完整性验证失败');
    }
    
    // 测试删除
    console.log('🗑️ 测试删除数据...');
    const delResult = await kv.del(testKey);
    console.log('✅ 数据删除成功:', delResult);
    
    // 验证删除
    const deletedValue = await kv.get(testKey);
    if (deletedValue === null) {
      console.log('✅ 删除验证成功');
    } else {
      console.log('❌ 删除验证失败:', deletedValue);
    }
    
    console.log('\n🎉 Cloudflare KV 运行时测试通过！');
    console.log('📋 配置信息:');
    console.log(`   - Namespace ID: ${process.env.CLOUDFLARE_KV_NAMESPACE_ID}`);
    console.log(`   - Account ID: ${process.env.CLOUDFLARE_KV_ACCOUNT_ID}`);
    console.log(`   - API Token: ${process.env.CLOUDFLARE_KV_API_TOKEN ? '已设置' : '未设置'}`);
    console.log(`   - 环境: ${process.env.NODE_ENV}`);
    
  } catch (error) {
    console.error('❌ KV 运行时测试失败:', error.message);
    console.log('\n🔧 故障排除建议:');
    console.log('1. 检查 .env.local 文件中的环境变量是否正确设置');
    console.log('2. 确认 Cloudflare KV 命名空间是否存在');
    console.log('3. 验证 API Token 是否具有正确的权限');
    console.log('4. 检查网络连接是否正常');
    console.log('5. 确认 NODE_ENV 设置为 development');
    
    process.exit(1);
  }
}

// 运行测试
testKVRuntime(); 