# TaskMaster Web API 使用示例

本文档提供了TaskMaster Web API的详细使用示例，包括各种常见场景的API调用方法。

## 基础配置

### 环境变量

```bash
export API_BASE_URL="http://localhost:3000"
export API_KEY="test-api-key-123"
```

### 通用请求头

所有API请求都需要包含以下请求头：

```bash
Content-Type: application/json
X-API-Key: test-api-key-123
```

## 项目管理示例

### 1. 创建项目

```bash
curl -X POST "${API_BASE_URL}/api/projects" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "id": "ecommerce-platform",
    "name": "电商平台项目",
    "description": "一个现代化的电商平台，支持多商户和移动端"
  }'
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "id": "ecommerce-platform",
    "name": "电商平台项目",
    "description": "一个现代化的电商平台，支持多商户和移动端",
    "taskCount": 0,
    "prCount": 0,
    "crCount": 0,
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "meta": {
    "requestId": "req-123456",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### 2. 获取项目列表

```bash
curl -X GET "${API_BASE_URL}/api/projects" \
  -H "X-API-Key: ${API_KEY}"
```

### 3. 获取项目详情

```bash
curl -X GET "${API_BASE_URL}/api/projects/ecommerce-platform" \
  -H "X-API-Key: ${API_KEY}"
```

## PRD文档管理示例

### 1. 上传PRD文档（文件）

```bash
curl -X POST "${API_BASE_URL}/api/projects/ecommerce-platform/upload-prd" \
  -H "X-API-Key: ${API_KEY}" \
  -F "file=@prd-document.txt"
```

### 2. 上传PRD文档（文本内容）

```bash
curl -X POST "${API_BASE_URL}/api/projects/ecommerce-platform/upload-prd" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "content": "# 电商平台产品需求文档\n\n## 1. 项目概述\n电商平台需要支持...",
    "title": "电商平台PRD v1.0"
  }'
