import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma";

export async function GET() {
  try {
    console.log("🔍 测试数据库连接");
    console.log("🔍 环境检查:", {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      DATABASE_URL: !!process.env.DATABASE_URL,
      POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
      prismaType: prisma.constructor.name
    });
    
    // 测试简单查询
    const fluxDataCount = await prisma.fluxData.count();
    const userCount = await prisma.user.count();
    
    console.log("✅ 数据库连接成功");
    
    return NextResponse.json({
      success: true,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        hasDatabaseURL: !!process.env.DATABASE_URL,
        hasPostgresURL: !!process.env.POSTGRES_URL_NON_POOLING
      },
      prisma: {
        type: prisma.constructor.name,
        isMock: prisma.constructor.name === 'Object'
      },
      database: {
        fluxDataCount,
        userCount
      }
    });
  } catch (error) {
    console.error("❌ 数据库连接错误:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return NextResponse.json({
      success: false,
      error: {
        message: error.message,
        name: error.name,
        type: error.constructor.name
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        hasDatabaseURL: !!process.env.DATABASE_URL,
        hasPostgresURL: !!process.env.POSTGRES_URL_NON_POOLING
      },
      prisma: {
        type: prisma.constructor.name,
        isMock: prisma.constructor.name === 'Object'
      }
    }, { status: 500 });
  }
} 