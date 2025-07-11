/**
 * routes/projects.js
 * Project management API routes - READ/WRITE operations
 * Supports project creation, PRD upload, and project management
 */

import express from 'express';
import { z } from 'zod';
import { taskMasterService } from '../services/taskmaster-service.js';
import { validateProjectRoot } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import archiver from 'archiver';

const router = express.Router();

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get all projects
 *     tags: [Projects]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of projects retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         projects:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Project'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - name
 *             properties:
 *               id:
 *                 type: string
 *                 description: Unique project identifier
 *                 example: my-web-app
 *               name:
 *                 type: string
 *                 description: Project name
 *                 example: My Web Application
 *               description:
 *                 type: string
 *                 description: Project description
 *                 example: A modern web application for task management
 *     responses:
 *       201:
 *         description: Project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Project'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Project already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// 配置PRD文件上传
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // 允许文本文件和常见文档格式
    const allowedTypes = [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const allowedExtensions = ['.txt', '.md', '.pdf', '.doc', '.docx'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传文本文件、Markdown、PDF或Word文档'), false);
    }
  }
});

// Validation schemas
const createProjectSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  template: z.string().optional().default('default')
});

const uploadPrdSchema = z.object({
  filename: z.string().optional(),
  content: z.string().optional()
});

const parsePrdSchema = z.object({
  input: z.string().optional(),
  numTasks: z.number().optional(),
  force: z.boolean().optional().default(false)
});
// ==================== PROJECT MANAGEMENT ROUTES ====================

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: 获取所有项目列表
 *     tags: [Projects]
 *     responses:
 *       200:
 *         description: 项目列表获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     projects:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Project'
 */
