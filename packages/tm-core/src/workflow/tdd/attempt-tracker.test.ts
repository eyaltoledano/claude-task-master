import { describe, it, expect, beforeEach } from 'vitest';
import { AttemptTracker } from './attempt-tracker.js';

describe('AttemptTracker', () => {
  let tracker: AttemptTracker;

  beforeEach(() => {
    tracker = new AttemptTracker({ maxAttempts: 3 });
  });

  describe('recordAttempt', () => {
    it('should record attempt and return current count', () => {
      const count = tracker.recordAttempt('6.4.1', 'GREEN');
      expect(count).toBe(1);
    });

    it('should increment attempts for same subtask/phase', () => {
      tracker.recordAttempt('6.4.1', 'GREEN');
      const count = tracker.recordAttempt('6.4.1', 'GREEN');
      expect(count).toBe(2);
    });

    it('should track attempts separately per phase', () => {
      tracker.recordAttempt('6.4.1', 'RED');
      const count = tracker.recordAttempt('6.4.1', 'GREEN');
      expect(count).toBe(1);
    });
  });

  describe('hasExceededMaxAttempts', () => {
    it('should return false when under limit', () => {
      tracker.recordAttempt('6.4.1', 'GREEN');
      expect(tracker.hasExceededMaxAttempts('6.4.1', 'GREEN')).toBe(false);
    });

    it('should return true when at max attempts', () => {
      tracker.recordAttempt('6.4.1', 'GREEN');
      tracker.recordAttempt('6.4.1', 'GREEN');
      tracker.recordAttempt('6.4.1', 'GREEN');
      expect(tracker.hasExceededMaxAttempts('6.4.1', 'GREEN')).toBe(true);
    });

    it('should return false for untracked subtask', () => {
      expect(tracker.hasExceededMaxAttempts('9.9.9', 'GREEN')).toBe(false);
    });
  });

  describe('resetAttempts', () => {
    it('should reset attempts for subtask/phase', () => {
      tracker.recordAttempt('6.4.1', 'GREEN');
      tracker.recordAttempt('6.4.1', 'GREEN');
      tracker.resetAttempts('6.4.1', 'GREEN');
      expect(tracker.getAttemptCount('6.4.1', 'GREEN')).toBe(0);
    });
  });
});
