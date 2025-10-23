Quick Fix Plan: Bridge update-task to Storage Factory (2-3 hours)

     Problem

     - update-task still uses old direct file reading (readJSON, writeJSON)
     - Needs to work with both file storage (local tasks.json) and API storage (Hamster)
     - set-status already works with new system as a reference

     Solution: Hacky Bridge Pattern

     Create a thin adapter layer that:
     1. Uses tm-core's storage factory for read/write
     2. Keeps all the existing AI logic in the old scripts
     3. Minimal code changes for max speed

     ---
     Implementation Steps (Estimated 2-3 hours)

     Step 1: Add Simple Update Method to Storage Layer (30 min)

     - Storage interface already has updateTask(taskId, updates, tag) ✅
     - Just need to verify both FileStorage and ApiStorage implement it
     - They already do! So SKIP this step

     Step 2: Create Bridge Helper in MCP Direct Function (1 hour)

     Modify mcp-server/src/core/direct-functions/update-task-by-id.js:

     // NEW: Import tm-core
     import { createTmCore } from '@tm/core';

     export async function updateTaskByIdDirect(args, log, context = {}) {
       // ... existing validation ...
       
       // NEW: Initialize tm-core for storage
       const tmCore = await createTmCore({
         projectPath: projectRoot
       });
       
       // NEW: Load task using storage factory (handles both file & API)
       const task = await tmCore.tasks.get(taskId, tag);
       if (!task) {
         return { success: false, error: 'Task not found' };
       }
       
       // EXISTING: Call the old AI logic
       const coreResult = await updateTaskById(
         tasksPath, // Still pass this for now
         taskId,
         prompt,
         useResearch,
         context,
         'json',
         append
       );
       
       // NEW: Save using storage factory instead of writeJSON
       if (coreResult && coreResult.updatedTask) {
         await tmCore.storage.updateTask(
           taskId,
           coreResult.updatedTask, // partial updates
           tag
         );
       }
       
       return coreResult;
     }

     Step 3: Test Both Storage Types (30 min)

     - Test with file storage (local tasks.json)
     - Test with API storage (Hamster - if available)
     - Verify MCP tool works end-to-end

     Step 4: Same Pattern for update-subtask (45 min)

     - Apply identical bridge pattern to update-subtask-by-id.js
     - Reuse the same approach

     ---
     Why This Works

     ✅ Fast: Reuses 90% of existing code✅ Works: Both file and API storage supported via factory✅ Safe: Minimal changes to battle-tested AI logic✅ 
     Shippable: Good enough for launch, clean up later

     Post-Launch Cleanup (Future)

     - Move AI logic into tm-core properly
     - Create proper tasks.update() method in TasksDomain
     - Remove old script dependencies
