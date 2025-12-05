# Security Controls for AI Tools

All file system tools are secured against directory traversal and unauthorized access.

## Security Model

| Tool Category | Allowed Paths | On Violation |
|--------------|---------------|--------------|
| **File Operations** (`projectTreeTool`, `fileReadTool`, `grepTool`) | Project root only | Throws error |
| **Skills Loader** | Project root, `~/.claude/skills/`, `~/.cortex/skills/` | Silent skip + warning |
| **TaskMaster Tools** | `.taskmaster/` within project | N/A (hardcoded paths) |
| **Web Research** | Any URL | N/A (by design) |

## Path Validation

```typescript
// File operations - strict, throws on violation
function safeResolvePath(inputPath: string, projectRoot: string): string {
    const targetPath = path.isAbsolute(inputPath) ? inputPath : path.join(projectRoot, inputPath);
    const resolved = path.resolve(targetPath);
    if (!resolved.startsWith(path.resolve(projectRoot) + path.sep)) {
        throw new Error(`Access denied: path "${inputPath}" is outside project root`);
    }
    return resolved;
}
```

## Attack Protection

| Attack | Result |
|--------|--------|
| Absolute paths (`/etc/passwd`) | ❌ Rejected |
| Directory traversal (`../../etc`) | ❌ Rejected |
| Tilde escape (`~/../root/.ssh`) | ❌ Rejected |
| Symlinks outside root | ❌ Rejected |
| Binary/large files | 🔕 Skipped |
| `.env` files | 🔕 Skipped |

## Default Ignore List

```
node_modules, .git, dist, coverage, __pycache__, .next, build, .env, .DS_Store, *-lock.json, *.lock, pnpm-lock.yaml
```

## Adding New Tools

1. Validate all paths with `safeResolvePath()` before file operations
2. Add security tests for path rejection
3. Document allowed paths in tool descriptions

---
**Last Updated**: December 2024
