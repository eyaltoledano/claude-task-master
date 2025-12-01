Fix PR review comments: PR # $ARGUMENTS

This command collects all review comments from a GitHub PR (including CodeRabbit, human reviewers, and other bots), consolidates them by author and severity, shows them to you for approval, then implements the approved fixes.

Steps:

1. **Collect PR comments**
   - Run: `gh pr view $ARGUMENTS --comments` to get ALL comments (no truncation)
   - Parse and extract all review comments from:
     - PR review comments (file-level)
     - General comments
     - Review threads
   - Include author information for each comment
   - IMPORTANT: Do NOT use `head`, `tail`, or any truncation - we need complete comment history

2. **Consolidate comments**
   - Group comments by:
     - Author (CodeRabbit, human reviewers, other bots)
     - Severity (🚨 Critical, ⚠️ Important, 💡 Suggestion, ℹ️ Info)
     - Category (Security, Performance, Best Practices, Style, etc.)
   - Remove duplicates and group similar issues
   - Present in a clear, numbered list format showing author for each

3. **Show consolidated issues for approval**
   - Display the organized list with:
     - Issue number for reference
     - Severity indicator
     - File location
     - Description
     - Suggested fix
   - Ask: "Which issues would you like me to fix? (Enter numbers separated by commas, or 'all' for everything)"
   - Wait for user confirmation

4. **Implement approved fixes**
   - For each approved issue:
     - Read the relevant file(s)
     - Implement the suggested fix
     - Log what was changed

5. **Validate changes**
   - Run: `pnpm typecheck`
   - If fails: review errors, fix them, retry
   - Run: `pnpm lint`
   - If fails: review errors, fix them, retry
   - Continue until both pass

6. **Commit and push**
   - Stage changes: `git add .`
   - Create commit: `git commit -m "fix: address review comments from PR #$ARGUMENTS"`
   - Push: `git push`
   - Confirm completion with summary of fixes applied

Notes:
- If no review comments found, inform user and exit
- If typecheck/lint fails after fixes, show errors and ask for guidance
- Keep fixes focused on reviewers' specific suggestions
- Preserve existing code style and patterns
- Group related fixes in the commit message if many changes
- Treat all reviewers equally - human and bot feedback both matter

You previously got all the PR comments in a temporary JSON file and then ran something like this;

cat > /tmp/parse_comments.js << 'EOF'
const fs = require('fs');
const comments = JSON.parse(fs.readFileSync('/tmp/all-pr-comments.json', 'utf8'));

const byFile = {};
const bySeverity = {
  critical: [],
  important: [],
  suggestion: [],
  info: []
};

comments.forEach((c, idx) => {
  const file = c.path;
  const author = c.user.login;
  const line = c.line || c.original_line || 'N/A';
  const body = c.body;
  
  if (!byFile[file]) byFile[file] = [];
  
  const comment = {
    num: idx + 1,
    author,
    line,
    body: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
    fullBody: body
  };
  
  byFile[file].push(comment);
  
  // Categorize by severity
  const lower = body.toLowerCase();
  if (lower.includes('critical') || lower.includes('security') || lower.includes('bug:')) {
    bySeverity.critical.push({...comment, file});
  } else if (lower.includes('important') || lower.includes('error') || lower.includes('fail')) {
    bySeverity.important.push({...comment, file});
  } else if (lower.includes('suggestion') || lower.includes('consider') || lower.includes('recommend')) {
    bySeverity.suggestion.push({...comment, file});
  } else {
    bySeverity.info.push({...comment, file});
  }
});

console.log('\n=== SUMMARY BY SEVERITY ===\n');
console.log(`🚨 Critical: ${bySeverity.critical.length}`);
console.log(`⚠️  Important: ${bySeverity.important.length}`);
console.log(`💡 Suggestion: ${bySeverity.suggestion.length}`);
console.log(`ℹ️  Info: ${bySeverity.info.length}`);

console.log('\n=== SUMMARY BY FILE ===\n');
Object.entries(byFile)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([file, comments]) => {
    console.log(`${file}: ${comments.length} comments`);
  });

console.log('\n=== CRITICAL ISSUES ===\n');
bySeverity.critical.forEach(c => {
  console.log(`\n#${c.num} [${c.author}] ${c.file}:${c.line}`);
  console.log(c.body);
});

console.log('\n=== IMPORTANT ISSUES ===\n');
bySeverity.important.slice(0, 10).forEach(c => {
  console.log(`\n#${c.num} [${c.author}] ${c.file}:${c.line}`);
  console.log(c.body);
});
EOF
node /tmp/parse_comments.js

And got a nice report you could act on.