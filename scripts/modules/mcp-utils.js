import fs from 'fs';
import path from 'path';
import { log } from './utils.js';

// Structure matches project conventions (see scripts/init.js)
export function setupMCPConfiguration(brandDir) {
    const mcpPath = path.join(brandDir, 'mcp.json');
    const mcpConfig = {
        "task-master-ai": {
            command: "npx",
            args: ["-y", "--package=task-master-ai", "task-master-ai"],
            env: {
                ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY_HERE",
                PERPLEXITY_API_KEY: "PERPLEXITY_API_KEY_HERE",
                OPENAI_API_KEY: "OPENAI_API_KEY_HERE",
                GOOGLE_API_KEY: "GOOGLE_API_KEY_HERE",
                XAI_API_KEY: "XAI_API_KEY_HERE",
                OPENROUTER_API_KEY: "OPENROUTER_API_KEY_HERE",
                MISTRAL_API_KEY: "MISTRAL_API_KEY_HERE",
                AZURE_OPENAI_API_KEY: "AZURE_OPENAI_API_KEY_HERE"
            }
        }
    };
    try {
        fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));
        log('success', `Created MCP configuration: ${mcpPath}`);
    } catch (e) {
        log('warn', `Failed to create MCP configuration at ${mcpPath}: ${e.message}`);
    }
}
