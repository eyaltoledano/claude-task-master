#!/usr/bin/env node

/**
 * 测试PRD范围管理MCP工具
 */

import http from 'http';

const MCP_BASE = 'http://localhost:3001';
const PROJECT_ID = 'test-scope-mcp';

// 测试用的PRD内容
const TEST_PRD_CONTENT = `# 任务管理系统PRD

## 项目概述
开发一个简单的任务管理系统，支持任务的创建、编辑、删除和状态管理。

## 功能需求

### 1. 任务管理
- 创建任务：用户可以创建新任务，包含标题、描述、优先级
- 编辑任务：用户可以修改任务信息
- 删除任务：用户可以删除不需要的任务
- 状态管理：支持待办、进行中、已完成三种状态

### 2. 任务列表
- 显示所有任务
- 按状态筛选任务
- 按优先级排序

### 3. 基本界面
- 简洁的Web界面
- 响应式设计

## 非功能需求
- 性能：支持1000个任务
- 可用性：99%在线时间
- 兼容性：支持主流浏览器

## 技术约束
- 使用Node.js后端
- 使用JSON文件存储
- 不需要用户认证系统
`;

/**
 * 发送MCP请求
 */
function makeMcpRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const mcpRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    };

    const postData = JSON.stringify(mcpRequest);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-PROJECT': PROJECT_ID,
        'X-USERNAME': 'test-user',
        'X-PASSWORD': 'test-pass'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            data: parsed,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: responseData,
            success: false,
            parseError: true
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * 测试步骤1: 初始化MCP连接
 */
async function testMcpInitialize() {
  console.log('\n🔌 步骤1: 初始化MCP连接');
  
  try {
    const result = await makeMcpRequest('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: 'scope-test-client',
        version: '1.0.0'
      }
    });
    
    if (result.success && result.data.result) {
      console.log('✅ MCP连接初始化成功');
      console.log(`   协议版本: ${result.data.result.protocolVersion}`);
      console.log(`   服务器: ${result.data.result.serverInfo.name}`);
      return true;
    } else {
      console.log('❌ MCP连接初始化失败:', result.data);
      return false;
    }
  } catch (error) {
    console.log('❌ MCP连接初始化失败:', error.message);
    return false;
  }
}

/**
 * 测试步骤2: 获取工具列表
 */
async function testListTools() {
  console.log('\n📋 步骤2: 获取MCP工具列表');
  
  try {
    const result = await makeMcpRequest('tools/list');
    
    if (result.success && result.data.result) {
      const tools = result.data.result.tools;
      console.log(`✅ 获取到 ${tools.length} 个MCP工具`);
      
      // 查找范围管理工具
      const scopeTools = tools.filter(tool => 
        tool.name.includes('scope') || 
        tool.name.includes('prd') || 
        tool.name.includes('change_request')
      );
      
      console.log(`   范围管理工具数量: ${scopeTools.length}`);
      scopeTools.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
      
      return scopeTools.length > 0;
    } else {
      console.log('❌ 获取工具列表失败:', result.data);
      return false;
    }
  } catch (error) {
    console.log('❌ 获取工具列表失败:', error.message);
    return false;
  }
}

/**
 * 测试步骤3: 上传PRD文件
 */
async function testUploadPrd() {
  console.log('\n📄 步骤3: 上传PRD文件');
  
  try {
    // 这里需要先通过REST API上传PRD文件
    const result = await makeHttpRequest('POST', `/api/projects/${PROJECT_ID}/prd/upload`, {
      filename: 'test-requirements.md',
      content: TEST_PRD_CONTENT
    });
    
    if (result.success) {
      console.log('✅ PRD文件上传成功');
      return true;
    } else {
      console.log('❌ PRD文件上传失败:', result.data);
      return false;
    }
  } catch (error) {
    console.log('❌ PRD文件上传失败:', error.message);
    return false;
  }
}

/**
 * 测试步骤4: 使用MCP工具分析PRD
 */
async function testAnalyzePrdScope() {
  console.log('\n🔍 步骤4: 使用MCP工具分析PRD');
  
  try {
    const result = await makeMcpRequest('tools/call', {
      name: 'analyze_prd_scope',
      arguments: {
        prdFilePath: 'test-requirements.md'
      }
    });
    
    if (result.success && result.data.result) {
      console.log('✅ PRD分析完成');
      const content = result.data.result.content[0].text;
      const analysisResult = JSON.parse(content);
      
      if (analysisResult.success) {
        console.log(`   需求总数: ${analysisResult.data.totalRequirements}`);
        console.log(`   核心需求: ${analysisResult.data.coreRequirements}`);
        console.log(`   扩展需求: ${analysisResult.data.extendedRequirements}`);
        return true;
      } else {
        console.log('❌ PRD分析失败:', analysisResult.message);
        return false;
      }
    } else {
      console.log('❌ PRD分析失败:', result.data);
      return false;
    }
  } catch (error) {
    console.log('❌ PRD分析失败:', error.message);
    return false;
  }
}

