#!/usr/bin/env node

/**
 * 测试配置读取的调试脚本
 */

import { getConfig, getMainProvider, getMainModelId } from '../scripts/modules/config-manager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== 配置调试信息 ===');
console.log('当前工作目录:', process.cwd());
console.log('脚本目录:', __dirname);

// 测试不同的项目根目录
const testRoots = [
    null, // 自动检测
    process.cwd(), // 当前目录
    __dirname, // 脚本目录
    path.join(process.cwd(), 'projects', 't') // 项目t的目录
];

for (const root of testRoots) {
    console.log(`\n--- 测试项目根目录: ${root || '自动检测'} ---`);
    
    try {
        const config = getConfig(root);
        console.log('配置读取成功:');
        console.log('- Main Provider:', getMainProvider(root));
        console.log('- Main Model:', getMainModelId(root));
        console.log('- 完整配置:', JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('配置读取失败:', error.message);
    }
}
