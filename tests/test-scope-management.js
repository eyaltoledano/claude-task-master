#!/usr/bin/env node

/**
 * PRD范围管理功能测试脚本
 */

import http from 'http';

const API_BASE = 'http://localhost:3000';
const PROJECT_ID = 'test-scope-project';

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

// 测试任务数据
const TEST_TASKS = [
  {
    title: "实现任务创建功能",
    description: "开发任务创建的API和界面",
    details: "包含表单验证和数据存储"
  },
  {
    title: "添加用户登录系统", // 这个应该超出范围
    description: "实现用户注册、登录和认证",
    details: "包含JWT token和密码加密"
  },
  {
    title: "优化任务列表性能",
    description: "提升任务列表的加载速度",
    details: "添加分页和缓存机制"
  }
];

/**
 * 发送HTTP请求
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ScopeManagement-Test/1.0'
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
 * 测试步骤1: 创建项目
 */
async function createProject() {
  console.log('\n📁 步骤1: 创建测试项目');
  
  try {
    const result = await makeRequest('POST', '/api/projects', {
      name: PROJECT_ID,
      description: '范围管理测试项目'
    });
    
    if (result.success) {
      console.log('✅ 项目创建成功');
    } else {
      console.log('ℹ️ 项目可能已存在，继续测试');
    }
  } catch (error) {
    console.log('ℹ️ 项目创建失败，可能已存在，继续测试');
  }
}

/**
 * 测试步骤2: 上传PRD文档
 */
async function uploadPRD() {
  console.log('\n📄 步骤2: 上传PRD文档');
  
  try {
    const result = await makeRequest('POST', `/api/projects/${PROJECT_ID}/prd/upload`, {
      filename: 'test-requirements.md',
      content: TEST_PRD_CONTENT
    });
    
    if (result.success) {
      console.log('✅ PRD文档上传成功');
      return true;
    } else {
      console.log('❌ PRD文档上传失败:', result.data);
      return false;
    }
  } catch (error) {
    console.log('❌ PRD文档上传失败:', error.message);
    return false;
  }
}

/**
 * 测试步骤3: 分析PRD建立基线
 */
