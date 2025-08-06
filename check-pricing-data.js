#!/usr/bin/env node

/**
 * 检查定价产品数据的脚本
 */

// 加载环境变量
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPricingData() {
  console.log('🔍 检查定价产品数据...\n');

  try {
    // 检查所有定价产品
    const allProducts = await prisma.chargeProduct.findMany();
    console.log(`📊 数据库中共有 ${allProducts.length} 个定价产品`);
    
    if (allProducts.length === 0) {
      console.log('❌ 没有找到定价产品数据');
      console.log('\n💡 解决方案:');
      console.log('1. 需要在数据库中插入定价产品数据');
      console.log('2. 或者检查数据库连接是否正常');
      return;
    }

    // 按语言分组显示
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
        console.log(`    状态: ${product.state}`);
        console.log(`    消息: ${product.message || '无'}`);
      });
    });

    // 检查特定语言的产品
    const enProducts = await prisma.chargeProduct.findMany({
      where: { locale: 'en' }
    });
    
    const zhProducts = await prisma.chargeProduct.findMany({
      where: { locale: 'zh' }
    });

    console.log(`\n📈 统计信息:`);
    console.log(`  - 英文产品: ${enProducts.length} 个`);
    console.log(`  - 中文产品: ${zhProducts.length} 个`);

  } catch (error) {
    console.error('❌ 检查定价数据时出错:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行检查
checkPricingData(); 