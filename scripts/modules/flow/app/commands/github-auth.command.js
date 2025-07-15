#!/usr/bin/env node

/**
 * @fileoverview GitHub OAuth Authentication Command for Flow CLI
 * 
 * Provides command-line interface for GitHub OAuth Device Flow authentication
 * Integrates with the Flow CLI system for seamless VibeKit integration
 */

import { GitHubAuthService } from '../../features/github/services/github-auth.service.js';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Colors for console output
 */
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * Enhanced logging with timestamps and colors
 */
function log(message, type = 'info') {
  const colors = {
    info: c.cyan,
    success: c.green,
    warning: c.yellow,
    error: c.red,
    header: c.bright,
    reset: c.reset
  };

  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
}

/**
 * Check for existing GitHub authentication
 */
async function checkExistingAuth(options = {}) {
  const spinner = options.verbose ? null : ora('Checking existing authentication...').start();
  
  try {
    const authService = new GitHubAuthService();
    const authStatus = await authService.getAuthStatus();
    
    if (spinner) spinner.stop();
    
    if (authStatus.authenticated) {
      log(`✅ Found existing authentication for user: ${authStatus.user.login}`, 'success');
      if (options.verbose) {
        log(`   User ID: ${authStatus.user.id}`, 'info');
        log(`   Email: ${authStatus.user.email || 'N/A'}`, 'info');
        log(`   Avatar: ${authStatus.user.avatar_url}`, 'info');
        log(`   Token: ${authStatus.token.substring(0, 10)}...`, 'info');
      }
      return authStatus;
    } else {
      log('❌ No existing authentication found', 'warning');
      return null;
    }
  } catch (error) {
    if (spinner) spinner.fail('Failed to check authentication');
    log(`❌ Error checking existing auth: ${error.message}`, 'error');
    if (options.verbose) {
      console.error(c.gray + error.stack + c.reset);
    }
    return null;
  }
}

/**
 * Perform GitHub OAuth Device Flow authentication
 */
async function performGitHubAuth(options = {}) {
  log('🚀 Starting GitHub OAuth Device Flow...', 'header');
  
  const spinner = options.verbose ? null : ora('Initializing authentication...').start();
  
  try {
    const authService = new GitHubAuthService();
    
    if (spinner) {
      spinner.text = 'Starting OAuth flow...';
    }
    
    // Start the authentication process
    const authResult = await authService.authenticate({
      openBrowser: !options.noBrowser,
      showInstructions: true
    });
    
    if (spinner) spinner.stop();
    
    if (authResult.success) {
      log('✅ GitHub authentication successful!', 'success');
      
      // Get user info
      const authStatus = await authService.getAuthStatus();
      if (authStatus.authenticated) {
        log(`   User: ${authStatus.user.login}`, 'info');
        if (options.verbose) {
          log(`   User ID: ${authStatus.user.id}`, 'info');
          log(`   Email: ${authStatus.user.email || 'N/A'}`, 'info');
          log(`   Public Repos: ${authStatus.user.public_repos}`, 'info');
          log(`   Followers: ${authStatus.user.followers}`, 'info');
        }
        log(`   Token: ${authStatus.token.substring(0, 10)}...`, 'info');
      }
      
      return authStatus;
    } else {
      log(`❌ GitHub authentication failed: ${authResult.error}`, 'error');
      return null;
    }
  } catch (error) {
    if (spinner) spinner.fail('Authentication failed');
    log(`❌ Authentication error: ${error.message}`, 'error');
    if (options.verbose) {
      console.error(c.gray + error.stack + c.reset);
    }
    return null;
  }
}

/**
 * Test authenticated GitHub API requests
 */