/**
 * 测试步骤5: 使用MCP工具检查任务范围
 */
async function testCheckTaskScope() {
  console.log('\n🎯 步骤5: 使用MCP工具检查任务范围');
  
  const testTasks = [
    {
      title: "实现任务创建功能",
      description: "开发任务创建的API和界面"
    },
    {
      title: "添加用户登录系统",
      description: "实现用户注册、登录和认证功能"
    }
  ];
  
  for (let i = 0; i < testTasks.length; i++) {
    const task = testTasks[i];
    console.log(`\n   测试任务 ${i + 1}: ${task.title}`);
    
    try {
      const result = await makeMcpRequest('tools/call', {
        name: 'check_task_scope',
        arguments: {
          task,
          operation: 'add'
        }
      });
      
      if (result.success && result.data.result) {
        const content = result.data.result.content[0].text;
        const scopeResult = JSON.parse(content);
        
        if (scopeResult.success) {
          const data = scopeResult.data;
          console.log(`   ✅ 范围检查完成`);
          console.log(`      在范围内: ${data.inScope ? '是' : '否'}`);
          console.log(`      置信度: ${(data.confidence * 100).toFixed(1)}%`);
          console.log(`      风险等级: ${data.riskLevel}`);
          console.log(`      判断理由: ${data.reasoning}`);
        } else {
          console.log(`   ❌ 范围检查失败:`, scopeResult.message);
        }
      } else {
        console.log(`   ❌ 范围检查失败:`, result.data);
      }
    } catch (error) {
      console.log(`   ❌ 范围检查失败:`, error.message);
    }
  }
}

/**
 * 测试步骤6: 使用MCP工具获取范围健康度
 */
async function testScopeHealth() {
  console.log('\n📊 步骤6: 使用MCP工具获取范围健康度');
  
  try {
    const result = await makeMcpRequest('tools/call', {
      name: 'get_scope_health',
      arguments: {
        includeDetails: false
      }
    });
    
    if (result.success && result.data.result) {
      console.log('✅ 范围健康度报告获取成功');
      const content = result.data.result.content[0].text;
      const healthResult = JSON.parse(content);
      
      if (healthResult.success) {
        const health = healthResult.data;
        console.log(`   有PRD基线: ${health.hasBaseline ? '是' : '否'}`);
        console.log(`   风险等级: ${health.riskLevel}`);
        console.log(`   待处理变更请求: ${health.changeRequests.pending}`);
        
        if (health.recommendations.length > 0) {
          console.log('   建议:');
          health.recommendations.forEach(rec => {
            console.log(`     - ${rec}`);
          });
        }
      } else {
        console.log('❌ 获取健康度报告失败:', healthResult.message);
      }
    } else {
      console.log('❌ 获取健康度报告失败:', result.data);
    }
  } catch (error) {
    console.log('❌ 获取健康度报告失败:', error.message);
  }
}

/**
 * 辅助函数：发送HTTP请求
 */
function makeHttpRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            data: parsed,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: responseData,
            success: false,
            parseError: true
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🧪 PRD范围管理MCP工具测试');
  console.log('================================');
  
  try {
    const initialized = await testMcpInitialize();
    if (!initialized) {
      console.log('\n❌ MCP初始化失败，无法继续测试');
      return;
    }
    
    const hasTools = await testListTools();
    if (!hasTools) {
      console.log('\n❌ 未找到范围管理工具，无法继续测试');
      return;
    }
    
    const prdUploaded = await testUploadPrd();
    if (!prdUploaded) {
      console.log('\n❌ PRD上传失败，无法继续测试');
      return;
    }
    
    const prdAnalyzed = await testAnalyzePrdScope();
    if (!prdAnalyzed) {
      console.log('\n❌ PRD分析失败，无法继续测试');
      return;
    }
    
    await testCheckTaskScope();
    await testScopeHealth();
    
    console.log('\n🎉 MCP工具测试完成！');
    console.log('\n📖 现在您可以在支持MCP的IDE中使用这些范围管理工具了');
    
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}
