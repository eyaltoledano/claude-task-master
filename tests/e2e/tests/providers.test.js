/**
 * Multi-provider functionality test module
 * Tests add-task operation across all configured providers
 */

export default async function testProviders(logger, helpers, context) {
  const { testDir, config } = context;
  const results = {
    status: 'passed',
    errors: [],
    providerComparison: {},
    summary: {
      totalProviders: 0,
      successfulProviders: 0,
      failedProviders: 0,
      averageExecutionTime: 0,
      successRate: '0%'
    }
  };

  try {
    logger.info('Starting multi-provider tests...');

    const providers = config.providers;
    const standardPrompt = config.prompts.addTask;
    
    results.summary.totalProviders = providers.length;
    let totalExecutionTime = 0;

    // Process providers in batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < providers.length; i += batchSize) {
      const batch = providers.slice(i, i + batchSize);
      
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
          logger.info(`\nTesting provider: ${provider.name} with model: ${provider.model}`);

          // Step 1: Set the main model for this provider
          logger.info(`Setting model to ${provider.model}...`);
          const setModelResult = await helpers.taskMaster('models', ['--set-main', provider.model], { cwd: testDir });
          if (setModelResult.exitCode !== 0) {
            throw new Error(`Failed to set model for ${provider.name}: ${setModelResult.stderr}`);
          }

          // Step 2: Execute add-task with standard prompt
          logger.info(`Adding task with ${provider.name}...`);
          const addTaskArgs = ['--prompt', standardPrompt];
          if (provider.flags && provider.flags.length > 0) {
            addTaskArgs.push(...provider.flags);
          }
          
          const addTaskResult = await helpers.taskMaster('add-task', addTaskArgs, { 
            cwd: testDir,
            timeout: 120000 // 2 minutes timeout for AI tasks
          });
          
          if (addTaskResult.exitCode !== 0) {
            throw new Error(`Add-task failed: ${addTaskResult.stderr}`);
          }

          // Step 3: Extract task ID from output
          const taskId = helpers.extractTaskId(addTaskResult.stdout);
          if (!taskId) {
            throw new Error(`Failed to extract task ID from output`);
          }
          providerResult.taskId = taskId;
          logger.success(`✓ Created task ${taskId} with ${provider.name}`);

          // Step 4: Get task details
          const showResult = await helpers.taskMaster('show', [taskId], { cwd: testDir });
          if (showResult.exitCode === 0) {
            providerResult.taskDetails = showResult.stdout;
            
            // Analyze task features
            providerResult.features.hasTitle = showResult.stdout.includes('Title:') || 
                                               showResult.stdout.includes('Task:');
            providerResult.features.hasDescription = showResult.stdout.includes('Description:');
            providerResult.features.hasSubtasks = showResult.stdout.includes('Subtasks:');
            providerResult.features.hasDependencies = showResult.stdout.includes('Dependencies:');
            
            // Count subtasks
            const subtaskMatches = showResult.stdout.match(/\d+\.\d+/g);
            providerResult.subtaskCount = subtaskMatches ? subtaskMatches.length : 0;
          }

          providerResult.status = 'success';
          results.summary.successfulProviders++;

        } catch (error) {
          providerResult.status = 'failed';
          providerResult.error = error.message;
          results.summary.failedProviders++;
          logger.error(`${provider.name} test failed: ${error.message}`);
        }

        providerResult.executionTime = Date.now() - startTime;
        totalExecutionTime += providerResult.executionTime;
        
        results.providerComparison[provider.name] = providerResult;
      });

      // Wait for batch to complete
      await Promise.all(batchPromises);
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < providers.length) {
        logger.info('Waiting 2 seconds before next batch...');
        await helpers.wait(2000);
      }
    }

    // Calculate summary statistics
    results.summary.averageExecutionTime = Math.round(totalExecutionTime / providers.length);
    results.summary.successRate = `${Math.round((results.summary.successfulProviders / results.summary.totalProviders) * 100)}%`;

    // Log summary
    logger.info('\n=== Provider Test Summary ===');
    logger.info(`Total providers tested: ${results.summary.totalProviders}`);
    logger.info(`Successful: ${results.summary.successfulProviders}`);
    logger.info(`Failed: ${results.summary.failedProviders}`);
    logger.info(`Success rate: ${results.summary.successRate}`);
    logger.info(`Average execution time: ${results.summary.averageExecutionTime}ms`);

    // Determine overall status
    if (results.summary.failedProviders === 0) {
      logger.success('✅ All provider tests passed!');
    } else if (results.summary.successfulProviders > 0) {
      results.status = 'partial';
      logger.warning(`⚠️ ${results.summary.failedProviders} provider(s) failed`);
    } else {
      results.status = 'failed';
      logger.error('❌ All provider tests failed');
    }

  } catch (error) {
    results.status = 'failed';
    results.errors.push({
      test: 'provider tests',
      error: error.message,
      stack: error.stack
    });
    logger.error(`Provider tests failed: ${error.message}`);
  }

  return results;
}