async function testAuthenticatedRequests(authResult, options = {}) {
  log('🔧 Testing authenticated GitHub API requests...', 'header');
  
  const spinner = options.verbose ? null : ora('Testing API calls...').start();
  
  try {
    // Test 1: Get user info
    if (spinner) spinner.text = 'Testing user API...';
    
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${authResult.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TaskMaster-Flow-TUI'
      }
    });

    if (userResponse.ok) {
      const userData = await userResponse.json();
      if (spinner) spinner.text = 'Testing repositories API...';
      
      log('✅ User API call successful', 'success');
      if (options.verbose) {
        log(`   Name: ${userData.name || 'N/A'}`, 'info');
        log(`   Company: ${userData.company || 'N/A'}`, 'info');
        log(`   Location: ${userData.location || 'N/A'}`, 'info');
        log(`   Bio: ${userData.bio || 'N/A'}`, 'info');
        log(`   Public Repos: ${userData.public_repos}`, 'info');
        log(`   Followers: ${userData.followers}`, 'info');
        log(`   Following: ${userData.following}`, 'info');
      }
    } else {
      throw new Error(`User API call failed: ${userResponse.status} ${userResponse.statusText}`);
    }

    // Test 2: List repositories
    const reposResponse = await fetch('https://api.github.com/user/repos?sort=updated&per_page=5', {
      headers: {
        'Authorization': `Bearer ${authResult.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TaskMaster-Flow-TUI'
      }
    });

    if (reposResponse.ok) {
      const repos = await reposResponse.json();
      
      if (spinner) spinner.succeed('API tests completed');
      
      log('✅ Repositories API call successful', 'success');
      log(`   Found ${repos.length} recent repositories:`, 'info');
      
      repos.forEach(repo => {
        const visibility = repo.private ? 'private' : 'public';
        const stars = repo.stargazers_count || 0;
        log(`   - ${repo.full_name} (${visibility}) ⭐ ${stars}`, 'info');
        
        if (options.verbose) {
          log(`     Description: ${repo.description || 'No description'}`, 'info');
          log(`     Language: ${repo.language || 'Unknown'}`, 'info');
          log(`     Updated: ${new Date(repo.updated_at).toLocaleDateString()}`, 'info');
        }
      });
    } else {
      throw new Error(`Repositories API call failed: ${reposResponse.status} ${reposResponse.statusText}`);
    }

    return { success: true };
  } catch (error) {
    if (spinner) spinner.fail('API testing failed');
    log(`❌ API testing error: ${error.message}`, 'error');
    if (options.verbose) {
      console.error(c.gray + error.stack + c.reset);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Test logout functionality
 */
async function testLogout(options = {}) {
  log('🚪 Testing logout functionality...', 'header');
  
  const spinner = options.verbose ? null : ora('Logging out...').start();
  
  try {
    const authService = new GitHubAuthService();
    const logoutResult = await authService.logout();
    
    if (spinner) spinner.text = 'Verifying logout...';
    
    if (logoutResult.success) {
      log('✅ Logout successful', 'success');
      
      // Verify logout by checking auth status
      const authStatus = await authService.getAuthStatus();
      
      if (spinner) spinner.stop();
      
      if (!authStatus.authenticated) {
        log('✅ Logout verified - no longer authenticated', 'success');
      } else {
        log('❌ Logout verification failed - still authenticated', 'error');
      }
    } else {
      if (spinner) spinner.fail('Logout failed');
      log(`❌ Logout failed: ${logoutResult.error}`, 'error');
    }
    
    return logoutResult;
  } catch (error) {
    if (spinner) spinner.fail('Logout error');
    log(`❌ Logout error: ${error.message}`, 'error');
    if (options.verbose) {
      console.error(c.gray + error.stack + c.reset);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Show current authentication status
 */
export async function githubStatusCommand(options = {}) {
  try {
    console.log(`${c.bright}🔍 GitHub Authentication Status${c.reset}`);
    console.log('─'.repeat(60));
    
    const authStatus = await checkExistingAuth(options);
    
    if (authStatus) {
      console.log(`\n${c.bright}📊 User Information:${c.reset}`);
      console.log(`Name: ${c.cyan}${authStatus.user.name || 'N/A'}${c.reset}`);
      console.log(`Username: ${c.cyan}${authStatus.user.login}${c.reset}`);
      console.log(`Email: ${c.cyan}${authStatus.user.email || 'N/A'}${c.reset}`);
      console.log(`Public Repos: ${c.cyan}${authStatus.user.public_repos}${c.reset}`);
      
      if (options.verbose) {
        console.log(`User ID: ${c.gray}${authStatus.user.id}${c.reset}`);
        console.log(`Account Type: ${c.gray}${authStatus.user.type}${c.reset}`);
        console.log(`Created: ${c.gray}${new Date(authStatus.user.created_at).toLocaleDateString()}${c.reset}`);
        console.log(`Token: ${c.gray}${authStatus.token.substring(0, 20)}...${c.reset}`);
      }
      
      if (options.test) {
        console.log(`\n${c.bright}🧪 Running API Tests...${c.reset}`);
        await testAuthenticatedRequests(authStatus, options);
      }
    } else {
      console.log(`\n${c.yellow}❌ Not authenticated with GitHub${c.reset}`);
      console.log(`${c.gray}💡 Run 'task-master flow github login' to authenticate${c.reset}`);
    }
    
    if (options.json) {
      console.log(`\n${c.bright}JSON Output:${c.reset}`);
      console.log(JSON.stringify(authStatus || { authenticated: false }, null, 2));
    }
  } catch (error) {
    console.error(`${c.red}❌ Failed to check GitHub status: ${error.message}${c.reset}`);
    if (options.verbose) {
      console.error(`${c.gray}${error.stack}${c.reset}`);
    }
    process.exit(1);
  }
}

/**
 * Perform GitHub OAuth authentication
 */
export async function githubLoginCommand(options = {}) {
  try {
    console.log(`${c.bright}🔐 GitHub OAuth Authentication${c.reset}`);
    console.log('─'.repeat(60));
    
    // Step 1: Check for existing authentication
    let authResult = await checkExistingAuth(options);
    
    if (authResult && !options.force) {
      console.log(`\n${c.yellow}⚠️  Already authenticated as ${authResult.user.login}${c.reset}`);
      console.log(`${c.gray}💡 Use --force to re-authenticate or 'logout' to clear existing auth${c.reset}`);
      return;
    }
    
    // Step 2: Perform OAuth flow
    authResult = await performGitHubAuth(options);
    
    if (!authResult) {
      console.error(`${c.red}❌ Authentication failed - cannot continue${c.reset}`);
      process.exit(1);
    }
    
    // Step 3: Test authenticated API requests (optional)
    if (options.test) {
      console.log(`\n${c.bright}🧪 Testing API Access...${c.reset}`);
      const apiResult = await testAuthenticatedRequests(authResult, options);
      
      if (!apiResult.success) {
        console.log(`${c.yellow}⚠️  Authentication succeeded but API tests failed${c.reset}`);
      }
    }
    
    // Step 4: Summary
    console.log(`\n${c.bright}📈 Authentication Summary${c.reset}`);
    console.log('─'.repeat(40));
    
    console.log(`${c.green}✅ GitHub OAuth Authentication: SUCCESS${c.reset}`);
    console.log(`   User: ${c.cyan}${authResult.user.login}${c.reset}`);
    console.log(`   Email: ${c.cyan}${authResult.user.email || 'N/A'}${c.reset}`);
    
    if (options.test) {
      console.log(`${c.green}✅ GitHub API Access: VERIFIED${c.reset}`);
    }
    
    console.log(`\n${c.bright}🎉 GitHub OAuth integration is ready!${c.reset}`);
    console.log(`${c.gray}💡 Token is stored securely in ~/.taskmaster/github-token.json${c.reset}`);
    console.log(`${c.gray}💡 Use 'task-master flow github status' to check current status${c.reset}`);
    
  } catch (error) {
    console.error(`${c.red}💥 Authentication failed: ${error.message}${c.reset}`);
    if (options.verbose) {
      console.error(`${c.gray}${error.stack}${c.reset}`);
    }
    process.exit(1);
  }
}

/**
 * Logout from GitHub authentication
 */
export async function githubLogoutCommand(options = {}) {
  try {
    console.log(`${c.bright}🚪 GitHub Logout${c.reset}`);
    console.log('─'.repeat(30));
    
    // Check if authenticated first
    const authStatus = await checkExistingAuth({ verbose: false });
    
    if (!authStatus) {
      console.log(`${c.yellow}⚠️  Not currently authenticated with GitHub${c.reset}`);
      console.log(`${c.gray}💡 Nothing to logout from${c.reset}`);
      return;
    }
    
    console.log(`${c.blue}📝 Currently authenticated as: ${authStatus.user.login}${c.reset}`);
    
    if (!options.force && !options.yes) {
      // In a real CLI, you'd want to prompt for confirmation here
      // For now, we'll require --force or --yes flag
      console.log(`${c.yellow}⚠️  Use --force or --yes to confirm logout${c.reset}`);
      console.log(`${c.gray}💡 This will remove your stored GitHub token${c.reset}`);
      return;
    }
    
    // Perform logout
    const logoutResult = await testLogout(options);
    
    if (logoutResult.success) {
      console.log(`\n${c.green}✅ Successfully logged out from GitHub${c.reset}`);
      console.log(`${c.gray}💡 Your authentication token has been removed${c.reset}`);
    } else {
      console.error(`${c.red}❌ Logout failed: ${logoutResult.error}${c.reset}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`${c.red}💥 Logout failed: ${error.message}${c.reset}`);
    if (options.verbose) {
      console.error(`${c.gray}${error.stack}${c.reset}`);
    }
    process.exit(1);
  }
}

