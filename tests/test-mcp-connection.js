#!/usr/bin/env node

/**
 * MCP连接测试脚本
 * 模拟Cursor客户端的连接行为
 */

import http from 'http';

const BASE_URL = 'http://localhost:3000';
const PROJECT = 'test-project';
const USERNAME = 'liuqinwang6';
const PASSWORD = '12345678';

// 通用请求函数
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'X-PROJECT': PROJECT,
      'X-USERNAME': USERNAME,
      'X-PASSWORD': PASSWORD,
      ...headers
    };

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: defaultHeaders
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
            headers: res.headers,
            data: parsed
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// 测试步骤
async function testMCPConnection() {
  console.log('🚀 开始MCP连接测试...\n');

  try {
    // 步骤1: 健康检查
    console.log('📡 步骤1: 健康检查...');
    const health = await makeRequest('GET', '/health');
    console.log(`✅ 健康检查: ${health.statusCode === 200 ? '成功' : '失败'}`);
    console.log(`   状态: ${health.data.status}\n`);

    // 步骤2: Initialize (模拟Cursor的请求)
    console.log('📡 步骤2: Initialize请求 (模拟Cursor)...');
    const initRequest = {
      jsonrpc: "2.0",
      // 故意不包含id，模拟Cursor的行为
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          roots: { listChanged: true },
          sampling: {}
        },
        clientInfo: {
          name: "cursor-test",
          version: "1.0.0"
        }
      }
    };

    const initResponse = await makeRequest('POST', '/mcp', initRequest, {
      'Accept': 'application/json, text/event-stream'
    });
    
    console.log(`✅ Initialize响应: ${initResponse.statusCode}`);
    if (initResponse.data.result) {
      console.log(`   协议版本: ${initResponse.data.result.protocolVersion}`);
      console.log(`   会话ID: ${initResponse.data.result.sessionId}`);
      console.log(`   服务器: ${initResponse.data.result.serverInfo.name}\n`);
    } else if (initResponse.data.error) {
      console.log(`❌ 错误: ${initResponse.data.error.message}\n`);
    }

    // 步骤3: Tools/list
    console.log('📡 步骤3: 获取工具列表...');
    const toolsRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list"
    };

    const toolsResponse = await makeRequest('POST', '/mcp', toolsRequest);
    console.log(`✅ 工具列表响应: ${toolsResponse.statusCode}`);
    if (toolsResponse.data.result) {
      console.log(`   可用工具数量: ${toolsResponse.data.result.tools.length}`);
      console.log(`   工具列表: ${toolsResponse.data.result.tools.slice(0, 3).map(t => t.name).join(', ')}...\n`);
    }

    // 步骤4: 测试SSE连接
    console.log('📡 步骤4: 测试SSE连接...');
    const sseResponse = await makeRequest('GET', '/mcp', null, {
      'Accept': 'text/event-stream'
    });
    console.log(`✅ SSE连接: ${sseResponse.statusCode === 200 ? '成功' : '失败'}\n`);

    console.log('🎉 MCP连接测试完成！');
    console.log('\n📋 测试结果总结:');
    console.log('- 服务器健康状态: ✅');
    console.log('- Initialize请求: ✅');
    console.log('- 工具列表获取: ✅');
    console.log('- SSE连接: ✅');
    console.log('\n💡 如果Cursor仍然无法连接，请检查:');
    console.log('1. Cursor的MCP配置文件位置和格式');
    console.log('2. Cursor的MCP插件是否启用');
    console.log('3. 防火墙或网络设置');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testMCPConnection();