```

## 产品需求 (PRs) 管理示例

### 1. 获取项目的产品需求列表

```bash
curl -X GET "${API_BASE_URL}/api/projects/ecommerce-platform/prs" \
  -H "X-API-Key: ${API_KEY}"
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "prs": [
      {
        "id": "pr-001",
        "title": "用户认证系统",
        "description": "实现安全的用户注册、登录和权限管理",
        "status": "approved",
        "priority": "high",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

### 2. 获取产品需求详情

```bash
curl -X GET "${API_BASE_URL}/api/projects/ecommerce-platform/prs/pr-001" \
  -H "X-API-Key: ${API_KEY}"
```

## 变更请求 (CRs) 管理示例

### 1. 获取项目的变更请求列表

```bash
curl -X GET "${API_BASE_URL}/api/projects/ecommerce-platform/crs" \
  -H "X-API-Key: ${API_KEY}"
```

### 2. 获取变更请求详情

```bash
curl -X GET "${API_BASE_URL}/api/projects/ecommerce-platform/crs/cr-001" \
  -H "X-API-Key: ${API_KEY}"
```

## 任务管理示例

### 1. 获取项目的任务列表

```bash
curl -X GET "${API_BASE_URL}/api/projects/ecommerce-platform/tasks" \
  -H "X-API-Key: ${API_KEY}"
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "1",
        "title": "设置项目基础架构",
        "description": "初始化项目结构，配置开发环境",
        "status": "in-progress",
        "priority": "high",
        "dependencies": [],
        "details": "创建package.json，设置目录结构...",
        "subtasks": []
      }
    ]
  }
}
```

### 2. 获取任务详情

```bash
curl -X GET "${API_BASE_URL}/api/projects/ecommerce-platform/tasks/1" \
  -H "X-API-Key: ${API_KEY}"
```

### 3. 获取任务统计信息

```bash
curl -X GET "${API_BASE_URL}/api/projects/ecommerce-platform/tasks/stats" \
  -H "X-API-Key: ${API_KEY}"
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "total": 25,
    "completed": 8,
    "inProgress": 5,
    "pending": 10,
    "blocked": 2,
    "completionRate": 32,
    "byPriority": {
      "high": 8,
      "medium": 12,
      "low": 5
    },
    "byStatus": {
      "pending": 10,
      "in-progress": 5,
      "done": 8,
      "blocked": 2
    }
  }
}
```

## 健康检查和系统信息

### 1. 健康检查

```bash
curl -X GET "${API_BASE_URL}/health"
```

### 2. 系统信息

```bash
curl -X GET "${API_BASE_URL}/debug/routes" \
  -H "X-API-Key: ${API_KEY}"
```

## 错误处理示例

### 常见错误响应

#### 1. 认证失败 (401)

```json
{
  "success": false,
  "error": "authentication_failed",
  "message": "Invalid or missing API key",
  "details": {
    "code": "INVALID_API_KEY"
  }
}
```

#### 2. 资源不存在 (404)

```json
{
  "success": false,
  "error": "resource_not_found",
  "message": "Project not found",
  "details": {
    "resource": "project",
    "id": "non-existent-project"
  }
}
```

#### 3. 验证错误 (400)

```json
{
  "success": false,
  "error": "validation_error",
  "message": "Invalid request data",
  "details": {
    "field": "name",
    "code": "required",
    "message": "Project name is required"
  }
}
```

## JavaScript/Node.js 示例

### 使用 fetch API

```javascript
const API_BASE_URL = 'http://localhost:3000';
const API_KEY = 'test-api-key-123';

// 创建项目
async function createProject(projectData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(projectData)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }
    
    return data;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
}

// 获取项目列表
async function getProjects() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      headers: {
        'X-API-Key': API_KEY
      }
    });
    
    const data = await response.json();
    return data.data.projects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
}

// 使用示例
(async () => {
  try {
    // 创建项目
    const newProject = await createProject({
      id: 'my-app',
      name: 'My Application',
      description: 'A sample application'
    });
    console.log('Project created:', newProject);
    
    // 获取项目列表
    const projects = await getProjects();
    console.log('Projects:', projects);
  } catch (error) {
    console.error('Error:', error);
  }
})();
```

## Python 示例

```python
import requests
import json

API_BASE_URL = 'http://localhost:3000'
API_KEY = 'test-api-key-123'

class TaskMasterAPI:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            'Content-Type': 'application/json',
            'X-API-Key': api_key
        }
    
    def create_project(self, project_data):
        response = requests.post(
            f'{self.base_url}/api/projects',
            headers=self.headers,
            json=project_data
        )
        response.raise_for_status()
        return response.json()
    
    def get_projects(self):
        response = requests.get(
            f'{self.base_url}/api/projects',
            headers={'X-API-Key': self.headers['X-API-Key']}
        )
        response.raise_for_status()
        return response.json()['data']['projects']
    
    def get_project_tasks(self, project_id):
        response = requests.get(
            f'{self.base_url}/api/projects/{project_id}/tasks',
            headers={'X-API-Key': self.headers['X-API-Key']}
        )
        response.raise_for_status()
        return response.json()['data']['tasks']

# 使用示例
api = TaskMasterAPI(API_BASE_URL, API_KEY)

try:
    # 创建项目
    project = api.create_project({
        'id': 'python-app',
        'name': 'Python Application',
        'description': 'A Python-based application'
    })
    print('Project created:', project)
    
    # 获取项目列表
    projects = api.get_projects()
    print('Projects:', projects)
    
except requests.exceptions.RequestException as e:
    print('Error:', e)
```

## 最佳实践

1. **错误处理**: 始终检查响应状态码和错误信息
2. **重试机制**: 对于网络错误实现指数退避重试
3. **API密钥安全**: 不要在客户端代码中硬编码API密钥
4. **请求限制**: 遵守API的速率限制
5. **数据验证**: 在发送请求前验证数据格式
6. **日志记录**: 记录API调用和错误信息用于调试
