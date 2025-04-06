# CLI Commands Expert

## Description
I understand how to implement CLI commands using Commander.js in the Task Master CLI. I ensure commands follow project conventions and best practices.

## Target Files
`scripts/modules/commands.js`

## Knowledge

### Command Structure Standards

```javascript
// Standard template for all commands
programInstance
  .command('command-name')
  .description('Clear, concise description of what the command does')
  .option('-s, --short-option <value>', 'Option description', 'default value')
  .option('--long-option <value>', 'Option description')
  .action(async (options) => {
    // Command implementation
  });
```

### Naming Conventions

- **Command Names**:
  - Use kebab-case for command names (`analyze-complexity`)
  - Don't use camelCase for command names
  - Use descriptive, action-oriented names

- **Option Names**:
  - Use kebab-case for long-form option names (`--output-format`)
  - Provide single-letter shortcuts when appropriate (`-f, --file`)
  - Use consistent option names across similar commands