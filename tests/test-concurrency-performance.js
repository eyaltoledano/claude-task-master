#!/usr/bin/env node

/**
 * TaskMaster 并发性能测试脚本
 */

import http from 'http';
import { performance } from 'perf_hooks';

const API_BASE = 'http://localhost:3000';
const PROJECT_ID = 'test-project';

// 测试配置
const TEST_CONFIG = {
  readConcurrency: {
    name: '读操作并发测试',
    concurrent: 50,
    total: 500,
    endpoint: `/api/projects/${PROJECT_ID}/tasks`,
    method: 'GET'
  },
  writeConcurrency: {
    name: '写操作并发测试',
    concurrent: 10,
    total: 100,
    endpoint: `/api/projects/${PROJECT_ID}/tasks`,
    method: 'POST',
    data: {
      title: 'Test Task',
      description: 'Concurrency test task',
      priority: 'medium'
    }
  },
  mixedLoad: {
    name: '混合负载测试',
    concurrent: 20,
    total: 200,
    readRatio: 0.8 // 80%读操作，20%写操作
  }
};

/**
 * 发送HTTP请求
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        resolve({
          statusCode: res.statusCode,
          duration,
          success: res.statusCode >= 200 && res.statusCode < 300,
          data: responseData
        });
      });
    });
    
    req.on('error', (error) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      reject({
        error: error.message,
        duration,
        success: false
      });
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * 创建请求选项
 */
function createRequestOptions(endpoint, method = 'GET') {
  const url = new URL(API_BASE + endpoint);
  
  return {
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname + url.search,
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'TaskMaster-ConcurrencyTest/1.0'
    }
  };
}

/**
 * 并发测试执行器
 */
async function runConcurrencyTest(config) {
  console.log(`\n🚀 开始测试: ${config.name}`);
  console.log(`并发数: ${config.concurrent}, 总请求数: ${config.total}`);
  
  const results = [];
  const startTime = performance.now();
  
  // 创建请求批次
  const batches = [];
  for (let i = 0; i < config.total; i += config.concurrent) {
    const batchSize = Math.min(config.concurrent, config.total - i);
    batches.push(batchSize);
  }
  
  // 执行批次
  for (const batchSize of batches) {
    const promises = [];
    
    for (let j = 0; j < batchSize; j++) {
      const options = createRequestOptions(config.endpoint, config.method);
      const promise = makeRequest(options, config.data)
        .then(result => ({ ...result, type: 'success' }))
        .catch(error => ({ ...error, type: 'error' }));
      
      promises.push(promise);
    }
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    
    // 批次间短暂延迟
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  const endTime = performance.now();
  const totalDuration = endTime - startTime;
  
  // 分析结果
  const analysis = analyzeResults(results, totalDuration);
  printResults(config.name, analysis);
  
  return analysis;
}

/**
 * 混合负载测试
 */
async function runMixedLoadTest(config) {
  console.log(`\n🔄 开始测试: ${config.name}`);
  console.log(`并发数: ${config.concurrent}, 总请求数: ${config.total}`);
  console.log(`读写比例: ${(config.readRatio * 100).toFixed(0)}% 读, ${((1 - config.readRatio) * 100).toFixed(0)}% 写`);
  
  const results = [];
  const startTime = performance.now();
  
  const promises = [];
  
  for (let i = 0; i < config.total; i++) {
    const isRead = Math.random() < config.readRatio;
    
    let options, data, requestType;
    if (isRead) {
      options = createRequestOptions(`/api/projects/${PROJECT_ID}/tasks`, 'GET');
      data = null;
      requestType = 'read';
    } else {
      options = createRequestOptions(`/api/projects/${PROJECT_ID}/tasks`, 'POST');
      data = {
        title: `Test Task ${i}`,
        description: 'Mixed load test task',
        priority: 'medium'
      };
      requestType = 'write';
    }
    
    const promise = makeRequest(options, data)
      .then(result => ({ ...result, type: 'success', requestType }))
      .catch(error => ({ ...error, type: 'error', requestType }));
    
    promises.push(promise);
    
    // 控制并发数
    if (promises.length >= config.concurrent) {
      const batchResults = await Promise.all(promises.splice(0, config.concurrent));
      results.push(...batchResults);
      
      // 短暂延迟
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }
  
  // 处理剩余请求
  if (promises.length > 0) {
    const remainingResults = await Promise.all(promises);
    results.push(...remainingResults);
  }
  
  const endTime = performance.now();
  const totalDuration = endTime - startTime;
  
  // 分析结果
  const analysis = analyzeMixedResults(results, totalDuration);
  printMixedResults(config.name, analysis);
  
  return analysis;
}

/**
 * 分析测试结果
 */
function analyzeResults(results, totalDuration) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const durations = successful.map(r => r.duration);
  
  durations.sort((a, b) => a - b);
  
  return {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    successRate: (successful.length / results.length * 100).toFixed(2),
    totalDuration: totalDuration.toFixed(2),
    qps: (results.length / (totalDuration / 1000)).toFixed(2),
    avgResponseTime: durations.length > 0 ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2) : 0,
    minResponseTime: durations.length > 0 ? durations[0].toFixed(2) : 0,
    maxResponseTime: durations.length > 0 ? durations[durations.length - 1].toFixed(2) : 0,
    p50: durations.length > 0 ? durations[Math.floor(durations.length * 0.5)].toFixed(2) : 0,
    p95: durations.length > 0 ? durations[Math.floor(durations.length * 0.95)].toFixed(2) : 0,
    p99: durations.length > 0 ? durations[Math.floor(durations.length * 0.99)].toFixed(2) : 0
  };
}

