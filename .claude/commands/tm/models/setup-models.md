Run interactive setup to configure AI models.

## Interactive Model Configuration

Guides you through setting up AI providers for Task Master.

## Execution

```bash
task-master models --setup
```

## Setup Process

1. **Environment Check**
   - Detect existing API keys
   - Show current configuration
   - Identify missing providers

2. **Provider Selection**
   - Choose main provider (required)
   - Select research provider (recommended)
   - Configure fallback (optional)

3. **API Key Configuration**
   - Prompt for missing keys
   - Validate key format
   - Test connectivity
   - Save configuration

## Smart Recommendations

Based on your needs:
- **For best results**: Claude + Perplexity
- **Budget conscious**: GPT-3.5 + Perplexity
- **Maximum capability**: GPT-4 + Perplexity + Claude fallback

## Configuration Storage

Keys can be stored in:
1. Environment variables (recommended)
2. `.env` file in project
3. Global `.taskmaster/config`

## Post-Setup

After configuration:
- Test each provider
- Show usage examples
- Suggest next steps
- Verify parse-prd works