/**
 * @fileoverview View Models Slash Command
 * View current AI model configuration.
 */

import { staticCommand } from '../../factories.js';

/**
 * The view-models slash command - View Models
 *
 * View current AI model configuration.
 */
export const viewModels = staticCommand({
	name: 'view-models',
	description: 'View Models',
	content: `View current AI model configuration.

## Model Configuration Display

Shows the currently configured AI providers and models for Task Master.

## Execution

\`\`\`bash
task-master models
\`\`\`

## Information Displayed

1. **Main Provider**
   - Model ID and name
   - API key status (configured/missing)
   - Usage: Primary task generation

2. **Research Provider**
   - Model ID and name
   - API key status
   - Usage: Enhanced research mode

3. **Fallback Provider**
   - Model ID and name
   - API key status
   - Usage: Backup when main fails

## Visual Status

\`\`\`
Task Master AI Model Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Main:     ✅ claude-3-5-sonnet (configured)
Research: ✅ perplexity-sonar (configured)
Fallback: ⚠️  Not configured (optional)

Available Models:
- claude-3-5-sonnet
- gpt-4-turbo
- gpt-3.5-turbo
- perplexity-sonar
\`\`\`

## Next Actions

Based on configuration:
- If missing API keys → Suggest setup
- If no research model → Explain benefits
- If all configured → Show usage tips`,
	mode: 'solo'
});
