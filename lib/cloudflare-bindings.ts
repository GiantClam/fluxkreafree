/**
 * Cloudflare绑定辅助工具
 * 支持自动检测环境，并在Cloudflare Workers/Pages环境中使用绑定
 */

import { kv as localKv, createKVFromBinding } from './kv';

// 绑定类型定义
export interface CloudflareBindings {
  // KV绑定
  KV?: any;
  
  // R2绑定
  R2?: any;
  
  // D1数据库绑定
  DB?: any;
  
  // AI Gateway绑定
  AI?: any;
}

// 检测是否在Cloudflare Workers/Pages环境中运行
export function isCloudflareEnvironment(): boolean {
  return typeof (global as any).__CLOUDFLARE !== 'undefined' 
    || typeof (globalThis as any).caches !== 'undefined' && (globalThis as any).caches.default !== undefined;
}

// 获取带有绑定的KV客户端
export function getKVClient(bindings?: CloudflareBindings) {
  if (!bindings || !bindings.KV) {
    console.log('⚠️ 未检测到Cloudflare KV绑定，使用环境变量配置');
    return localKv;
  }
  
  console.log('🌐 使用Cloudflare Workers KV绑定');
  return createKVFromBinding(bindings.KV);
}

// 获取带有绑定的R2客户端
export function getR2Client(bindings?: CloudflareBindings) {
  if (!bindings || !bindings.R2) {
    console.log('⚠️ 未检测到Cloudflare R2绑定，使用环境变量配置');
    return null; // 这里可以实现一个类似KV的本地R2客户端
  }
  
  console.log('🌐 使用Cloudflare Workers R2绑定');
  return bindings.R2;
}

// 获取带有绑定的AI Gateway客户端
export function getAIGateway(bindings?: CloudflareBindings) {
  if (!bindings || !bindings.AI) {
    console.log('⚠️ 未检测到Cloudflare AI绑定，使用环境变量配置');
    return null; // 这里可以实现一个类似的本地AI客户端
  }
  
  console.log('🌐 使用Cloudflare Workers AI绑定');
  return bindings.AI;
}

// 创建统一的绑定管理器
export function createBindingsManager(bindings?: CloudflareBindings) {
  return {
    kv: getKVClient(bindings),
    r2: getR2Client(bindings),
    ai: getAIGateway(bindings),
    isCloudflare: isCloudflareEnvironment(),
    bindings
  };
} 