router.get('/', async (req, res) => {
  try {
    const result = await taskMasterService.getProjects();

    res.json({
      success: true,
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    logger.error('获取项目列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取项目列表失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: 创建新项目
 *     tags: [Projects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - name
 *             properties:
 *               id:
 *                 type: string
 *                 description: 项目唯一标识符
 *               name:
 *                 type: string
 *                 description: 项目名称
 *               description:
 *                 type: string
 *                 description: 项目描述
 *               template:
 *                 type: string
 *                 description: 项目模板
 *                 default: default
 */
router.post('/', async (req, res) => {
  try {
    const validatedData = createProjectSchema.parse(req.body);
    const result = await taskMasterService.createProject(validatedData);

    res.status(201).json({
      success: true,
      message: '项目创建成功',
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: error.errors
      });
    }

    logger.error('创建项目失败:', error);
    res.status(500).json({
      success: false,
      error: '创建项目失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}:
 *   get:
 *     summary: 获取项目详情
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *     responses:
 *       200:
 *         description: 项目详情获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 */
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await taskMasterService.getProject(projectId);

    res.json({
      success: true,
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    logger.error(`获取项目 ${req.params.projectId} 详情失败:`, error);
    res.status(500).json({
      success: false,
      error: '获取项目详情失败',
      details: error.message
    });
  }
});

// ==================== PRD DOCUMENT MANAGEMENT ====================

/**
 * @swagger
 * /api/projects/{projectId}/prd:
 *   get:
 *     summary: 获取项目PRD文档
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *     responses:
 *       200:
 *         description: PRD文档获取成功
 */
router.get('/:projectId/prd', async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await taskMasterService.getProjectPrd(projectId);

    res.json({
      success: true,
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    logger.error(`获取项目 ${req.params.projectId} PRD失败:`, error);
    res.status(500).json({
      success: false,
      error: '获取PRD文档失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/prd:
 *   put:
 *     summary: 更新项目PRD文档
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: PRD文档内容
 *               filename:
 *                 type: string
 *                 description: 文件名
 *     responses:
 *       200:
 *         description: PRD文档更新成功
 */
router.put('/:projectId/prd', async (req, res) => {
  try {
    const { projectId } = req.params;
    const validatedData = uploadPrdSchema.parse(req.body);

    if (!validatedData.content) {
      return res.status(400).json({
        success: false,
        error: '请提供PRD文档内容'
      });
    }

    const prdData = {
      filename: validatedData.filename || 'prd.md',
      content: validatedData.content
    };

    const result = await taskMasterService.uploadPrd(projectId, prdData);

    res.json({
      success: true,
      message: 'PRD文档更新成功',
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: error.errors
      });
    }

    logger.error(`更新PRD文档失败 (项目: ${req.params.projectId}):`, error);
    res.status(500).json({
      success: false,
      error: 'PRD文档更新失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/prd/upload:
 *   post:
 *     summary: 上传PRD文档
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PRD文档文件
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: PRD文档内容（文本形式）
 *               filename:
 *                 type: string
 *                 description: 文件名
 */
router.post('/:projectId/prd/upload', upload.single('file'), async (req, res) => {
  try {
    const { projectId } = req.params;
    let prdData = {};

    if (req.file) {
      // 处理文件上传
      const fileContent = await fs.readFile(req.file.path, 'utf8');
      prdData = {
        filename: req.file.originalname,
        content: fileContent
      };

      // 清理临时文件
      await fs.unlink(req.file.path);
    } else if (req.body.content) {
      // 处理文本内容
      prdData = {
        filename: req.body.filename || 'prd.txt',
        content: req.body.content
      };
    } else {
      return res.status(400).json({
        success: false,
        error: '请提供PRD文档文件或内容'
      });
    }

    const result = await taskMasterService.uploadPrd(projectId, prdData);

    res.json({
      success: true,
      message: 'PRD文档上传成功',
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    // 清理临时文件（如果存在）
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.warn('清理临时文件失败:', cleanupError);
      }
    }

    logger.error(`上传PRD文档失败 (项目: ${req.params.projectId}):`, error);
    res.status(500).json({
      success: false,
      error: 'PRD文档上传失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/prd/parse:
 *   post:
 *     summary: 解析PRD文档生成任务
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input:
 *                 type: string
 *                 description: PRD文档内容（可选，如果不提供则使用已上传的PRD）
 *               numTasks:
 *                 type: integer
 *                 description: 期望生成的任务数量
 *               force:
 *                 type: boolean
 *                 description: 是否强制覆盖现有任务
 *                 default: false
 *     responses:
 *       200:
 *         description: PRD解析成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     tasksGenerated:
 *                       type: integer
 *                     tasks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Task'
 */
router.post('/:projectId/prd/parse', async (req, res) => {
  try {
    const { projectId } = req.params;
    const validatedData = parsePrdSchema.parse(req.body);

    const result = await taskMasterService.parsePrd(projectId, validatedData);

    res.json({
      success: true,
      message: 'PRD解析成功',
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: error.errors
      });
    }

    logger.error(`PRD解析失败 (项目: ${req.params.projectId}):`, error);
    res.status(500).json({
      success: false,
      error: 'PRD解析失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/ide-config/{ideType}:
 *   get:
 *     summary: 下载项目IDE配置文件
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *       - in: path
 *         name: ideType
 *         required: false
 *         schema:
 *           type: string
 *           enum: [claude, clinerules, cursor, github, idea, roo, trae, vscode, windsurf]
 *         description: IDE类型，不提供则下载所有IDE配置
 *     responses:
 *       200:
 *         description: IDE配置文件下载成功
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/:projectId/ide-config/:ideType?', async (req, res) => {
  try {
    const { projectId, ideType } = req.params;

    // 构建Express API服务的URL
    const expressApiUrl = process.env.EXPRESS_API_URL || 'http://localhost:3000';
    const apiPath = ideType
      ? `/api/projects/${projectId}/ide-config/${ideType}`
      : `/api/projects/${projectId}/ide-config`;

    const targetUrl = `${expressApiUrl}${apiPath}`;

    // 代理请求到Express API服务
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(targetUrl);

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    // 转发响应头
    res.setHeader('Content-Type', response.headers.get('content-type'));
    res.setHeader('Content-Disposition', response.headers.get('content-disposition'));

    // 流式转发响应体
    response.body.pipe(res);

    logger.info(`IDE配置下载代理成功`, {
      projectId,
      ideType: ideType || 'all',
      targetUrl
    });

  } catch (error) {
    logger.error('IDE配置下载代理失败:', error);
    res.status(500).json({
      success: false,
      error: 'IDE配置下载失败',
      details: error.message
    });
  }
});

export default router;