/**
 * Task Master Web API - Frontend Application
 * 主前端应用程序，处理所有用户交互和API调用
 */

class TaskMasterApp {
    constructor() {
        this.config = {
            apiKey: 'test-api-key-123',
            baseUrl: 'http://localhost:3002'  // Web API服务端口
        };
        this.currentProject = null;
        this.selectedFile = null;
        
        this.init();
    }

    /**
     * 初始化应用程序
     */
    init() {
        this.loadConfig();
        this.setupEventListeners();
        this.initializeTabs();
        this.loadProjects();
    }

    /**
     * 加载配置
     */
    loadConfig() {
        // 配置指向Express API服务
        this.config.baseUrl = 'http://localhost:3000';
        console.log('🔧 配置加载完成:', this.config);
    }

    /**
     * 保存API密钥（带时间戳）
     */
    saveApiKeyWithTimestamp(apiKey) {
        const keyData = {
            apiKey: apiKey,
            timestamp: Date.now()
        };
        localStorage.setItem('taskmaster_api_key_data', JSON.stringify(keyData));
    }

    /**
     * 保存配置
     */
    saveConfig() {
        // 配置已经在loadConfig中设置，无需保存
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 配置保存
        document.getElementById('saveConfigBtn')?.addEventListener('click', () => {
            this.saveConfig();
            this.showAlert('配置已保存', 'success');
        });

        // 连接测试功能已移除

        // 项目管理
        document.getElementById('createProjectBtn')?.addEventListener('click', () => {
            this.showCreateProjectForm();
        });

        document.getElementById('refreshProjectsBtn')?.addEventListener('click', () => {
            this.refreshProjectsWithCache();
        });

        // PRD文档上传
        document.getElementById('prdFileInput')?.addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        document.getElementById('uploadPrdBtn')?.addEventListener('click', () => {
            this.uploadPrdFile();
        });

        // 拖拽上传
        this.setupFileUpload();

        // PRD任务生成
        document.getElementById('generateTasksBtn')?.addEventListener('click', () => {
            this.generateTasksFromPrd();
        });

        document.getElementById('refreshPrdListBtn')?.addEventListener('click', () => {
            this.refreshPrdDocumentList();
        });

        // 删除项目相关事件
        document.getElementById('closeDeleteModal')?.addEventListener('click', () => {
            this.hideDeleteProjectModal();
        });

        document.getElementById('cancelDeleteProject')?.addEventListener('click', () => {
            this.hideDeleteProjectModal();
        });

        document.getElementById('confirmDeleteProject')?.addEventListener('click', () => {
            this.executeDeleteProject();
        });
    }

