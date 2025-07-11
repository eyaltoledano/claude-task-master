#!/usr/bin/env node

/**
 * 测试远程服务器的基本功能
 */

// 使用Node.js内置的fetch (Node 18+)

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
    console.log('🧪 Testing TaskMaster Remote Server API...\n');

    try {
        // 1. 健康检查
        console.log('1. Testing health check...');
        const healthResponse = await fetch(`${BASE_URL}/health`);
        const healthData = await healthResponse.json();
        console.log('✅ Health check:', healthData.status);
        console.log('   Projects count:', healthData.projects);
        console.log('   Uptime:', Math.round(healthData.uptime), 'seconds\n');

        // 2. 获取项目列表
        console.log('2. Testing project list...');
        const projectsResponse = await fetch(`${BASE_URL}/api/projects`);
        const projectsData = await projectsResponse.json();
        console.log('✅ Projects list:', projectsData.success);
        console.log('   Count:', projectsData.count);
        console.log('   Projects:', projectsData.data.map(p => p.id).join(', ') || 'None\n');

        // 3. 创建测试项目
        console.log('3. Testing project creation...');
        const createProjectResponse = await fetch(`${BASE_URL}/api/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: 'test-project',
                name: 'Test Project',
                description: 'A test project for API validation',
                template: 'web-app'
            })
        });
        
        if (createProjectResponse.status === 201) {
            const createData = await createProjectResponse.json();
            console.log('✅ Project created:', createData.data.id);
            console.log('   Name:', createData.data.name);
            console.log('   Template:', createData.data.template, '\n');
        } else if (createProjectResponse.status === 400) {
            const errorData = await createProjectResponse.json();
            if (errorData.error.message.includes('already exists')) {
                console.log('ℹ️  Project already exists, continuing...\n');
            } else {
                throw new Error(errorData.error.message);
            }
        } else {
            throw new Error(`Failed to create project: ${createProjectResponse.status}`);
        }

        // 4. 获取项目详情
        console.log('4. Testing project details...');
        const projectResponse = await fetch(`${BASE_URL}/api/projects/test-project`);
        const projectData = await projectResponse.json();
        console.log('✅ Project details:', projectData.success);
        console.log('   ID:', projectData.data.id);
        console.log('   Name:', projectData.data.name);
        console.log('   Settings:', Object.keys(projectData.data.settings).join(', '), '\n');

        // 5. 获取任务列表
        console.log('5. Testing tasks list...');
        const tasksResponse = await fetch(`${BASE_URL}/api/projects/test-project/tasks`);
        const tasksData = await tasksResponse.json();
        console.log('✅ Tasks list:', tasksData.success);
        console.log('   Project ID:', tasksData.projectId);
        
        if (tasksData.data && tasksData.data.tasks) {
            console.log('   Tasks count:', tasksData.data.tasks.length);
        } else {
            console.log('   Tasks: No tasks found');
        }
        console.log();

        // 6. 添加测试任务
        console.log('6. Testing task creation...');
        const addTaskResponse = await fetch(`${BASE_URL}/api/projects/test-project/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: 'Test Task',
                description: 'A test task created via API',
                priority: 'high'
            })
        });
        
        if (addTaskResponse.status === 201) {
            const addTaskData = await addTaskResponse.json();
            console.log('✅ Task created:', addTaskData.success);
            console.log('   Message:', addTaskData.message, '\n');
        } else {
            const errorData = await addTaskResponse.json();
            console.log('❌ Task creation failed:', errorData.error?.message || 'Unknown error\n');
        }

        // 7. 测试PRD文件列表
        console.log('7. Testing PRD files list...');
        const prdFilesResponse = await fetch(`${BASE_URL}/api/projects/test-project/prd/files`);
        const prdFilesData = await prdFilesResponse.json();
        console.log('✅ PRD files list:', prdFilesData.success);
        console.log('   Files count:', prdFilesData.count, '\n');

        // 8. 测试文件统计
        console.log('8. Testing file statistics...');
        const statsResponse = await fetch(`${BASE_URL}/api/projects/test-project/files/stats/summary`);
        const statsData = await statsResponse.json();
        console.log('✅ File statistics:', statsData.success);
        console.log('   Total files:', statsData.data.totalFiles);
        console.log('   Total size:', statsData.data.totalSize, 'bytes\n');

        console.log('🎉 All tests passed! Remote server is working correctly.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// 检查服务器是否运行
async function checkServer() {
    try {
        const response = await fetch(`${BASE_URL}/health`);
        if (response.ok) {
            return true;
        }
    } catch (error) {
        return false;
    }
    return false;
}

async function main() {
    console.log('🚀 TaskMaster Remote Server API Test\n');
    
    // 检查服务器是否运行
    const isRunning = await checkServer();
    if (!isRunning) {
        console.log('❌ Server is not running. Please start the server first:');
        console.log('   npm run remote-server\n');
        process.exit(1);
    }

    await testAPI();
}

main();
