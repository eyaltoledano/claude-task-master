Initialize a new Task Master project.

Arguments: $ARGUMENTS

Parse arguments to determine initialization preferences.

## Initialization Process

1. **Parse Arguments**
   - PRD file path (if provided)
   - Project name
   - Auto-confirm flag (-y)

2. **Project Setup**
   ```bash
   task-master init
   ```

3. **Smart Initialization**
   - Detect existing project files
   - Suggest project name from directory
   - Check for git repository
   - Verify AI provider configuration

## Configuration Options

Based on arguments:
- `quick` / `-y` → Skip confirmations
- `<file.md>` → Use as PRD after init
- `--name=<name>` → Set project name
- `--description=<desc>` → Set description

## Post-Initialization

After successful init:
1. Show project structure created
2. Verify AI models configured
3. Suggest next steps:
   - Parse PRD if available
   - Configure AI providers
   - Set up git hooks
   - Create first tasks

## Integration

If PRD file provided:
```
/taskmaster:init my-prd.md
→ Automatically runs parse-prd after init
```