/**
 * PhaseTransitionValidator - Validates TDD phase transitions
 */

export type TDDPhase = 'RED' | 'GREEN' | 'COMMIT';

export interface TransitionResult {
  isValid: boolean;
  error?: string;
}

export class PhaseTransitionValidator {
  private validTransitions: Map<TDDPhase, TDDPhase[]> = new Map([
    ['RED', ['GREEN']],
    ['GREEN', ['COMMIT']],
    ['COMMIT', ['RED']]
  ]);

  canTransition(from: TDDPhase, to: TDDPhase): boolean {
    const allowed = this.validTransitions.get(from) || [];
    return allowed.includes(to);
  }

  validateTransition(from: TDDPhase, to: TDDPhase): TransitionResult {
    if (this.canTransition(from, to)) {
      return { isValid: true };
    }
    return {
      isValid: false,
      error: `Invalid transition from ${from} to ${to}`
    };
  }
}
