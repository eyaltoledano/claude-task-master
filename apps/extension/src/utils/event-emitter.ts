/**
 * Simple Event Emitter
 * Lightweight alternative to complex event bus
 */

export type EventHandler = (...args: any[]) => void | Promise<void>;

export class EventEmitter {
	private handlers = new Map<string, Set<EventHandler>>();

	on(event: string, handler: EventHandler): () => void {
		if (!this.handlers.has(event)) {
			this.handlers.set(event, new Set());
		}
		this.handlers.get(event)?.add(handler);

		// Return unsubscribe function
		return () => this.off(event, handler);
	}

	off(event: string, handler: EventHandler): void {
		this.handlers.get(event)?.delete(handler);
	}

	emit(event: string, ...args: any[]): void {
		this.handlers.get(event)?.forEach((handler) => {
			try {
				handler(...args);
			} catch (error) {
				console.error(`Error in event handler for ${event}:`, error);
			}
		});
	}
}
