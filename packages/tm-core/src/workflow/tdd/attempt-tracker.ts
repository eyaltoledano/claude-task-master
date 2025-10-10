/**
 * AttemptTracker - Tracks retry attempts for TDD phases
 */

export interface AttemptTrackerConfig {
  maxAttempts: number;
}

export class AttemptTracker {
  private attempts: Map<string, number> = new Map();
  private config: AttemptTrackerConfig;

  constructor(config: AttemptTrackerConfig = { maxAttempts: 5 }) {
    this.config = config;
  }

  recordAttempt(subtaskId: string, phase: string): number {
    const key = `${subtaskId}:${phase}`;
    const current = this.attempts.get(key) || 0;
    const newCount = current + 1;
    this.attempts.set(key, newCount);
    return newCount;
  }

  getAttemptCount(subtaskId: string, phase: string): number {
    const key = `${subtaskId}:${phase}`;
    return this.attempts.get(key) || 0;
  }

  hasExceededMaxAttempts(subtaskId: string, phase: string): boolean {
    const count = this.getAttemptCount(subtaskId, phase);
    return count >= this.config.maxAttempts;
  }

  resetAttempts(subtaskId: string, phase: string): void {
    const key = `${subtaskId}:${phase}`;
    this.attempts.delete(key);
  }
}
