import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import chalk from 'chalk';

dotenv.config();

/**
 * Test OpenRouter connection and analyze token limits
 * This helps users validate their OpenRouter configuration before using it for task generation
 */
async function testOpenRouter() {
  console.log(chalk.blue('Testing OpenRouter connection and token limits...'));
  
  if (!process.env.OPENROUTER_API_KEY) {
    console.error(chalk.red('Error: OPENROUTER_API_KEY is not set in your .env file'));
    console.log('Please add your OpenRouter API key to the .env file:');
    console.log('OPENROUTER_API_KEY=your_openrouter_api_key');
    return;
  }
  
  if (process.env.USE_OPENROUTER !== 'true') {
    console.warn(chalk.yellow('Warning: USE_OPENROUTER is not set to true in your .env file'));
    console.log('For full integration testing, change this setting:');
    console.log('USE_OPENROUTER=true');
  }
  
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku';
  const maxTokens = parseInt(process.env.OPENROUTER_MAX_TOKENS || '800');
  
  console.log(`Configuration:`);
  console.log(`- Model: ${chalk.green(model)}`);
  console.log(`- Max tokens: ${chalk.green(maxTokens)}`);
  
  try {
    const openRouter = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/eyaltoledano/claude-task-master',
        'X-Title': 'Claude Task Master'
      }
    });
    
    console.log('\nChecking available models...');
    const models = await openRouter.models.list();
    
    // Find the current model in the list
    const selectedModel = models.data.find(m => m.id === model);
    
    if (selectedModel) {
      console.log(chalk.green(`Found selected model: ${selectedModel.id}`));
      if (selectedModel.context_length) {
        console.log(`- Context length: ${chalk.cyan(selectedModel.context_length)} tokens`);
      }
      console.log(`- Provider: ${chalk.cyan(selectedModel.owned_by)}`);
    } else {
      console.log(chalk.yellow(`Warning: Selected model "${model}" not found in available models`));
      console.log('Available models from your plan:');
      models.data.slice(0, 5).forEach(m => {
        console.log(`- ${m.id} (${m.owned_by})`);
      });
      if (models.data.length > 5) {
        console.log(`... and ${models.data.length - 5} more`);
      }
    }
    
    console.log('\nSending a token limit test to OpenRouter...');
    
    // First test with a small request to ensure basic functionality
    const basicResponse = await openRouter.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: 'Say hello in exactly 5 words' }],
      max_tokens: 20,
    });
    
    console.log('\nBasic Response from OpenRouter:');
    console.log(chalk.green(basicResponse.choices[0].message.content));
    
    // Now test token limits with a larger request
    // This will help identify if the configured max_tokens is valid
    console.log('\nTesting token limits with configured max_tokens:', maxTokens);
    
    try {
      const response = await openRouter.chat.completions.create({
        model: model,
        messages: [{ 
          role: 'user', 
          content: `
          Please provide a detailed summary of DevSecOps best practices. Include information about:
          - Secure coding practices
          - Continuous integration security checks
          - Container security scanning
          - Infrastructure as code security validation
          - Security monitoring and observability
          - Compliance automation
          - Secret management
          - Role-based access control
          
          Make the response as detailed as possible, using all available tokens.
          `
        }],
        max_tokens: maxTokens,
      });
      
      const contentLength = response.choices[0].message.content.length;
      const estimatedTokens = Math.round(contentLength / 4); // Rough token estimation
      
      console.log('\nToken Limit Test Results:');
      console.log(`- Response length: ${chalk.green(contentLength)} characters`);
      console.log(`- Estimated tokens: ${chalk.green(estimatedTokens)} (rough estimate)`);
      console.log(`- Configured max tokens: ${chalk.green(maxTokens)}`);
      
      const tokenUsageRatio = estimatedTokens / maxTokens;
      
      if (tokenUsageRatio > 0.9) {
        console.log(chalk.green('✓ Your token limit appears to be correctly configured.'));
      } else if (tokenUsageRatio < 0.5) {
        console.log(chalk.yellow('⚠️ Your response was significantly shorter than the configured token limit.'));
        console.log('This may indicate your OpenRouter plan has a lower limit than configured.');
        console.log(`Try setting OPENROUTER_MAX_TOKENS to around ${estimatedTokens} in your .env file.`);
      }
      
      console.log('\nSuccess! OpenRouter is working correctly with your configuration.');
      console.log('\nRecommendations for Claude Task Master usage:');
      
      if (maxTokens < 1000) {
        console.log(chalk.yellow('⚠️ Your current token limit is very low for complex task operations.'));
        console.log('Consider:');
        console.log('1. Using direct Anthropic API for task generation and expansion');
        console.log('2. Using OpenRouter only for simpler operations');
        console.log('3. Upgrading your OpenRouter plan for higher token limits');
      } else if (maxTokens < 4000) {
        console.log(chalk.yellow('⚠️ Your token limit may be insufficient for complex task expansion.'));
        console.log('Consider using smaller task counts and simpler descriptions.');
      } else {
        console.log(chalk.green('✓ Your token limit should be sufficient for most Task Master operations.'));
      }
      
    } catch (error) {
      console.error(chalk.red('\nError testing token limits:'));
      console.error(error.message);
      console.log('This may indicate your configured max_tokens exceeds your plan\'s limits.');
      
      if (error.message.includes('token')) {
        console.log(chalk.yellow('\nTry reducing OPENROUTER_MAX_TOKENS in your .env file.'));
      }
    }
    
  } catch (error) {
    console.error(chalk.red('Error connecting to OpenRouter:'));
    console.error(error.message);
    
    if (error.message.includes('authentication')) {
      console.log('Please check your OPENROUTER_API_KEY in the .env file.');
    }
  }
}

testOpenRouter(); 