/**
 * 分析混合负载结果
 */
function analyzeMixedResults(results, totalDuration) {
  const readResults = results.filter(r => r.requestType === 'read');
  const writeResults = results.filter(r => r.requestType === 'write');
  
  return {
    overall: analyzeResults(results, totalDuration),
    read: analyzeResults(readResults, totalDuration),
    write: analyzeResults(writeResults, totalDuration)
  };
}

/**
 * 打印测试结果
 */
function printResults(testName, analysis) {
  console.log(`\n📊 ${testName} - 测试结果:`);
  console.log(`总请求数: ${analysis.total}`);
  console.log(`成功请求: ${analysis.successful}`);
  console.log(`失败请求: ${analysis.failed}`);
  console.log(`成功率: ${analysis.successRate}%`);
  console.log(`总耗时: ${analysis.totalDuration}ms`);
  console.log(`QPS: ${analysis.qps}`);
  console.log(`平均响应时间: ${analysis.avgResponseTime}ms`);
  console.log(`最小响应时间: ${analysis.minResponseTime}ms`);
  console.log(`最大响应时间: ${analysis.maxResponseTime}ms`);
  console.log(`P50响应时间: ${analysis.p50}ms`);
  console.log(`P95响应时间: ${analysis.p95}ms`);
  console.log(`P99响应时间: ${analysis.p99}ms`);
}

/**
 * 打印混合负载结果
 */
function printMixedResults(testName, analysis) {
  console.log(`\n📊 ${testName} - 测试结果:`);
  
  console.log('\n整体性能:');
  printResults('', analysis.overall);
  
  console.log('\n读操作性能:');
  printResults('', analysis.read);
  
  console.log('\n写操作性能:');
  printResults('', analysis.write);
}

/**
 * 检查服务器状态
 */
async function checkServerHealth() {
  try {
    const options = createRequestOptions('/health', 'GET');
    const result = await makeRequest(options);
    
    if (result.success) {
      console.log('✅ 服务器健康检查通过');
      return true;
    } else {
      console.log('❌ 服务器健康检查失败');
      return false;
    }
  } catch (error) {
    console.log('❌ 无法连接到服务器:', error.message);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🧪 TaskMaster 并发性能测试');
  console.log('================================');
  
  // 检查服务器状态
  const isHealthy = await checkServerHealth();
  if (!isHealthy) {
    console.log('\n请确保TaskMaster服务器正在运行在 http://localhost:3000');
    process.exit(1);
  }
  
  const allResults = {};
  
  try {
    // 读操作并发测试
    allResults.read = await runConcurrencyTest(TEST_CONFIG.readConcurrency);
    
    // 等待一段时间
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 写操作并发测试
    allResults.write = await runConcurrencyTest(TEST_CONFIG.writeConcurrency);
    
    // 等待一段时间
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 混合负载测试
    allResults.mixed = await runMixedLoadTest(TEST_CONFIG.mixedLoad);
    
    // 总结报告
    console.log('\n📋 测试总结报告');
    console.log('================');
    console.log(`读操作QPS: ${allResults.read.qps}`);
    console.log(`写操作QPS: ${allResults.write.qps}`);
    console.log(`混合负载QPS: ${allResults.mixed.overall.qps}`);
    console.log(`读操作平均响应时间: ${allResults.read.avgResponseTime}ms`);
    console.log(`写操作平均响应时间: ${allResults.write.avgResponseTime}ms`);
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
