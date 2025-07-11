const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

// Helper function to run task-master commands
async function runTaskMaster(args, options = {}) {
    const taskMasterPath = path.join(__dirname, '../../../scripts/task-master.js');
    const command = `node ${taskMasterPath} ${args.join(' ')}`;
    
    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd: options.cwd || process.cwd(),
            timeout: options.timeout || 30000,
            env: { ...process.env, NODE_ENV: 'test' }
        });
        
        return {
            exitCode: 0,
            stdout: stdout.trim(),
            stderr: stderr.trim()
        };
    } catch (error) {
        return {
            exitCode: error.code || 1,
            stdout: (error.stdout || '').trim(),
            stderr: (error.stderr || error.message || '').trim()
        };
    }
}

// Helper to extract task ID from output
function extractTaskId(output) {
    const idMatch = output.match(/Task #?(\d+(?:\.\d+)?)/i);
    return idMatch ? idMatch[1] : null;
}

// Helper function to wait
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Test configuration
const testConfig = {
    providers: [
        { name: 'OpenAI GPT-4', model: 'openai:gpt-4', flags: [] },
        { name: 'OpenAI GPT-3.5', model: 'openai:gpt-3.5-turbo', flags: [] },
        { name: 'Anthropic Claude 3 Opus', model: 'anthropic:claude-3-opus-20240229', flags: [] },
        { name: 'Anthropic Claude 3 Sonnet', model: 'anthropic:claude-3-sonnet-20240229', flags: [] },
        { name: 'Anthropic Claude 3 Haiku', model: 'anthropic:claude-3-haiku-20240307', flags: [] },
        { name: 'Google Gemini Pro', model: 'google:gemini-pro', flags: [] },
        { name: 'Groq Llama 3 70B', model: 'groq:llama3-70b-8192', flags: [] },
        { name: 'Groq Mixtral', model: 'groq:mixtral-8x7b-32768', flags: [] }
    ],
    prompts: {
        addTask: 'Create a comprehensive plan to build a task management CLI application with file-based storage and AI integration'
    }
};

describe('Multi-Provider Functionality Tests', () => {
    let testDir;
    
    beforeAll(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-master-provider-test-'));
        
        // Initialize task-master in test directory
        const initResult = await runTaskMaster(['init'], { cwd: testDir });
        if (initResult.exitCode !== 0) {
            throw new Error(`Failed to initialize task-master: ${initResult.stderr}`);
        }
    });
    
    afterAll(async () => {
        // Clean up test directory
        if (testDir) {
            await fs.rm(testDir, { recursive: true, force: true });
        }
    });
    
    // Check if any AI API keys are available
    const hasAIKeys = !!(
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GROQ_API_KEY
    );
    
    const testCondition = hasAIKeys ? it : it.skip;
    
    testCondition('should test add-task across multiple AI providers', async () => {
        const results = {
            providerComparison: {},
            summary: {
                totalProviders: 0,
                successfulProviders: 0,
                failedProviders: 0,
                averageExecutionTime: 0,
                successRate: '0%'
            }
        };
        
        // Filter providers based on available API keys
        const availableProviders = testConfig.providers.filter(provider => {
            if (provider.model.startsWith('openai:') && !process.env.OPENAI_API_KEY) return false;
            if (provider.model.startsWith('anthropic:') && !process.env.ANTHROPIC_API_KEY) return false;
            if (provider.model.startsWith('google:') && !process.env.GOOGLE_API_KEY) return false;
            if (provider.model.startsWith('groq:') && !process.env.GROQ_API_KEY) return false;
            return true;
        });
        
        results.summary.totalProviders = availableProviders.length;
        let totalExecutionTime = 0;
        
        // Process providers in batches to avoid rate limits
        const batchSize = 3;
        for (let i = 0; i < availableProviders.length; i += batchSize) {
            const batch = availableProviders.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (provider) => {
                const providerResult = {
                    status: 'failed',
                    taskId: null,
                    executionTime: 0,
                    subtaskCount: 0,
                    features: {
                        hasTitle: false,
                        hasDescription: false,
                        hasSubtasks: false,
                        hasDependencies: false
                    },
                    error: null,
                    taskDetails: null
                };
                
                const startTime = Date.now();
                
                try {
                    console.log(`\nTesting provider: ${provider.name} with model: ${provider.model}`);
                    
                    // Step 1: Set the main model for this provider
                    console.log(`Setting model to ${provider.model}...`);
                    const setModelResult = await runTaskMaster(
                        ['models', '--set-main', provider.model],
                        { cwd: testDir }
                    );
                    expect(setModelResult.exitCode).toBe(0);
                    
                    // Step 2: Execute add-task with standard prompt
                    console.log(`Adding task with ${provider.name}...`);
                    const addTaskArgs = ['add-task', '--prompt', testConfig.prompts.addTask];
                    if (provider.flags && provider.flags.length > 0) {
                        addTaskArgs.push(...provider.flags);
                    }
                    
                    const addTaskResult = await runTaskMaster(addTaskArgs, {
                        cwd: testDir,
                        timeout: 120000 // 2 minutes timeout for AI tasks
                    });
                    
                    expect(addTaskResult.exitCode).toBe(0);
                    
                    // Step 3: Extract task ID from output
                    const taskId = extractTaskId(addTaskResult.stdout);
                    expect(taskId).toBeTruthy();
                    providerResult.taskId = taskId;
                    console.log(`✓ Created task ${taskId} with ${provider.name}`);
                    
                    // Step 4: Get task details
                    const showResult = await runTaskMaster(['show', taskId], { cwd: testDir });
                    expect(showResult.exitCode).toBe(0);
                    
                    providerResult.taskDetails = showResult.stdout;
                    
                    // Analyze task features
                    providerResult.features.hasTitle = 
                        showResult.stdout.includes('Title:') || 
                        showResult.stdout.includes('Task:');
                    providerResult.features.hasDescription = 
                        showResult.stdout.includes('Description:');
                    providerResult.features.hasSubtasks = 
                        showResult.stdout.includes('Subtasks:');
                    providerResult.features.hasDependencies = 
                        showResult.stdout.includes('Dependencies:');
                    
                    // Count subtasks
                    const subtaskMatches = showResult.stdout.match(/\d+\.\d+/g);
                    providerResult.subtaskCount = subtaskMatches ? subtaskMatches.length : 0;
                    
                    providerResult.status = 'success';
                    results.summary.successfulProviders++;
                } catch (error) {
                    providerResult.status = 'failed';
                    providerResult.error = error.message;
                    results.summary.failedProviders++;
                    console.error(`${provider.name} test failed: ${error.message}`);
                }
                
                providerResult.executionTime = Date.now() - startTime;
                totalExecutionTime += providerResult.executionTime;
                
                results.providerComparison[provider.name] = providerResult;
            });
            
            // Wait for batch to complete
            await Promise.all(batchPromises);
            
            // Small delay between batches to avoid rate limits
            if (i + batchSize < availableProviders.length) {
                console.log('Waiting 2 seconds before next batch...');
                await wait(2000);
            }
        }
        
        // Calculate summary statistics
        results.summary.averageExecutionTime = Math.round(
            totalExecutionTime / availableProviders.length
        );
        results.summary.successRate = `${Math.round(
            (results.summary.successfulProviders / results.summary.totalProviders) * 100
        )}%`;
        
        // Log summary
        console.log('\n=== Provider Test Summary ===');
        console.log(`Total providers tested: ${results.summary.totalProviders}`);
        console.log(`Successful: ${results.summary.successfulProviders}`);
        console.log(`Failed: ${results.summary.failedProviders}`);
        console.log(`Success rate: ${results.summary.successRate}`);
        console.log(`Average execution time: ${results.summary.averageExecutionTime}ms`);
        
        // Log provider comparison details
        console.log('\n=== Provider Feature Comparison ===');
        Object.entries(results.providerComparison).forEach(([providerName, result]) => {
            console.log(`\n${providerName}:`);
            console.log(`  Status: ${result.status}`);
            console.log(`  Task ID: ${result.taskId || 'N/A'}`);
            console.log(`  Execution Time: ${result.executionTime}ms`);
            console.log(`  Subtask Count: ${result.subtaskCount}`);
            console.log(`  Features:`);
            console.log(`    - Has Title: ${result.features.hasTitle}`);
            console.log(`    - Has Description: ${result.features.hasDescription}`);
            console.log(`    - Has Subtasks: ${result.features.hasSubtasks}`);
            console.log(`    - Has Dependencies: ${result.features.hasDependencies}`);
            if (result.error) {
                console.log(`  Error: ${result.error}`);
            }
        });
        
        // Assertions
        expect(results.summary.successfulProviders).toBeGreaterThan(0);
        expect(results.summary.successRate).not.toBe('0%');
    }, 300000); // 5 minute timeout for entire test
    
    testCondition('should maintain task quality across different providers', async () => {
        const standardPrompt = 'Create a simple todo list feature with add, remove, and list functionality';
        const providerResults = [];
        
        // Test a subset of providers to check quality consistency
        const testProviders = [
            { name: 'OpenAI GPT-4', model: 'openai:gpt-4' },
            { name: 'Anthropic Claude 3 Sonnet', model: 'anthropic:claude-3-sonnet-20240229' }
        ].filter(provider => {
            if (provider.model.startsWith('openai:') && !process.env.OPENAI_API_KEY) return false;
            if (provider.model.startsWith('anthropic:') && !process.env.ANTHROPIC_API_KEY) return false;
            return true;
        });
        
        for (const provider of testProviders) {
            console.log(`\nTesting quality with ${provider.name}...`);
            
            // Set model
            const setModelResult = await runTaskMaster(
                ['models', '--set-main', provider.model],
                { cwd: testDir }
            );
            expect(setModelResult.exitCode).toBe(0);
            
            // Add task
            const addTaskResult = await runTaskMaster(
                ['add-task', '--prompt', standardPrompt],
                { cwd: testDir, timeout: 60000 }
            );
            expect(addTaskResult.exitCode).toBe(0);
            
            const taskId = extractTaskId(addTaskResult.stdout);
            expect(taskId).toBeTruthy();
            
            // Get task details
            const showResult = await runTaskMaster(['show', taskId], { cwd: testDir });
            expect(showResult.exitCode).toBe(0);
            
            // Analyze quality metrics
            const subtaskCount = (showResult.stdout.match(/\d+\.\d+/g) || []).length;
            const hasDescription = showResult.stdout.includes('Description:');
            const wordCount = showResult.stdout.split(/\s+/).length;
            
            providerResults.push({
                provider: provider.name,
                taskId,
                subtaskCount,
                hasDescription,
                wordCount
            });
        }
        
        // Compare quality metrics
        console.log('\n=== Quality Comparison ===');
        providerResults.forEach(result => {
            console.log(`\n${result.provider}:`);
            console.log(`  Subtasks: ${result.subtaskCount}`);
            console.log(`  Has Description: ${result.hasDescription}`);
            console.log(`  Word Count: ${result.wordCount}`);
        });
        
        // Basic quality assertions
        providerResults.forEach(result => {
            expect(result.subtaskCount).toBeGreaterThan(0);
            expect(result.hasDescription).toBe(true);
            expect(result.wordCount).toBeGreaterThan(50); // Reasonable task detail
        });
    }, 180000); // 3 minute timeout
});