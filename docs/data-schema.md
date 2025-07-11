# TaskMaster 数据存储Schema规范

## 概述

本文档定义了TaskMaster项目中所有数据存储的标准格式和结构，确保数据的一致性和可维护性。

## 项目目录结构

```
projects/
├── {project-name}/
│   └── .taskmaster/
│       ├── state.json           # 项目状态
│       ├── tasks/
│       │   └── tasks.json       # 任务数据
│       ├── docs/
│       │   ├── prd.txt          # PRD文档
│       │   └── *.txt            # 其他文档
│       ├── product-requirements/
│       │   └── requirements.json # 从PRD解析的产品需求
│       ├── change-requests/
│       │   └── *.json           # 变更请求
│       ├── reports/             # 报告文件
│       ├── logs/                # 日志文件
│       └── templates/           # 模板文件
```

**注意**：项目不再包含独立的config.json文件，所有配置统一使用全局配置文件。

## 1. 全局配置说明

项目使用全局配置文件，不在项目目录中存储配置信息：
- **全局配置文件位置**：`global-config.json` 和 `projects.json`
- **项目级配置**：不存在，所有配置统一管理
- **AI服务配置**：在全局配置中统一设置

## 2. 项目状态 (state.json)

```json
{
  "currentTag": "string",
  "lastActivity": "ISO-8601 timestamp",
  "lastSwitched": "ISO-8601 timestamp",
  "branchTagMapping": {
    "branch-name": "tag-name"
  },
  "migrationNoticeShown": "boolean",
  "statistics": {
    "totalTasks": "number",
    "completedTasks": "number", 
    "pendingTasks": "number",
    "inProgressTasks": "number",
    "reviewTasks": "number",
    "deferredTasks": "number",
    "cancelledTasks": "number",
    "lastTaskId": "number"
  }
}
```

## 3. 任务数据 (tasks.json)

### 3.1 任务状态定义

| 状态 | 英文 | 描述 | 颜色代码 |
|------|------|------|----------|
| 待处理 | pending | 任务等待开始 | #6c757d |
| 进行中 | in-progress | 任务正在进行 | #007bff |
| 审核中 | review | 任务完成等待审核 | #ffc107 |
| 已完成 | done | 任务已完成 | #28a745 |
| 已延期 | deferred | 任务被推迟或暂停 | #fd7e14 |
| 已取消 | cancelled | 任务被取消不会完成 | #dc3545 |

### 3.2 优先级定义

| 优先级 | 英文 | 描述 | 颜色代码 |
|--------|------|------|----------|
| 高 | high | 高优先级 | #dc3545 |
| 中 | medium | 中优先级 | #ffc107 |
| 低 | low | 低优先级 | #28a745 |

### 3.3 任务数据结构

```json
{
  "tag-name": {
    "tasks": [
      {
        "id": "number",
        "title": "string",
        "description": "string", 
        "status": "pending|in-progress|review|done|deferred|cancelled",
        "priority": "high|medium|low",
        "dependencies": ["number[]"],
        "details": "string|null",
        "testStrategy": "string|null",
        "estimatedHours": "number|null",
        "actualHours": "number|null",
        "assignee": "string|null",
        "tags": ["string[]"],
        "createdAt": "ISO-8601 timestamp",
        "updatedAt": "ISO-8601 timestamp",
        "completedAt": "ISO-8601 timestamp|null",
        "subtasks": [
          {
            "id": "number",
            "title": "string",
            "description": "string",
            "status": "pending|in-progress|review|done|deferred|cancelled",
            "dependencies": ["number[]"],
            "details": "string|null",
            "acceptanceCriteria": "string|null",
            "createdAt": "ISO-8601 timestamp",
            "updatedAt": "ISO-8601 timestamp"
          }
        ]
      }
    ],
    "metadata": {
      "created": "ISO-8601 timestamp",
      "updated": "ISO-8601 timestamp", 
      "description": "string",
      "projectName": "string|null",
      "version": "string|null",
      "prdSource": "string|null"
    }
  }
}
```

## 4. PRD文档存储

### 4.1 文件位置
- 主PRD文档：`docs/prd.txt` 或 `docs/prd.md`
- 临时文档：`docs/temp_prd_*.txt`
- 其他文档：`docs/*.txt` 或 `docs/*.md`

### 4.2 PRD元数据
PRD文档本身为纯文本，元数据通过API动态生成：

```json
{
  "files": [
    {
      "filename": "string",
      "path": "string",
      "size": "number",
      "created": "ISO-8601 timestamp",
      "modified": "ISO-8601 timestamp",
      "type": "prd|document|template"
    }
  ],
  "count": "number",
  "projectId": "string"
}
```

## 5. 产品需求 (Product Requirements)

### 5.1 存储位置
- 文件路径：`product-requirements/requirements.json`
- 文件格式：JSON
- 数据来源：从PRD文档解析生成