    /**
     * 初始化标签页功能
     */
    initializeTabs() {
        const tabs = document.querySelectorAll('.tab');
        const panes = document.querySelectorAll('.tab-pane');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                
                // 移除所有活动状态
                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));
                
                // 添加活动状态
                tab.classList.add('active');
                document.getElementById(targetTab).classList.add('active');

                // 根据标签页加载相应数据
                this.onTabChange(targetTab);
            });
        });
    }

    /**
     * 标签页切换处理
     */
    onTabChange(tabId) {
        switch (tabId) {
            case 'projects':
                this.loadProjects();
                break;
            case 'prd':
                if (this.currentProject) {
                    this.loadPrd(this.currentProject.id);
                }
                break;
            case 'tasks':
                if (this.currentProject) {
                    this.loadTasks(this.currentProject.id);
                    this.showPrdTaskGenerationSection();
                    this.refreshPrdDocumentList();
                } else {
                    this.hidePrdTaskGenerationSection();
                }
                break;
            case 'prs':
                if (this.currentProject) {
                    this.loadPrs(this.currentProject.id);
                }
                break;
            case 'crs':
                if (this.currentProject) {
                    this.loadCrs(this.currentProject.id);
                }
                break;
        }
    }

    /**
     * API请求函数
     */
    async apiRequest(endpoint, options = {}) {
        this.saveConfig();

        const url = `${this.config.baseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const requestOptions = { ...defaultOptions, ...options };
        if (options.headers) {
            requestOptions.headers = { ...defaultOptions.headers, ...options.headers };
        }

        // 处理超时
        const timeout = options.timeout || 30000; // 默认30秒超时
        const controller = new AbortController();
        requestOptions.signal = controller.signal;

        // 保存控制器以便外部取消
        if (options.saveController) {
            this.currentApiController = controller;
        }

        const timeoutId = setTimeout(() => {
            controller.abort();
        }, timeout);

        try {
            this.showLoading(true);
            const response = await fetch(url, requestOptions);
            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error(controller.signal.reason === 'user_cancelled' ? 'aborted' : 'timeout');
            }

            console.error('API请求失败:', error);
            throw error;
        } finally {
            this.showLoading(false);
            if (options.saveController) {
                this.currentApiController = null;
            }
        }
    }

    /**
     * 显示/隐藏加载指示器
     */
    showLoading(show) {
        // 简化的加载指示器，可以在控制台看到
        if (show) {
            console.log('Loading...');
        } else {
            console.log('Loading complete');
        }
    }

    /**
     * 显示通知
     */
    showAlert(message, type = 'info') {
        // 创建弹出提示容器（如果不存在）
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                max-width: 350px;
                pointer-events: none;
            `;
            document.body.appendChild(toastContainer);
        }

        // 创建提示元素
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : type === 'warning' ? '#fff3cd' : '#d1ecf1'};
            color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : type === 'warning' ? '#856404' : '#0c5460'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : type === 'warning' ? '#ffeaa7' : '#bee5eb'};
            border-radius: 4px;
            padding: 12px 16px;
            margin-bottom: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            pointer-events: auto;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            position: relative;
            word-wrap: break-word;
        `;

        toast.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="flex: 1; margin-right: 10px;">${message}</span>
                <button type="button" style="
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: inherit;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                " onclick="this.parentElement.parentElement.remove()">
                    ×
                </button>
            </div>
        `;

        toastContainer.appendChild(toast);

        // 动画显示
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);

        // 自动移除提示
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, 5000);
    }

    // 连接测试功能已移除

    /**
     * 加载项目列表
     */
    async loadProjects() {
        console.log('🔄 开始加载项目列表...');
        try {
            const data = await this.apiRequest('/api/projects');
            console.log('✅ 项目数据获取成功:', data);
            this.displayProjects(data.data || data.projects || []);
            this.showAlert('项目列表加载成功!', 'success');
        } catch (error) {
            console.error('❌ 加载项目失败:', error);
            this.showAlert(`加载项目失败: ${error.message}`, 'error');
        }
    }

    /**
     * 刷新项目列表（清理缓存）
     */
    async refreshProjectsWithCache() {
        console.log('🔄 开始刷新项目列表（清理缓存）...');
        try {
            // 显示刷新状态
            this.showAlert('正在清理缓存...', 'info');

            // 先清理项目相关缓存
            await this.apiRequest('/api/admin/cache/clear/projects', {
                method: 'POST',
                body: JSON.stringify({})
            });

            console.log('✅ 缓存清理成功');
            this.showAlert('缓存清理成功，正在重新加载...', 'info');

            // 然后重新加载项目列表
            await this.loadProjects();

        } catch (error) {
            console.error('❌ 刷新项目失败:', error);
            this.showAlert(`刷新项目失败: ${error.message}`, 'error');
        }
    }

    /**
     * 显示项目列表
     */
    displayProjects(projects) {
        const container = document.getElementById('projectsContainer');
        
        if (!projects || projects.length === 0) {
            container.innerHTML = '<p class="text-center">暂无项目</p>';
            return;
        }
        
        let html = '<div class="projects-grid">';
        
        projects.forEach(project => {
            html += `
                <div class="project-card" data-project-id="${project.id}">
                    <div class="project-header">
                        <h3>${project.name}</h3>
                        <span class="project-id">#${project.id}</span>
                    </div>
                    <div class="project-description">
                        ${project.description || '暂无描述'}
                    </div>
                    <div class="project-stats">
                        <span>任务: ${project.taskCount || 0}</span>
                        <span>需求: ${project.prCount || 0}</span>
                        <span>变更: ${project.crCount || 0}</span>
                    </div>
                    <div class="project-actions">
                        <button class="btn btn-primary" onclick="app.selectProject('${project.id}')">
                            选择项目
                        </button>
                        <button class="btn btn-danger" onclick="app.showDeleteProjectModal('${project.id}', '${project.name}')">
                            删除
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * 选择项目
     */
    selectProject(projectId) {
        this.currentProject = { id: projectId };
        this.showAlert(`已选择项目: ${projectId}`, 'success');

        // 更新项目选择器显示
        const projectSelector = document.getElementById('currentProject');
        if (projectSelector) {
            projectSelector.textContent = projectId;
        }

        // 更新当前项目指示器
        this.updateCurrentProjectIndicator(projectId);

        // 自动切换到任务标签页
        const taskTab = document.querySelector('[data-tab="tasks"]');
        if (taskTab) {
            taskTab.click();
        }
    }

    /**
     * 更新当前项目指示器
     */
    updateCurrentProjectIndicator(projectId) {
        const indicator = document.getElementById('currentProjectIndicator');
        const projectName = document.getElementById('currentProjectName');

        if (indicator && projectName) {
            if (projectId) {
                projectName.textContent = projectId;
                indicator.style.display = 'inline-flex';
            } else {
                indicator.style.display = 'none';
            }
        }
    }

    /**
     * 查看项目详情 - 跳转到PRD文档页面
     */
    async viewProjectDetails(projectId) {
        try {
            // 选择项目
            this.selectProject(projectId);

            // 切换到PRD文档标签页
            this.switchTab('prd');

            this.showAlert('已跳转到项目PRD文档页面', 'success');
        } catch (error) {
            this.showAlert(`跳转失败: ${error.message}`, 'error');
        }
    }

    /**
     * 下载IDE配置文件
     */
    async downloadIdeConfig(projectId, ideType = null) {
        try {
            this.showAlert('正在准备IDE配置文件下载...', 'info');

            // 构建下载URL
            const url = ideType
                ? `${this.config.baseUrl}/api/projects/${projectId}/ide-config/${ideType}`
                : `${this.config.baseUrl}/api/projects/${projectId}/ide-config`;

            // 创建隐藏的下载链接
            const link = document.createElement('a');
            link.href = url;
            link.style.display = 'none';

            // 添加到页面并触发下载
            document.body.appendChild(link);
            link.click();

            // 清理
            document.body.removeChild(link);

            this.showAlert('IDE配置文件下载已开始', 'success');

        } catch (error) {
            console.error('下载IDE配置失败:', error);
            this.showAlert(`下载IDE配置失败: ${error.message}`, 'error');
        }
    }

    /**
     * 显示创建项目表单
     */
    showCreateProjectForm() {
        const modal = document.getElementById('createProjectModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    /**
     * 隐藏创建项目表单
     */
    hideCreateProjectForm() {
        const modal = document.getElementById('createProjectModal');
        if (modal) {
            modal.style.display = 'none';
            // 清空表单
            document.getElementById('projectId').value = '';
            document.getElementById('projectName').value = '';
            document.getElementById('projectDescription').value = '';
            document.getElementById('prdFile').value = '';

            // 重置表单状态
            this.resetCreateProjectForm();
        }
    }

    /**
     * 创建项目
     */
    async createProject() {
        try {
            // 获取表单数据
            const projectData = {
                id: document.getElementById('projectId').value.trim(),
                name: document.getElementById('projectName').value.trim(),
                description: document.getElementById('projectDescription').value.trim()
            };

            if (!projectData.id || !projectData.name) {
                this.showAlert('项目ID和名称不能为空', 'error');
                return;
            }

            // 验证项目ID格式
            if (!/^[a-z0-9-]+$/.test(projectData.id)) {
                this.showAlert('项目ID只能包含小写字母、数字和连字符', 'error');
                return;
            }

            // 显示进度
            this.showCreateProgress('正在创建项目...', 10);

            // 禁用提交按钮
            const submitBtn = document.getElementById('createProjectSubmitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = '创建中...';

            // 创建项目
            const data = await this.apiRequest('/api/projects', {
                method: 'POST',
                body: JSON.stringify(projectData)
            });

            this.showCreateProgress('项目创建成功，检查PRD文档...', 30);

            // 检查是否有PRD文档需要上传
            const prdFile = document.getElementById('prdFile').files[0];

            if (prdFile) {
                await this.uploadPrdDocument(projectData.id, prdFile);
            } else {
                this.showCreateProgress('项目创建完成!', 100);
                setTimeout(() => {
                    this.hideCreateProjectForm();
                    this.showAlert('项目创建成功! 您可以在任务管理页面生成任务。', 'success');
                    this.loadProjects();
                }, 1000);
            }

        } catch (error) {
            this.hideCreateProgress();
            this.resetCreateProjectForm();
            this.showAlert(`创建项目失败: ${error.message}`, 'error');
        }
    }

    /**
     * 上传PRD文档
     */
    async uploadPrdDocument(projectId, prdFile) {
        try {
            this.showCreateProgress('正在上传PRD文档...', 40);

            // 读取文件内容
            const fileContent = await this.readFileContent(prdFile);

            // 上传PRD文档
            await this.apiRequest(`/api/projects/${projectId}/prd`, {
                method: 'PUT',
                body: JSON.stringify({
                    content: fileContent,
                    filename: prdFile.name
                })
            });

            this.showCreateProgress('PRD文档上传成功!', 80);
            this.showCreateProgress('项目创建完成! 您可以在任务管理页面生成任务。', 100);

            // 延迟关闭模态框
            setTimeout(() => {
                this.hideCreateProjectForm();
                this.showAlert('项目创建成功! PRD文档已上传，您可以在任务管理页面生成任务。', 'success');
                this.loadProjects();
            }, 2000);

        } catch (error) {
            this.hideCreateProgress();
            this.resetCreateProjectForm();
            this.showAlert(`PRD文档上传失败: ${error.message}`, 'error');
        }
    }

    /**
     * 读取文件内容
     */
    async readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    /**
     * 显示创建进度
     */
    showCreateProgress(text, percentage) {
        const progressContainer = document.getElementById('createProjectProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        progressContainer.style.display = 'block';
        progressFill.style.width = percentage + '%';
        progressText.textContent = text;
    }

    /**
     * 隐藏创建进度
     */
    hideCreateProgress() {
        const progressContainer = document.getElementById('createProjectProgress');
        progressContainer.style.display = 'none';
    }

    /**
     * 重置创建项目表单
     */
    resetCreateProjectForm() {
        const submitBtn = document.getElementById('createProjectSubmitBtn');
        submitBtn.disabled = false;
        submitBtn.textContent = '创建项目';
        this.hideCreateProgress();
    }

    /**
     * 加载任务列表
     */
    async loadTasks(projectId) {
        if (!projectId) {
            this.showAlert('请先选择项目', 'warning');
            return;
        }

        try {
            const data = await this.apiRequest(`/api/projects/${projectId}/tasks`);
            this.displayTasks(data.data.tasks || []);
            this.showAlert('任务列表加载成功!', 'success');
        } catch (error) {
            this.showAlert(`加载任务失败: ${error.message}`, 'error');
        }
    }

    /**
     * 显示任务列表
     */
    displayTasks(tasks) {
        const container = document.getElementById('tasksContainer');

        if (!tasks || tasks.length === 0) {
            container.innerHTML = '<p class="text-center">暂无任务</p>';
            // 当没有任务时，展开任务生成框
            this.expandPrdTaskGenerationSection();
            return;
        }

        // 当有任务时，收缩任务生成框
        this.collapsePrdTaskGenerationSection();

        // 按状态分组任务 - 完整的6种状态
        const groupedTasks = {
            'pending': [],
            'in-progress': [],
            'review': [],
            'done': [],
            'deferred': [],
            'cancelled': []
        };

        tasks.forEach(task => {
            const status = task.status || 'pending';
            // 处理状态名称的兼容性（下划线转连字符）
            const normalizedStatus = status.replace('_', '-');
            if (groupedTasks[normalizedStatus]) {
                groupedTasks[normalizedStatus].push(task);
            } else if (groupedTasks[status]) {
                groupedTasks[status].push(task);
            } else {
                // 未知状态归类到pending
                groupedTasks['pending'].push(task);
            }
        });

        let html = '';

        // 状态配置 - 完整的6种状态
        const statusConfig = {
            'pending': { title: '📋 待处理', color: '#6c757d' },
            'in-progress': { title: '🔄 进行中', color: '#007bff' },
            'review': { title: '👀 审核中', color: '#ffc107' },
            'done': { title: '✅ 已完成', color: '#28a745' },
            'deferred': { title: '⏸️ 已延期', color: '#fd7e14' },
            'cancelled': { title: '❌ 已取消', color: '#dc3545' }
        };

        Object.keys(statusConfig).forEach(status => {
            const config = statusConfig[status];
            const statusTasks = groupedTasks[status];

            if (statusTasks.length > 0) {
                html += `
                    <div class="task-group">
                        <div class="task-group-header" style="background-color: ${config.color}" onclick="app.toggleTaskGroup('${status}')">
                            <div class="header-content">
                                <h4>${config.title}</h4>
                                <span class="task-count">${statusTasks.length} 个任务</span>
                            </div>
                            <span class="toggle-icon" id="toggle-${status}">▼</span>
                        </div>
                        <div class="task-list" id="tasks-${status}">
                `;

                statusTasks.forEach(task => {
                    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                    const completedSubtasks = hasSubtasks ? task.subtasks.filter(st => st.status === 'done').length : 0;
                    const totalSubtasks = hasSubtasks ? task.subtasks.length : 0;
                    const progress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

                    const createdDate = task.createdAt ? new Date(task.createdAt).toLocaleDateString('zh-CN') : '';
                    const updatedDate = task.updatedAt ? new Date(task.updatedAt).toLocaleDateString('zh-CN') : '';

                    html += `
                        <div class="task-item" data-task-id="${task.id}">
                            <div class="task-header">
                                <div class="task-header-left">
                                    <span class="task-id">#${task.id}</span>
                                    <span class="task-priority priority-${task.priority || 'medium'}">
                                        ${this.getPriorityText(task.priority)}
                                    </span>
                                    ${task.assignee ? `<span class="task-assignee">👤 ${task.assignee}</span>` : ''}
                                </div>
                                <div class="task-header-right">
                                    ${hasSubtasks ? `<span class="subtask-count">📋 ${completedSubtasks}/${totalSubtasks}</span>` : ''}
                                    <button class="btn btn-sm btn-outline" onclick="app.toggleTaskDetails('${task.id}')">
                                        <span id="toggle-task-${task.id}">▼</span> 详情
                                    </button>
                                </div>
                            </div>
                            <div class="task-title">${task.title}</div>
                            <div class="task-description">${task.description || ''}</div>

                            ${hasSubtasks ? `
                                <div class="task-progress">
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${progress}%"></div>
                                    </div>
                                    <span class="progress-text">${progress}% 完成</span>
                                </div>
                            ` : ''}

                            ${task.tags && task.tags.length > 0 ? `
                                <div class="task-tags">
                                    ${task.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                                </div>
                            ` : ''}

                            <div class="task-details" id="task-details-${task.id}" style="display: none;">
                                <div class="task-meta">
                                    <div class="meta-row">
                                        <span class="meta-label">创建时间:</span>
                                        <span class="meta-value">${createdDate}</span>
                                    </div>
                                    <div class="meta-row">
                                        <span class="meta-label">更新时间:</span>
                                        <span class="meta-value">${updatedDate}</span>
                                    </div>
                                    ${task.estimatedHours ? `
                                        <div class="meta-row">
                                            <span class="meta-label">预估工时:</span>
                                            <span class="meta-value">${task.estimatedHours}小时</span>
                                        </div>
                                    ` : ''}
                                    ${task.actualHours ? `
                                        <div class="meta-row">
                                            <span class="meta-label">实际工时:</span>
                                            <span class="meta-value">${task.actualHours}小时</span>
                                        </div>
                                    ` : ''}
                                    ${task.dependencies && task.dependencies.length > 0 ? `
                                        <div class="meta-row">
                                            <span class="meta-label">依赖任务:</span>
                                            <span class="meta-value">${task.dependencies.map(dep => `#${dep}`).join(', ')}</span>
                                        </div>
                                    ` : ''}
                                </div>

                                ${hasSubtasks ? `
                                    <div class="subtasks-section">
                                        <h5>子任务</h5>
                                        <div class="subtasks-list">
                                            ${task.subtasks.map(subtask => `
                                                <div class="subtask-item status-${subtask.status}">
                                                    <div class="subtask-header">
                                                        <span class="subtask-status">${this.getStatusIcon(subtask.status)}</span>
                                                        <span class="subtask-id">#${subtask.id}</span>
                                                        <span class="subtask-title">${subtask.title}</span>
                                                    </div>
                                                    <div class="subtask-description">${subtask.description || ''}</div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>
                `;
            }
        });

        container.innerHTML = html;
    }

    /**
     * 获取优先级文本
     */
    getPriorityText(priority) {
        const priorityMap = {
            'high': '高',
            'medium': '中',
            'low': '低'
        };
        return priorityMap[priority] || '中';
    }

    /**
     * 切换任务组的展开/收缩状态
     */
    toggleTaskGroup(status) {
        const tasksContainer = document.getElementById(`tasks-${status}`);
        const toggleIcon = document.getElementById(`toggle-${status}`);

        if (tasksContainer && toggleIcon) {
            const isCollapsed = tasksContainer.style.display === 'none';
            tasksContainer.style.display = isCollapsed ? 'block' : 'none';
            toggleIcon.textContent = isCollapsed ? '▼' : '▶';
        }
    }

    /**
     * 切换任务详情的展开/收缩状态
     */
    toggleTaskDetails(taskId) {
        const detailsContainer = document.getElementById(`task-details-${taskId}`);
        const toggleIcon = document.getElementById(`toggle-task-${taskId}`);

        if (detailsContainer && toggleIcon) {
            const isCollapsed = detailsContainer.style.display === 'none';
            detailsContainer.style.display = isCollapsed ? 'block' : 'none';
            toggleIcon.textContent = isCollapsed ? '▲' : '▼';
        }
    }

    /**
     * 获取状态图标
     */
    getStatusIcon(status) {
        const statusIcons = {
            'pending': '⏳',
            'in-progress': '🔄',
            'review': '👀',
            'done': '✅',
            'deferred': '⏸️',
            'cancelled': '❌'
        };
        return statusIcons[status] || '📋';
    }

    /**
     * 查看任务详情
     */
    async viewTaskDetails(taskId) {
        try {
            const data = await this.apiRequest(`/api/projects/${this.currentProject}/tasks/${taskId}`);
            this.showTaskDetailsModal(data.data);
        } catch (error) {
            this.showAlert(`获取任务详情失败: ${error.message}`, 'error');
        }
    }

    /**
     * 设置文件上传功能
     */
    setupFileUpload() {
        const uploadArea = document.getElementById('fileUploadArea');
        if (!uploadArea) return;

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect({ target: { files } });
            }
        });
    }

    /**
     * 处理文件选择
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            this.showAlert('文件大小不能超过10MB', 'error');
            return;
        }

        const allowedTypes = ['text/plain', 'text/markdown', 'application/pdf'];
        const allowedExtensions = ['.txt', '.md', '.pdf', '.doc', '.docx'];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            this.showAlert('请选择支持的文件格式 (.txt, .md, .pdf, .doc, .docx)', 'error');
            return;
        }

        this.selectedFile = file;
        document.getElementById('uploadPrdBtn').disabled = false;

        const uploadArea = document.getElementById('fileUploadArea');
        uploadArea.innerHTML = `
            <div class="file-selected">
                <h4>📄 已选择文件</h4>
                <p>${file.name} (${(file.size / 1024).toFixed(1)} KB)</p>
            </div>
        `;

        this.showAlert(`文件 "${file.name}" 已选择`, 'success');
    }

    /**
     * 上传PRD文件
     */
    async uploadPrdFile() {
        if (!this.selectedFile) {
            this.showAlert('请先选择文件', 'error');
            return;
        }

        if (!this.currentProject) {
            this.showAlert('请先选择项目', 'error');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', this.selectedFile);

            const data = await this.apiRequest(`/api/projects/${this.currentProject}/upload-prd`, {
                method: 'POST',
                headers: {
                    'X-API-Key': this.config.apiKey
                    // 不设置 Content-Type，让浏览器自动设置
                },
                body: formData
            });

            this.showAlert('PRD文件上传成功!', 'success');
            this.showUploadResult(data.data);
        } catch (error) {
            this.showAlert(`PRD文件上传失败: ${error.message}`, 'error');
        }
    }

    /**
     * 显示上传结果
     */
    showUploadResult(data) {
        const container = document.getElementById('uploadResultContainer');
        if (container) {
            container.innerHTML = `
                <div class="upload-result">
                    <h4>📋 上传结果</h4>
                    <pre>${JSON.stringify(data, null, 2)}</pre>
                </div>
            `;
        }
    }

    /**
     * 显示任务详情模态框
     */
    showTaskDetailsModal(taskData) {
        const modal = document.getElementById('taskDetailsModal');
        const content = document.getElementById('taskDetailsContent');

        if (modal && content) {
            content.innerHTML = `
                <div class="task-details">
                    <h4>任务 #${taskData.id}</h4>
                    <div class="detail-item">
                        <strong>标题:</strong> ${taskData.title || '无'}
                    </div>
                    <div class="detail-item">
                        <strong>描述:</strong> ${taskData.description || '无'}
                    </div>
                    <div class="detail-item">
                        <strong>状态:</strong> ${taskData.status || '未知'}
                    </div>
                    <div class="detail-item">
                        <strong>优先级:</strong> ${this.getPriorityText(taskData.priority)}
                    </div>
                    ${taskData.dependencies ? `
                        <div class="detail-item">
                            <strong>依赖:</strong> ${taskData.dependencies.join(', ')}
                        </div>
                    ` : ''}
                    ${taskData.details ? `
                        <div class="detail-item">
                            <strong>实现细节:</strong>
                            <pre>${taskData.details}</pre>
                        </div>
                    ` : ''}
                </div>
            `;
            modal.style.display = 'flex';
        }
    }

    /**
     * 隐藏任务详情模态框
     */
    hideTaskDetailsModal() {
        const modal = document.getElementById('taskDetailsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 显示项目详情模态框
     */
    showProjectDetailsModal(projectData) {
        const modal = document.getElementById('projectDetailsModal');
        const content = document.getElementById('projectDetailsContent');

        if (modal && content) {
            content.innerHTML = `
                <div class="project-details">
                    <h4>项目 ${projectData.name}</h4>
                    <div class="detail-item">
                        <strong>ID:</strong> ${projectData.id}
                    </div>
                    <div class="detail-item">
                        <strong>描述:</strong> ${projectData.description || '无'}
                    </div>
                    <div class="detail-item">
                        <strong>任务数量:</strong> ${projectData.taskCount || 0}
                    </div>
                    <div class="detail-item">
                        <strong>需求数量:</strong> ${projectData.prCount || 0}
                    </div>
                    <div class="detail-item">
                        <strong>变更数量:</strong> ${projectData.crCount || 0}
                    </div>
                    <div class="detail-item">
                        <strong>创建时间:</strong> ${projectData.createdAt ? new Date(projectData.createdAt).toLocaleString() : '未知'}
                    </div>
                </div>
            `;
            modal.style.display = 'flex';
        }
    }

    /**
     * 隐藏项目详情模态框
     */
    hideProjectDetailsModal() {
        const modal = document.getElementById('projectDetailsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 加载产品需求列表
     */
    async loadPrs(projectId) {
        if (!projectId) {
            this.showAlert('请先选择项目', 'warning');
            return;
        }

        try {
            const data = await this.apiRequest(`/api/projects/${projectId}/prs`);
            this.displayPrs(data.data.requirements || []);
            this.showAlert('产品需求列表加载成功!', 'success');
        } catch (error) {
            this.showAlert(`加载产品需求失败: ${error.message}`, 'error');
        }
    }

    /**
     * 显示产品需求列表
     */
    displayPrs(prs) {
        const container = document.getElementById('requirementsContainer');
        if (!container) return;

        if (!prs || prs.length === 0) {
            container.innerHTML = '<p class="text-center">暂无产品需求</p>';
            return;
        }

        let html = '<div class="prs-list">';

        prs.forEach(pr => {
            html += `
                <div class="pr-item">
                    <div class="pr-header">
                        <h4>${pr.title || `需求 #${pr.id}`}</h4>
                        <span class="pr-id">#${pr.id}</span>
                    </div>
                    <div class="pr-description">
                        ${pr.description || '暂无描述'}
                    </div>
                    <div class="pr-actions">
                        <!-- PR操作按钮已移除 -->
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * 加载变更请求列表
     */
    async loadCrs(projectId) {
        if (!projectId) {
            this.showAlert('请先选择项目', 'warning');
            return;
        }

        try {
            const data = await this.apiRequest(`/api/projects/${projectId}/crs`);
            this.displayCrs(data.data.changeRequests || []);
            this.showAlert('变更请求列表加载成功!', 'success');
        } catch (error) {
            this.showAlert(`加载变更请求失败: ${error.message}`, 'error');
        }
    }

    /**
     * 显示变更请求列表
     */
    displayCrs(crs) {
        const container = document.getElementById('changesContainer');
        if (!container) return;

        if (!crs || crs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>📋 暂无变更请求</h3>
                    <p>当前项目还没有变更请求</p>
                </div>
            `;
            return;
        }

        // 状态颜色映射
        const statusColors = {
            'pending': '#ffc107',
            'approved': '#28a745',
            'rejected': '#dc3545',
            'implemented': '#6f42c1'
        };

        // 优先级颜色映射
        const priorityColors = {
            'high': '#dc3545',
            'medium': '#ffc107',
            'low': '#28a745'
        };

        let html = `
            <div class="cr-table-container">
                <h3>📋 变更请求列表</h3>
                <div class="table-responsive">
                    <table class="cr-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>标题</th>
                                <th>类型</th>
                                <th>状态</th>
                                <th>优先级</th>
                                <th>影响</th>
                                <th>申请人</th>
                                <th>负责人</th>
                                <th>预估工时</th>
                                <th>创建时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        crs.forEach(cr => {
            const statusColor = statusColors[cr.status] || '#6c757d';
            const priorityColor = priorityColors[cr.priority] || '#6c757d';
            const createdDate = new Date(cr.createdAt).toLocaleDateString('zh-CN');

            // 类型映射
            const typeMap = {
                'feature': '功能',
                'bug': '缺陷',
                'enhancement': '增强',
                'removal': '移除'
            };

            // 状态映射
            const statusMap = {
                'pending': '待处理',
                'approved': '已批准',
                'rejected': '已拒绝',
                'implemented': '已实施'
            };

            // 优先级映射
            const priorityMap = {
                'high': '高',
                'medium': '中',
                'low': '低'
            };

            html += `
                <tr>
                    <td><strong>${cr.id}</strong></td>
                    <td>
                        <div class="cr-title">${cr.title}</div>
                        <div class="cr-description">${cr.description.substring(0, 50)}${cr.description.length > 50 ? '...' : ''}</div>
                    </td>
                    <td><span class="badge badge-secondary">${typeMap[cr.type] || cr.type}</span></td>
                    <td><span class="badge" style="background-color: ${statusColor}; color: white;">${statusMap[cr.status] || cr.status}</span></td>
                    <td><span class="badge" style="background-color: ${priorityColor}; color: white;">${priorityMap[cr.priority] || cr.priority}</span></td>
                    <td><span class="badge badge-info">${priorityMap[cr.impact] || cr.impact}</span></td>
                    <td>${cr.requestedBy}</td>
                    <td>${cr.assignedTo || '未分配'}</td>
                    <td>${cr.estimatedEffort ? cr.estimatedEffort + 'h' : '未估算'}</td>
                    <td>${createdDate}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="app.viewCrDetails('${cr.id}')">
                            查看详情
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * 查看变更请求详情
     */
    viewCrDetails(crId) {
        // 这里可以实现查看详情的逻辑
        this.showAlert(`查看变更请求 ${crId} 的详情功能正在开发中`, 'info');
    }

    /**
     * 加载PRD文档
     */
    async loadPrd(projectId) {
        if (!projectId) {
            this.showAlert('请先选择项目', 'warning');
            return;
        }

        const container = document.getElementById('prdContainer');
        if (!container) return;

        container.innerHTML = '<div class="loading">正在加载PRD文档...</div>';

        try {
            // 获取PRD文档
            const data = await this.apiRequest(`/api/projects/${projectId}/prd`);
            this.displayPrd(data.data || {}, projectId);
        } catch (error) {
            container.innerHTML = `<div class="alert alert-error">加载PRD文档失败: ${error.message}</div>`;
        }
    }

    /**
     * 显示PRD文档
     */
    async displayPrd(prdData, projectId) {
        const container = document.getElementById('prdContainer');
        if (!container) return;

        const prdFiles = prdData.files || [];

        if (!prdFiles || prdFiles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>📄 暂无PRD文档</h3>
                    <p>该项目还没有PRD文档，您可以通过项目创建时上传或使用TaskMaster核心工具上传PRD文档</p>
                </div>
            `;
            return;
        }

        let html = '<div class="prd-content">';
        html += '<h3>📄 PRD文档列表</h3>';

        // 显示所有PRD文件
        for (const file of prdFiles) {
            const modifiedDate = new Date(file.modified).toLocaleString('zh-CN');
            const fileSize = this.formatFileSize(file.size);

            html += `
                <div class="prd-file-item">
                    <div class="prd-file-header">
                        <h4>📄 ${file.filename}</h4>
                        <div class="file-meta">
                            <span class="file-size">${fileSize}</span>
                            <span class="file-date">修改时间: ${modifiedDate}</span>
                        </div>
                    </div>
                    <div class="prd-file-actions">
                        <button class="btn btn-primary btn-sm" onclick="app.viewPrdFile('${projectId}', '${file.filename}')">
                            查看内容
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="app.downloadPrdFile('${projectId}', '${file.filename}')">
                            下载文件
                        </button>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * 查看PRD文件内容
     */
    async viewPrdFile(projectId, filename) {
        console.log('viewPrdFile called:', projectId, filename);
        try {
            this.showAlert('正在加载文件内容...', 'info');
            const response = await this.apiRequest(`/api/projects/${projectId}/prd/files/${filename}`);
            console.log('API response:', response);

            // 创建模态框显示文件内容
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>📄 ${filename}</h3>
                        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <pre style="white-space: pre-wrap; font-family: inherit; background: #f8f9fa; padding: 1rem; border-radius: 4px; border: 1px solid #dee2e6; max-height: 500px; overflow-y: auto;">${this.escapeHtml(response.data.content)}</pre>
                    </div>
                </div>
            `;

            // 添加点击背景关闭模态框的功能
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });

            document.body.appendChild(modal);
            this.showAlert('文件内容加载成功', 'success');

        } catch (error) {
            console.error('viewPrdFile error:', error);
            this.showAlert(`无法加载文件内容: ${error.message}`, 'error');
        }
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }



    /**
     * 下载PRD文件
     */
    downloadPrdFile(projectId, filename) {
        const url = `${this.config.baseUrl}/api/projects/${projectId}/prd/files/${filename}/download`;
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 刷新PRD文档列表
     */
    async refreshPrdDocumentList() {
        if (!this.currentProject) {
            this.showAlert('请先选择项目', 'warning');
            return;
        }

        try {
            const select = document.getElementById('prdDocumentSelect');
            if (!select) return;

            // 更新状态显示
            this.updatePrdStatus('正在加载PRD文档列表...', 'loading');

            // 清空现有选项
            select.innerHTML = '<option value="">正在加载...</option>';

            // 获取项目的PRD文档列表
            const response = await this.apiRequest(`/api/projects/${this.currentProject.id}/prd`);

            // 重置选项
            select.innerHTML = '<option value="">请选择PRD文档</option>';

            if (response.data && response.data.files && response.data.files.length > 0) {
                response.data.files.forEach(doc => {
                    const option = document.createElement('option');
                    option.value = doc.filename || doc.name;
                    option.textContent = `${doc.filename || doc.name} (${this.formatFileSize(doc.size || 0)})`;
                    select.appendChild(option);
                });

                // 更新状态显示
                const docCount = response.data.files.length;
                this.updatePrdStatus(`找到 ${docCount} 个PRD文档，请选择一个来生成任务`, 'success');
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = '暂无PRD文档';
                option.disabled = true;
                select.appendChild(option);

                // 更新状态显示
                this.updatePrdStatus('当前项目暂无PRD文档，请先在项目创建时上传PRD文档', 'warning');
            }

        } catch (error) {
            console.error('Failed to load PRD documents:', error);
            const select = document.getElementById('prdDocumentSelect');
            if (select) {
                select.innerHTML = '<option value="">加载失败</option>';
            }
            this.updatePrdStatus('加载PRD文档列表失败，请稍后重试', 'error');
        }
    }

    /**
     * 从PRD生成任务
     */
    async generateTasksFromPrd() {
        if (!this.currentProject) {
            this.showAlert('请先选择项目', 'warning');
            return;
        }

        // 检查是否已经在生成中
        if (this.isGeneratingTasks) {
            this.showAlert('任务生成正在进行中，请稍候...', 'info');
            return;
        }

        try {
            // 获取表单数据
            const prdDocument = document.getElementById('prdDocumentSelect').value;
            const taskCount = parseInt(document.getElementById('taskCount').value) || 10;
            const useResearch = document.getElementById('useResearch').checked;
            const forceGenerate = document.getElementById('forceGenerate').checked;

            if (!prdDocument) {
                this.showAlert('请选择PRD文档', 'warning');
                return;
            }

            // 设置生成状态
            this.isGeneratingTasks = true;
            this.taskGenerationStartTime = Date.now();

            // 显示初始进度
            this.showTaskGenerationProgress('正在准备生成任务...', 5);

            // 禁用生成按钮并添加取消按钮
            this.disableGenerationForm();

            // 启动进度模拟
            this.startProgressSimulation();

            // 调用任务生成API
            const response = await this.apiRequest(`/api/projects/${this.currentProject.id}/prd/parse`, {
                method: 'POST',
                body: JSON.stringify({
                    numTasks: taskCount,
                    useResearch: useResearch,
                    force: forceGenerate
                }),
                timeout: 300000, // 5分钟超时
                saveController: true // 保存控制器以便取消
            });

            // 停止进度模拟
            this.stopProgressSimulation();

            this.showTaskGenerationProgress('任务生成完成!', 100);

            // 显示成功消息
            const taskCount_generated = response.data?.tasks?.length || response.data?.taskCount || 0;
            this.showAlert(`成功生成 ${taskCount_generated} 个任务!`, 'success');

            // 刷新任务列表
            if (this.currentProject) {
                this.loadTasks(this.currentProject.id);
            }

            // 延迟隐藏进度条
            setTimeout(() => {
                this.hideTaskGenerationProgress();
                this.resetTaskGenerationForm();
            }, 2000);

        } catch (error) {
            this.stopProgressSimulation();
            this.hideTaskGenerationProgress();
            this.resetTaskGenerationForm();

            if (error.message.includes('timeout')) {
                this.showAlert('任务生成超时，请检查网络连接或稍后重试', 'warning');
            } else if (error.message.includes('aborted')) {
                this.showAlert('任务生成已取消', 'info');
            } else {
                this.showAlert(`任务生成失败: ${error.message}`, 'error');
            }
        } finally {
            this.isGeneratingTasks = false;
        }
    }

    /**
     * 显示任务生成进度
     */
    showTaskGenerationProgress(text, percentage) {
        const progressContainer = document.getElementById('taskGenerationProgress');
        const progressFill = document.getElementById('taskProgressFill');
        const progressText = document.getElementById('taskProgressText');

        if (progressContainer && progressFill && progressText) {
            progressContainer.style.display = 'block';
            progressFill.style.width = percentage + '%';

            // 添加预估时间
            let displayText = text;
            if (this.taskGenerationStartTime && percentage > 5 && percentage < 95) {
                const elapsed = Date.now() - this.taskGenerationStartTime;
                const estimated = (elapsed / percentage) * 100;
                const remaining = Math.max(0, estimated - elapsed);
                const remainingMinutes = Math.ceil(remaining / 60000);
                displayText += ` (预计还需 ${remainingMinutes} 分钟)`;
            }

            progressText.textContent = displayText;
        }
    }

    /**
     * 隐藏任务生成进度
     */
    hideTaskGenerationProgress() {
        const progressContainer = document.getElementById('taskGenerationProgress');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }

    /**
     * 重置任务生成表单
     */
    resetTaskGenerationForm() {
        this.enableGenerationForm();
        this.isGeneratingTasks = false;
        this.taskGenerationStartTime = null;
    }

    /**
     * 禁用生成表单
     */
    disableGenerationForm() {
        const generateBtn = document.getElementById('generateTasksBtn');
        const prdSelect = document.getElementById('prdDocumentSelect');
        const taskCountInput = document.getElementById('taskCount');
        const useResearchCheckbox = document.getElementById('useResearch');
        const forceGenerateCheckbox = document.getElementById('forceGenerate');

        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<span class="btn-icon">⏳</span>生成中... <button type="button" onclick="app.cancelTaskGeneration()" style="margin-left: 10px; padding: 2px 8px; font-size: 12px; background: #dc3545; color: white; border: none; border-radius: 3px;">取消</button>';
        }

        // 禁用其他表单元素
        [prdSelect, taskCountInput, useResearchCheckbox, forceGenerateCheckbox].forEach(element => {
            if (element) element.disabled = true;
        });
    }

    /**
     * 启用生成表单
     */
    enableGenerationForm() {
        const generateBtn = document.getElementById('generateTasksBtn');
        const prdSelect = document.getElementById('prdDocumentSelect');
        const taskCountInput = document.getElementById('taskCount');
        const useResearchCheckbox = document.getElementById('useResearch');
        const forceGenerateCheckbox = document.getElementById('forceGenerate');

        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<span class="btn-icon">🚀</span>生成任务';
        }

        // 启用其他表单元素
        [prdSelect, taskCountInput, useResearchCheckbox, forceGenerateCheckbox].forEach(element => {
            if (element) element.disabled = false;
        });
    }

    /**
     * 显示PRD任务生成区域
     */
    showPrdTaskGenerationSection() {
        const section = document.getElementById('prdTaskGenerationSection');
        if (section) {
            section.style.display = 'block';
        }
    }

    /**
     * 隐藏PRD任务生成区域
     */
    hidePrdTaskGenerationSection() {
        const section = document.getElementById('prdTaskGenerationSection');
        if (section) {
            section.style.display = 'none';
        }
    }

    /**
     * 启动进度模拟
     */
    startProgressSimulation() {
        this.progressSimulationSteps = [
            { text: '正在解析PRD文档...', percentage: 10, delay: 1000 },
            { text: '正在分析需求内容...', percentage: 25, delay: 3000 },
            { text: '正在调用AI服务...', percentage: 40, delay: 5000 },
            { text: '正在生成任务结构...', percentage: 60, delay: 15000 },
            { text: '正在优化任务依赖...', percentage: 80, delay: 10000 },
            { text: '正在保存任务数据...', percentage: 90, delay: 5000 }
        ];

        this.currentProgressStep = 0;
        this.progressTimer = setTimeout(() => this.updateProgressStep(), 1000);
    }

    /**
     * 更新进度步骤
     */
    updateProgressStep() {
        if (!this.isGeneratingTasks || this.currentProgressStep >= this.progressSimulationSteps.length) {
            return;
        }

        const step = this.progressSimulationSteps[this.currentProgressStep];
        this.showTaskGenerationProgress(step.text, step.percentage);

        this.currentProgressStep++;
        if (this.currentProgressStep < this.progressSimulationSteps.length) {
            const nextStep = this.progressSimulationSteps[this.currentProgressStep];
            this.progressTimer = setTimeout(() => this.updateProgressStep(), nextStep.delay);
        }
    }

    /**
     * 停止进度模拟
     */
    stopProgressSimulation() {
        if (this.progressTimer) {
            clearTimeout(this.progressTimer);
            this.progressTimer = null;
        }
    }

    /**
     * 取消任务生成
     */
    cancelTaskGeneration() {
        if (this.currentApiController) {
            this.currentApiController.abort('user_cancelled');
        }

        this.stopProgressSimulation();
        this.hideTaskGenerationProgress();
        this.resetTaskGenerationForm();

        this.showAlert('任务生成已取消', 'info');
    }

    /**
     * 展开PRD任务生成区域（完全显示）
     */
    expandPrdTaskGenerationSection() {
        const section = document.getElementById('prdTaskGenerationSection');
        if (section) {
            section.style.display = 'block';
            section.classList.remove('collapsed');
            section.classList.add('expanded');
        }
    }

    /**
     * 收缩PRD任务生成区域（显示为小卡片）
     */
    collapsePrdTaskGenerationSection() {
        const section = document.getElementById('prdTaskGenerationSection');
        if (section) {
            section.style.display = 'block';
            section.classList.remove('expanded');
            section.classList.add('collapsed');
        }
    }

    /**
     * 切换PRD任务生成区域的展开/收缩状态
     */
    togglePrdTaskGenerationSection(event) {
        const section = document.getElementById('prdTaskGenerationSection');
        if (!section) return;

        // 如果是收缩状态，则展开
        if (section.classList.contains('collapsed')) {
            this.expandPrdTaskGenerationSection();
            // 阻止事件冒泡，避免在展开后立即触发其他点击事件
            if (event) {
                event.stopPropagation();
            }
        }
        // 如果是展开状态，不做任何操作（保持展开）
    }

    /**
     * 实现switchTab方法以支持程序化切换标签页
     */
    switchTab(tabId) {
        const targetTab = document.querySelector(`[data-tab="${tabId}"]`);
        if (targetTab) {
            targetTab.click();
        }
    }

    /**
     * 更新PRD状态显示
     */
    updatePrdStatus(message, type = 'info') {
        const statusIndicator = document.getElementById('prdStatusIndicator');
        const statusText = document.getElementById('prdStatusText');

        if (!statusIndicator || !statusText) return;

        // 移除所有状态类
        statusIndicator.classList.remove('status-success', 'status-warning', 'status-error');

        // 添加对应的状态类
        switch (type) {
            case 'success':
                statusIndicator.classList.add('status-success');
                break;
            case 'warning':
                statusIndicator.classList.add('status-warning');
                break;
            case 'error':
                statusIndicator.classList.add('status-error');
                break;
            case 'loading':
                // 保持默认样式
                break;
        }

        // 更新状态文本
        statusText.textContent = message;
    }

    /**
     * 显示删除项目确认对话框
     */
    showDeleteProjectModal(projectId, projectName) {
        this.deleteProjectId = projectId;
        document.getElementById('deleteProjectName').textContent = projectName;
        document.getElementById('deleteProjectFiles').checked = false;
        document.getElementById('deleteProjectModal').style.display = 'block';
    }

    /**
     * 隐藏删除项目确认对话框
     */
    hideDeleteProjectModal() {
        document.getElementById('deleteProjectModal').style.display = 'none';
        this.deleteProjectId = null;
    }

    /**
     * 执行删除项目操作
     */
    async executeDeleteProject() {
        if (!this.deleteProjectId) {
            this.showAlert('删除操作失败：未选择项目', 'error');
            return;
        }

        const deleteFiles = document.getElementById('deleteProjectFiles').checked;
        const projectId = this.deleteProjectId;

        try {
            // 显示删除进度
            this.showAlert(deleteFiles ? '正在删除项目和文件...' : '正在删除项目...', 'info');

            // 调用删除API
            const response = await this.apiRequest(`/api/projects/${projectId}`, {
                method: 'DELETE',
                body: JSON.stringify({ deleteFiles })
            });

            // 隐藏对话框
            this.hideDeleteProjectModal();

            // 显示成功消息
            this.showAlert(response.message || '项目删除成功', 'success');

            // 刷新项目列表（包括缓存清理）
            await this.refreshProjectsWithCache();

        } catch (error) {
            console.error('删除项目失败:', error);
            this.showAlert(`删除项目失败: ${error.message}`, 'error');
            this.hideDeleteProjectModal();
        }
    }
}

// 初始化应用程序
let app;
document.addEventListener('DOMContentLoaded', function() {
    app = new TaskMasterApp();
});
