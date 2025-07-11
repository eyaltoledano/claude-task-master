# PRD范围管理和变更请求系统

## 📋 概述

TaskMaster的PRD范围管理系统可以自动检测任务是否超出PRD定义的范围，并自动创建变更请求(CR)进行跟踪管理。

**重要说明**: 本系统采用**适配器模式**设计，**完全不修改原始TaskMaster代码**，通过独立的数据存储和服务层来扩展功能，确保与原系统的完全兼容性。

## 🎯 核心功能

### 1. PRD需求分析
- 自动解析PRD文档，提取核心需求点
- 建立项目需求基线
- 支持需求分类和优先级管理

### 2. 任务范围检查
- 实时检查任务是否在PRD范围内
- AI驱动的智能判断
- 置信度评估和风险等级分析

### 3. 变更请求管理
- 自动创建变更请求
- CR状态跟踪和审批流程
- 变更影响分析和报告

### 4. 任务数据增强（适配器模式）
- 通过独立存储扩展任务数据
- 不修改原始tasks.json文件
- 自动关联任务到PRD需求
- 范围数据的独立管理

## 🚀 使用流程

### 步骤1: 分析PRD文档

```bash
# 1. 上传PRD文件到项目
POST /api/projects/{projectId}/prd/upload
{
  "filename": "project-requirements.md",
  "content": "PRD文档内容..."
}

# 2. 分析PRD，建立需求基线
POST /api/projects/{projectId}/scope/analyze-prd
{
  "prdFilePath": "project-requirements.md"
}
```

### 步骤2: 自动范围检查

当您添加、修改或扩展任务时，系统会自动进行范围检查：

```bash
# 添加任务时自动检查范围
POST /api/projects/{projectId}/tasks
{
  "title": "新功能实现",
  "description": "实现用户登录功能",
  "details": "详细实现说明..."
}

# 响应包含范围检查结果
{
  "success": true,
  "data": { ... },
  "scopeCheck": {
    "inScope": false,
    "confidence": 0.8,
    "reasoning": "该任务引入了PRD中未明确定义的用户认证功能",
    "riskLevel": "medium"
  },
  "warnings": [
    {
      "type": "scope_violation",
      "message": "发现1个超出PRD范围的任务",
      "changeRequestId": "cr-uuid-123"
    }
  ]
}
```

### 步骤3: 管理变更请求

```bash
# 查看变更请求列表
GET /api/projects/{projectId}/scope/change-requests

# 审批变更请求
PATCH /api/projects/{projectId}/scope/change-requests/{crId}/status
{
  "status": "approved",
  "comment": "功能确实需要，批准变更",
  "approvedBy": "项目经理"
}
```

## 📊 API接口详解

### PRD分析接口

#### 分析PRD文档
```http
POST /api/projects/{projectId}/scope/analyze-prd
Content-Type: application/json

{
  "prdFilePath": "requirements.md"
}
```

#### 获取需求基线
```http
GET /api/projects/{projectId}/scope/requirements-baseline
```

### 范围检查接口

#### 检查单个任务范围
```http
POST /api/projects/{projectId}/scope/check-task-scope
Content-Type: application/json

{
  "task": {
    "title": "任务标题",
    "description": "任务描述",
    "details": "详细信息"
  },
  "operation": "add"
}
```

#### 批量检查任务范围
```http
POST /api/projects/{projectId}/scope/check-tasks-scope
Content-Type: application/json

{
  "tasks": [...],
  "operation": "add"
}
```

### 变更请求接口

#### 创建变更请求
```http
POST /api/projects/{projectId}/scope/change-requests
Content-Type: application/json

{
  "type": "scope_expansion",
  "title": "添加用户认证功能",
  "description": "需要添加用户登录和注册功能",
  "reason": "客户新增需求",
  "impact": "影响后端API设计",
  "priority": "high"
}
```

#### 获取变更请求列表
```http
GET /api/projects/{projectId}/scope/change-requests?status=pending&type=scope_expansion
```

#### 更新变更请求状态
```http
PATCH /api/projects/{projectId}/scope/change-requests/{crId}/status
Content-Type: application/json

{
  "status": "approved",
  "comment": "批准理由",
  "approvedBy": "审批人"
}
```

## 🔧 配置选项

### 范围检查中间件配置

```javascript
// 严格模式：阻止超出范围的操作
app.use('/api/projects/:projectId/tasks', scopeCheckMiddlewares.strict);

// 宽松模式：只记录警告
app.use('/api/projects/:projectId/tasks', scopeCheckMiddlewares.addTask);

// 自定义配置
app.use('/api/projects/:projectId/tasks', createScopeCheckMiddleware({
  operation: 'add',
  autoCreateCR: true,
  blockOutOfScope: false,
  confidenceThreshold: 0.7
}));
```

### 置信度阈值说明

- **0.9-1.0**: 非常确定
- **0.7-0.9**: 比较确定
- **0.5-0.7**: 一般确定
- **0.3-0.5**: 不太确定
- **0.0-0.3**: 很不确定

## 📈 报告和分析

### 项目范围健康度报告
```http
GET /api/projects/{projectId}/scope/scope-health
```

返回项目的范围管理健康状况：
- 是否有PRD基线
- 需求覆盖度
- 变更请求趋势
- 风险等级评估
- 改进建议

### 变更请求报告
```http
GET /api/projects/{projectId}/scope/change-requests-report
```

包含：
- 变更请求统计
- 按类型和优先级分组
- 趋势分析
- 最近的变更请求

## 🎨 最佳实践

### 1. PRD准备
- 确保PRD文档结构清晰
- 明确定义功能需求和非功能需求
- 包含验收标准和约束条件

### 2. 范围控制
- 定期审查变更请求
- 建立变更审批流程
- 监控范围蔓延趋势

### 3. 团队协作
- 培训团队成员理解范围管理
- 建立变更沟通机制
- 定期回顾和改进流程

## 🚨 注意事项

1. **AI判断限制**: 系统基于AI分析，可能存在误判，建议人工审查
2. **PRD质量**: 分析结果依赖PRD文档质量，建议使用结构化的PRD
3. **性能考虑**: 范围检查会增加API响应时间，可根据需要调整
4. **权限管理**: 变更请求审批需要适当的权限控制

## 🔮 未来扩展

- 集成项目管理工具
- 支持多版本PRD管理
- 添加变更成本估算
- 实现自动化测试覆盖度检查
- 支持需求追溯矩阵
