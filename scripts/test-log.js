#!/usr/bin/env node

console.log('This is a test script');
console.log('Current directory:', process.cwd());
console.log('Arguments:', process.argv);

try {
  const fs = require('fs');
  console.log('Files in current directory:', fs.readdirSync('.'));
} catch (error) {
  console.error('Error reading directory:', error);
}

console.log('Test script completed successfully.'); 