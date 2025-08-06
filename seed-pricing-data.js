#!/usr/bin/env node

/**
 * 插入示例定价产品数据的脚本
 */

// 加载环境变量
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const pricingProducts = [
  // 英文产品
  {
    amount: 990,
    originalAmount: 1990,
    credit: 100,
    currency: 'USD',
    locale: 'en',
    title: 'Starter',
    tag: 'Popular',
    message: '100 credits,Basic models,Standard support',
    state: 'active'
  },
  {
    amount: 1990,
    originalAmount: 3990,
    credit: 250,
    currency: 'USD',
    locale: 'en',
    title: 'Pro',
    tag: 'Best Value',
    message: '250 credits,All models,Priority support,Commercial license',
    state: 'active'
  },
  {
    amount: 4990,
    originalAmount: 9990,
    credit: 750,
    currency: 'USD',
    locale: 'en',
    title: 'Business',
    tag: 'Enterprise',
    message: '750 credits,All models,Priority support,Commercial license,API access',
    state: 'active'
  },
  
  // 中文产品
  {
    amount: 990,
    originalAmount: 1990,
    credit: 100,
    currency: 'USD',
    locale: 'zh',
    title: '入门版',
    tag: '热门',
    message: '100积分,基础模型,标准支持',
    state: 'active'
  },
  {
    amount: 1990,
    originalAmount: 3990,
    credit: 250,
    currency: 'USD',
    locale: 'zh',
    title: '专业版',
    tag: '超值',
    message: '250积分,所有模型,优先支持,商业许可',
    state: 'active'
  },
  {
    amount: 4990,
    originalAmount: 9990,
    credit: 750,
    currency: 'USD',
    locale: 'zh',
    title: '企业版',
    tag: '企业级',
    message: '750积分,所有模型,优先支持,商业许可,API访问',
    state: 'active'
  }
];

async function seedPricingData() {
  console.log('🌱 开始插入定价产品数据...\n');

  try {
    // 清空现有数据
    console.log('🗑️ 清空现有定价产品数据...');
    await prisma.chargeProduct.deleteMany();
    console.log('✅ 现有数据已清空');

    // 插入新数据
    console.log('📝 插入新的定价产品数据...');
    const createdProducts = await prisma.chargeProduct.createMany({
      data: pricingProducts
    });

    console.log(`✅ 成功插入 ${createdProducts.count} 个定价产品`);

    // 验证插入的数据
    console.log('\n🔍 验证插入的数据...');
    const allProducts = await prisma.chargeProduct.findMany();
    
    const productsByLocale = {};
    allProducts.forEach(product => {
      if (!productsByLocale[product.locale]) {
        productsByLocale[product.locale] = [];
      }
      productsByLocale[product.locale].push(product);
    });

    Object.entries(productsByLocale).forEach(([locale, products]) => {
      console.log(`\n🌐 ${locale} 语言的产品:`);
      products.forEach(product => {
        console.log(`  - ${product.title}: $${product.amount} (${product.credit} credits)`);
        console.log(`    标签: ${product.tag || '无'}`);
        console.log(`    状态: ${product.state}`);
      });
    });

    console.log('\n🎉 定价产品数据插入完成！');
    console.log('💡 现在可以访问定价页面查看产品信息了');

  } catch (error) {
    console.error('❌ 插入定价数据时出错:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行数据插入
seedPricingData(); 