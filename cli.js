// cli.js
import parsePRD from './scripts/modules/task-manager/parse-prd.js';
import path from 'path';

async function main() {
  const prdPath = path.resolve('./my-prd.txt');        // created as a sample
  const tasksPath = path.resolve('./tasks.json');      // Output JSON file path 
  const numTasks = 10;                                 // Assuming

  try {
    const result = await parsePRD(prdPath, tasksPath, numTasks, {
      force: true,      
      append: false,    
      research: false,  
      reportProgress: (msg) => console.log('[Progress]', msg)
    });

    console.log('Parse PRD success:', result);
  } catch (err) {
    console.error('Error during PRD parsing:', err);
  }
}

main();