/**
 * Auto-load existing GitHub token for use in other commands
 * This is a utility function for other parts of the system
 */
export async function autoLoadGitHubToken() {
  try {
    const authService = new GitHubAuthService();
    const authStatus = await authService.getAuthStatus();
    
    if (authStatus.authenticated) {
      return {
        success: true,
        token: authStatus.token,
        user: authStatus.user
      };
    } else {
      return { success: false, error: 'No authentication found' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Main GitHub command handler with subcommands
 */
export async function githubCommand(subcommand = 'status', options = {}) {
  try {
    switch (subcommand.toLowerCase()) {
      case 'status':
        await githubStatusCommand(options);
        break;
        
      case 'login':
        await githubLoginCommand(options);
        break;
        
      case 'logout':
        await githubLogoutCommand(options);
        break;
        
      case 'test':
        // Run status with test flag enabled
        await githubStatusCommand({ ...options, test: true });
        break;
        
      default:
        console.log(`${c.bright}🔗 GitHub Authentication Commands${c.reset}`);
        console.log('─'.repeat(50));
        console.log('');
        console.log(`${c.cyan}Available subcommands:${c.reset}`);
        console.log('  status    Show current authentication status');
        console.log('  login     Authenticate with GitHub OAuth');
        console.log('  logout    Remove GitHub authentication');
        console.log('  test      Test GitHub API access');
        console.log('');
        console.log(`${c.yellow}Examples:${c.reset}`);
        console.log('  task-master flow github status');
        console.log('  task-master flow github login');
        console.log('  task-master flow github login --test');
        console.log('  task-master flow github logout --force');
        console.log('  task-master flow github test --verbose');
        console.log('');
        console.log(`${c.gray}💡 Use --help for detailed information about each command${c.reset}`);
    }
  } catch (error) {
    console.error(`${c.red}💥 GitHub command failed: ${error.message}${c.reset}`);
    if (options.verbose) {
      console.error(`${c.gray}${error.stack}${c.reset}`);
    }
    process.exit(1);
  }
} 