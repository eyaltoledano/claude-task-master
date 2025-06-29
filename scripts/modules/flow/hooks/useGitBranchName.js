import { useState, useEffect, useRef, useCallback } from 'react';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Hook for tracking current git branch name and status
 * Based on Gemini CLI's useGitBranchName implementation
 */
export function useGitBranchName(options = {}) {
  const {
    cwd = process.cwd(),
    refreshInterval = 5000,
    includeStatus = false,
  } = options;

  const [branchInfo, setBranchInfo] = useState({
    name: null,
    isGitRepo: false,
    hasChanges: false,
    ahead: 0,
    behind: 0,
    error: null,
  });

  const intervalRef = useRef(null);

  const getBranchInfo = useCallback(async () => {
    try {
      // Check if we're in a git repository
      const gitDir = findGitDirectory(cwd);
      if (!gitDir) {
        setBranchInfo(prev => ({
          ...prev,
          isGitRepo: false,
          name: null,
          error: null,
        }));
        return;
      }

      // Get current branch name
      const branchName = execSync('git branch --show-current', {
        cwd,
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim();

      let hasChanges = false;
      let ahead = 0;
      let behind = 0;

      if (includeStatus) {
        // Check for uncommitted changes
        try {
          const status = execSync('git status --porcelain', {
            cwd,
            encoding: 'utf8',
            stdio: 'pipe',
          });
          hasChanges = status.trim().length > 0;
        } catch (error) {
          // Ignore status check errors
        }

        // Check ahead/behind status
        try {
          const aheadBehind = execSync('git rev-list --count --left-right @{upstream}...HEAD', {
            cwd,
            encoding: 'utf8',
            stdio: 'pipe',
          }).trim().split('\t');
          
          behind = parseInt(aheadBehind[0]) || 0;
          ahead = parseInt(aheadBehind[1]) || 0;
        } catch (error) {
          // Ignore if no upstream is set
        }
      }

      setBranchInfo({
        name: branchName || 'HEAD',
        isGitRepo: true,
        hasChanges,
        ahead,
        behind,
        error: null,
      });

         } catch (error) {
       setBranchInfo(prev => ({
         ...prev,
         error: error.message,
         name: null,
       }));
     }
   }, [cwd, includeStatus]);

   useEffect(() => {
     getBranchInfo();

     if (refreshInterval > 0) {
       intervalRef.current = setInterval(getBranchInfo, refreshInterval);
     }

     return () => {
       if (intervalRef.current) {
         clearInterval(intervalRef.current);
       }
     };
   }, [getBranchInfo, refreshInterval]);

  return {
    ...branchInfo,
    refresh: getBranchInfo,
    displayName: formatBranchDisplay(branchInfo),
  };
}

/**
 * Find the .git directory starting from the given path
 */
function findGitDirectory(startPath) {
  let currentPath = path.resolve(startPath);
  
  while (currentPath !== path.dirname(currentPath)) {
    const gitPath = path.join(currentPath, '.git');
    if (fs.existsSync(gitPath)) {
      return gitPath;
    }
    currentPath = path.dirname(currentPath);
  }
  
  return null;
}

/**
 * Format branch info for display
 */
function formatBranchDisplay(branchInfo) {
  if (!branchInfo.isGitRepo || !branchInfo.name) {
    return null;
  }

  let display = branchInfo.name;
  
  if (branchInfo.hasChanges) {
    display += '*';
  }
  
  if (branchInfo.ahead > 0) {
    display += ` ↑${branchInfo.ahead}`;
  }
  
  if (branchInfo.behind > 0) {
    display += ` ↓${branchInfo.behind}`;
  }
  
  return display;
} 