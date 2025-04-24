export class ProgressTrackerBuilder {
  constructor() {
    this.handlers = {};
    this.spinnerFrames = null;
  }

  withPercent() {
    this.handlers.percent = true;
    return this;
  }

  withTokens() {
    this.handlers.tokens = true;
    return this;
  }

  withTasks() {
    this.handlers.tasks = true;
    return this;
  }

  withSpinner(messages) {
    this.spinnerFrames = messages;
    return this;
  }

  build() {
    return new ProgressTracker(this.handlers, this.spinnerFrames);
  }
}

class ProgressTracker {
  constructor(handlers, spinnerFrames) {
    this.handlers = handlers;
    this.spinnerFrames = spinnerFrames;
    this.isActive = false;
  }

  start(total) {
    this.isActive = true;
    // Placeholder for initialization logic in subclasses
  }

  update(data) {
    if (!this.isActive) return;
    // Placeholder for update logic in subclasses
  }

  finish() {
    this.isActive = false;
    // Placeholder for cleanup logic in subclasses
  }
}