### 5.2 数据结构
```json
{
  "requirements": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "type": "functional|non-functional|business|technical",
      "priority": "high|medium|low",
      "status": "draft|approved|implemented|rejected|pending",
      "source": "prd|stakeholder|analysis",
      "sourceDocument": "string",
      "section": "string",
      "createdAt": "ISO-8601 timestamp",
      "updatedAt": "ISO-8601 timestamp",
      "extractedAt": "ISO-8601 timestamp",
      "acceptanceCriteria": ["string[]"],
      "businessValue": "string",
      "technicalComplexity": "high|medium|low",
      "relatedTasks": ["number[]"],
      "relatedRequirements": ["string[]"],
      "tags": ["string[]"]
    }
  ],
  "metadata": {
    "version": "string",
    "lastUpdated": "ISO-8601 timestamp",
    "sourceFile": "string",
    "extractionMethod": "ai|manual",
    "totalRequirements": "number"
  }
}
```

## 6. 变更请求 (Change Requests)

### 6.1 存储位置
- 文件路径：`change-requests/`
- 文件格式：JSON，每个变更请求一个文件

### 6.2 数据结构
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "type": "feature|bug|enhancement|removal",
  "status": "pending|approved|rejected|implemented",
  "priority": "high|medium|low",
  "impact": "high|medium|low",
  "requestedBy": "string",
  "assignedTo": "string|null",
  "createdAt": "ISO-8601 timestamp",
  "updatedAt": "ISO-8601 timestamp",
  "approvedAt": "ISO-8601 timestamp|null",
  "implementedAt": "ISO-8601 timestamp|null",
  "reason": "string",
  "businessJustification": "string",
  "technicalImpact": "string",
  "estimatedEffort": "number|null",
  "actualEffort": "number|null",
  "affectedComponents": ["string[]"],
  "relatedTasks": ["number[]"],
  "relatedRequirements": ["string[]"],
  "approvalHistory": [
    {
      "action": "submitted|approved|rejected|modified",
      "by": "string",
      "at": "ISO-8601 timestamp",
      "comment": "string"
    }
  ]
}
```

## 7. 数据验证规则

### 7.1 必填字段
- 任务：id, title, description, status
- 项目配置：project.name, ai.main
- 状态文件：currentTag, lastActivity

### 7.2 数据类型验证
- 时间戳：必须为ISO-8601格式
- 枚举值：必须在预定义列表中
- ID：必须为正整数（任务ID）或字符串（其他ID）

### 7.3 关系完整性
- 任务依赖：dependencies中的ID必须存在
- 子任务：subtask ID必须在父任务范围内唯一
- 变更请求：relatedTasks中的任务ID必须存在

## 8. PR和CR生成方式和路径

### 8.1 产品需求 (Product Requirements) 生成

#### 生成方式：
1. **从PRD文档自动提取**：
   - 使用AI分析PRD文档内容
   - 自动识别功能需求、非功能需求、业务需求
   - 生成结构化的需求数据

2. **手动创建**：
   - 通过Web界面手动添加需求
   - 支持需求模板和向导

3. **导入外部需求**：
   - 支持从Excel、CSV等格式导入
   - 支持从其他需求管理工具导入

#### 生成路径：
```
PRD文档 → AI分析 → 需求提取 → 结构化存储
    ↓
product-requirements/requirements.json
```

#### API端点：
- `GET /api/projects/{projectId}/prs` - 获取需求列表
- `GET /api/projects/{projectId}/prs/{reqId}` - 获取特定需求
- `POST /api/projects/{projectId}/prs` - 创建新需求
- `PUT /api/projects/{projectId}/prs/{reqId}` - 更新需求
- `DELETE /api/projects/{projectId}/prs/{reqId}` - 删除需求

### 8.2 变更请求 (Change Requests) 生成

#### 生成方式：
1. **任务范围变更检测**：
   - 监控任务操作（添加、修改、删除）
   - 自动检测是否超出原始PRD范围
   - 生成变更请求建议

2. **手动创建**：
   - 用户主动提交变更请求
   - 支持多种变更类型（功能、缺陷、增强、移除）

3. **需求变更触发**：
   - 需求优先级调整
   - 新需求添加
   - 需求删除或修改

#### 生成路径：
```
任务操作 → 范围检测 → 变更识别 → 变更请求生成
    ↓
change-requests/CR-{id}.json

需求变更 → 影响分析 → 变更请求生成
    ↓
change-requests/CR-{id}.json
```

#### API端点：
- `GET /api/projects/{projectId}/crs` - 获取变更请求列表
- `GET /api/projects/{projectId}/crs/{crId}` - 获取特定变更请求
- `POST /api/projects/{projectId}/crs` - 创建新变更请求
- `PUT /api/projects/{projectId}/crs/{crId}` - 更新变更请求
- `DELETE /api/projects/{projectId}/crs/{crId}` - 删除变更请求

### 8.3 工作流程

#### PR生成工作流程：
1. **PRD上传** → 2. **AI分析** → 3. **需求提取** → 4. **人工审核** → 5. **需求确认**

#### CR生成工作流程：
1. **变更触发** → 2. **影响分析** → 3. **变更请求创建** → 4. **审批流程** → 5. **实施跟踪**

## 9. 迁移和兼容性

### 9.1 版本兼容性
- 支持从legacy格式自动迁移到tagged格式
- 保持向后兼容性
- 自动数据结构升级

### 9.2 数据迁移流程
1. 检测legacy格式
2. 创建backup
3. 转换为新格式
4. 验证数据完整性
5. 更新state.json标记迁移完成
