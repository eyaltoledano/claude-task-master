/**
 * TDDActivityLogger - Logs TDD phase transitions and results
 */

export class TDDActivityLogger {
  constructor(private activityLogger: any) {}

  async logPhaseTransition(
    subtaskId: string,
    from: string,
    to: string,
    metadata?: any
  ): Promise<void> {
    await this.activityLogger.logEvent({
      type: 'phase_transition',
      subtaskId,
      from,
      to,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  async logPhaseResult(
    subtaskId: string,
    phase: string,
    success: boolean,
    metadata?: any
  ): Promise<void> {
    await this.activityLogger.logEvent({
      type: 'phase_result',
      subtaskId,
      phase,
      success,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }
}