async function analyzePRD() {
  console.log('\n🔍 步骤3: 分析PRD建立需求基线');
  
  try {
    const result = await makeRequest('POST', `/api/projects/${PROJECT_ID}/scope/analyze-prd`, {
      prdFilePath: 'test-requirements.md'
    });
    
    if (result.success) {
      console.log('✅ PRD分析完成');
      console.log(`   需求总数: ${result.data.metadata.totalRequirements}`);
      console.log(`   核心需求: ${result.data.metadata.coreRequirements}`);
      console.log(`   扩展需求: ${result.data.metadata.extendedRequirements}`);
      return true;
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
 * 测试步骤4: 测试任务范围检查
 */
async function testTaskScopeCheck() {
  console.log('\n🎯 步骤4: 测试任务范围检查');
  
  for (let i = 0; i < TEST_TASKS.length; i++) {
    const task = TEST_TASKS[i];
    console.log(`\n   测试任务 ${i + 1}: ${task.title}`);
    
    try {
      const result = await makeRequest('POST', `/api/projects/${PROJECT_ID}/scope/check-task-scope`, {
        task,
        operation: 'add'
      });
      
      if (result.success) {
        const scope = result.data;
        console.log(`   ✅ 范围检查完成`);
        console.log(`      在范围内: ${scope.inScope ? '是' : '否'}`);
        console.log(`      置信度: ${(scope.confidence * 100).toFixed(1)}%`);
        console.log(`      风险等级: ${scope.riskLevel}`);
        console.log(`      判断理由: ${scope.reasoning}`);
        
        if (!scope.inScope) {
          console.log(`   ⚠️ 该任务超出PRD范围，建议创建变更请求`);
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
 * 测试步骤5: 添加任务并触发自动范围检查
 */
async function testAutoScopeCheck() {
  console.log('\n🤖 步骤5: 测试自动范围检查（添加任务）');
  
  // 添加一个可能超出范围的任务
  const outOfScopeTask = TEST_TASKS[1]; // 用户登录系统
  
  try {
    const result = await makeRequest('POST', `/api/projects/${PROJECT_ID}/tasks`, outOfScopeTask);
    
    console.log(`   添加任务: ${outOfScopeTask.title}`);
    
    if (result.success) {
      console.log('   ✅ 任务添加成功');
      
      // 检查是否有范围检查警告
      if (result.data.warnings && result.data.warnings.length > 0) {
        console.log('   ⚠️ 范围检查警告:');
        result.data.warnings.forEach(warning => {
          console.log(`      - ${warning.message}`);
          if (warning.changeRequestId) {
            console.log(`      - 自动创建变更请求: ${warning.changeRequestId}`);
          }
        });
      }

      // 检查任务是否被增强了范围数据
      if (result.data.tasks && result.data.tasks.length > 0) {
        const task = result.data.tasks[0];
        if (task._scopeExtension) {
          console.log('   ✅ 任务数据已增强，包含范围信息');
        }
      }
    } else {
      console.log('   ❌ 任务添加失败:', result.data);
    }
  } catch (error) {
    console.log('   ❌ 任务添加失败:', error.message);
  }
}

/**
 * 测试步骤6: 查看变更请求
 */
async function testChangeRequests() {
  console.log('\n📋 步骤6: 查看变更请求');
  
  try {
    const result = await makeRequest('GET', `/api/projects/${PROJECT_ID}/scope/change-requests`);
    
    if (result.success) {
      const crs = result.data;
      console.log(`   ✅ 找到 ${crs.length} 个变更请求`);
      
      crs.forEach((cr, index) => {
        console.log(`\n   变更请求 ${index + 1}:`);
        console.log(`      ID: ${cr.id}`);
        console.log(`      标题: ${cr.title}`);
        console.log(`      类型: ${cr.type}`);
        console.log(`      状态: ${cr.status}`);
        console.log(`      优先级: ${cr.priority}`);
        console.log(`      创建时间: ${cr.requestedAt}`);
        console.log(`      理由: ${cr.reason}`);
      });
    } else {
      console.log('   ❌ 获取变更请求失败:', result.data);
    }
  } catch (error) {
    console.log('   ❌ 获取变更请求失败:', error.message);
  }
}

/**
 * 测试步骤7: 测试任务自动关联功能
 */
async function testAutoAssociation() {
  console.log('\n🔗 步骤7: 测试任务自动关联PRD需求');

  try {
    const result = await makeRequest('POST', `/api/projects/${PROJECT_ID}/scope/auto-associate-tasks`);

    if (result.success) {
      const data = result.data;
      console.log('   ✅ 自动关联完成');
      console.log(`      总任务数: ${data.totalTasks}`);
      console.log(`      已关联任务: ${data.associatedTasks}`);
      console.log(`      关联率: ${((data.associatedTasks / data.totalTasks) * 100).toFixed(1)}%`);
    } else {
      console.log('   ❌ 自动关联失败:', result.data);
    }
  } catch (error) {
    console.log('   ❌ 自动关联失败:', error.message);
  }
}

/**
 * 测试步骤8: 查看任务范围报告
 */
async function testTaskScopeReport() {
  console.log('\n📊 步骤8: 查看任务范围报告');

  try {
    const result = await makeRequest('GET', `/api/projects/${PROJECT_ID}/scope/task-scope-report`);

    if (result.success) {
      const report = result.data;
      console.log('   ✅ 任务范围报告:');
      console.log(`      总任务数: ${report.summary.totalTasks}`);
      console.log(`      范围合规性: ${report.summary.scopeCompliance}%`);
      console.log(`      有需求关联的任务: ${report.summary.tasksWithRequirements}`);
      console.log(`      已进行范围检查的任务: ${report.summary.tasksWithScopeCheck}`);

      if (report.requirementsCoverage) {
        console.log(`      PRD需求覆盖度: ${report.requirementsCoverage.coverage_percentage}%`);
      }

      if (report.recommendations.length > 0) {
        console.log('      改进建议:');
        report.recommendations.forEach(rec => {
          console.log(`        - [${rec.priority}] ${rec.message}`);
        });
      }
    } else {
      console.log('   ❌ 获取任务范围报告失败:', result.data);
    }
  } catch (error) {
    console.log('   ❌ 获取任务范围报告失败:', error.message);
  }
}

/**
 * 测试步骤9: 查看项目范围健康度
 */
async function testScopeHealth() {
  console.log('\n📊 步骤9: 查看项目范围健康度');
  
  try {
    const result = await makeRequest('GET', `/api/projects/${PROJECT_ID}/scope/scope-health`);
    
    if (result.success) {
      const health = result.data;
      console.log('   ✅ 范围健康度报告:');
      console.log(`      有PRD基线: ${health.health.hasBaseline ? '是' : '否'}`);
      console.log(`      变更趋势: ${health.health.changeRequestTrend}`);
      console.log(`      风险等级: ${health.health.riskLevel}`);
      
      if (health.health.recommendations.length > 0) {
        console.log('      建议:');
        health.health.recommendations.forEach(rec => {
          console.log(`        - ${rec}`);
        });
      }
      
      if (health.baseline) {
        console.log(`      需求总数: ${health.baseline.totalRequirements}`);
        console.log(`      核心需求: ${health.baseline.coreRequirements}`);
      }
      
      console.log(`      待处理变更请求: ${health.changeRequests.pending}`);
      console.log(`      已批准变更请求: ${health.changeRequests.approved}`);
    } else {
      console.log('   ❌ 获取健康度报告失败:', result.data);
    }
  } catch (error) {
    console.log('   ❌ 获取健康度报告失败:', error.message);
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🧪 PRD范围管理功能测试');
  console.log('================================');
  
  try {
    await createProject();
    
    const prdUploaded = await uploadPRD();
    if (!prdUploaded) {
      console.log('\n❌ PRD上传失败，无法继续测试');
      return;
    }
    
    const prdAnalyzed = await analyzePRD();
    if (!prdAnalyzed) {
      console.log('\n❌ PRD分析失败，无法继续测试');
      return;
    }
    
    await testTaskScopeCheck();
    await testAutoScopeCheck();
    await testChangeRequests();
    await testAutoAssociation();
    await testTaskScopeReport();
    await testScopeHealth();
    
    console.log('\n🎉 测试完成！');
    console.log('\n📖 更多信息请查看: docs/PRD_SCOPE_MANAGEMENT.md');
    
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}
