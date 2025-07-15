// Replace requires with imports
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { createMainDashboard } from './mainDashboard.js';
// Placeholder for missing dashboards
// You can implement these similarly to mainDashboard
function createAgentDashboard(screen) {
  const grid = new contrib.grid({rows: 12, cols: 12, screen: screen});
  const placeholder = grid.set(0, 0, 12, 12, blessed.box, { content: 'Agent Dashboard - To be implemented' });
  return { updateAgentDashboard: () => {} };
}

function createSandboxDashboard(screen) {
  const grid = new contrib.grid({rows: 12, cols: 12, screen: screen});
  const placeholder = grid.set(0, 0, 12, 12, blessed.box, { content: 'Sandbox Dashboard - To be implemented' });
  return { updateSandboxDashboard: () => {} };
}

function createGitDashboard(screen) {
  const grid = new contrib.grid({rows: 12, cols: 12, screen: screen});
  const placeholder = grid.set(0, 0, 12, 12, blessed.box, { content: 'Git Dashboard - To be implemented' });
  return { updateGitDashboard: () => {} };
}

// OpenTelemetry integration (commented out for now, as it may require configuration)
/*
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
*/

class TaskMasterMonitor {
  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Task Master Flow Monitoring Dashboard',
      fullUnicode: true
    });

    this.dashboards = {};
    this.currentDashboard = 'main';
    this.telemetryData = {};
    
    // this.initializeOpenTelemetry(); // Uncomment when ready
    this.createDashboards();
    this.createNavigation();
    this.setupKeyBindings();
    this.startDataCollection();
  }

  /* initializeOpenTelemetry() { ... } */ // Implement if needed

  createDashboards() {
    this.dashboards.main = createMainDashboard(this.screen);
    this.dashboards.agent = createAgentDashboard(this.screen);
    this.dashboards.sandbox = createSandboxDashboard(this.screen);
    this.dashboards.git = createGitDashboard(this.screen);

    Object.keys(this.dashboards).forEach(key => {
      if (key !== 'main') {
        Object.values(this.dashboards[key].components || {}).forEach(component => {
          component.hide();
        });
      }
    });
  }

  createNavigation() {
    this.navBar = blessed.listbar({
      parent: this.screen,
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      mouse: true,
      keys: true,
      style: {
        bg: 'green',
        item: { bg: 'green', fg: 'white', hover: { bg: 'blue', fg: 'white' } },
        selected: { bg: 'blue', fg: 'white' }
      },
      commands: {
        'Main [F1]': { keys: ['f1'], callback: () => this.switchDashboard('main') },
        'Agents [F2]': { keys: ['f2'], callback: () => this.switchDashboard('agent') },
        'Sandboxes [F3]': { keys: ['f3'], callback: () => this.switchDashboard('sandbox') },
        'Git Ops [F4]': { keys: ['f4'], callback: () => this.switchDashboard('git') },
        'Quit [q]': { keys: ['q'], callback: () => process.exit(0) }
      }
    });

    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      tags: true,
      style: { fg: 'white', bg: 'blue' }
    });

    this.updateStatusBar();
  }

  switchDashboard(dashboardName) {
    Object.values(this.dashboards[this.currentDashboard].components || {}).forEach(component => component.hide());
    Object.values(this.dashboards[dashboardName].components || {}).forEach(component => component.show());
    this.currentDashboard = dashboardName;
    this.screen.render();
  }

  updateStatusBar() {
    const now = new Date().toLocaleString();
    const status = `{center}Task Master Monitor | Connected: ${this.telemetryData.connected ? 'Yes' : 'No'} | Last Update: ${now}{/center}`;
    this.statusBar.setContent(status);
  }

  setupKeyBindings() {
    this.screen.key(['escape', 'C-c'], () => process.exit(0));
    this.screen.key(['r', 'R'], () => {
      this.refreshData();
      this.screen.render();
    });
  }

  startDataCollection() {
    setInterval(() => {
      this.collectTelemetryData();
      this.updateDashboards();
    }, 1000);

    setInterval(() => {
      this.updateStatusBar();
      this.screen.render();
    }, 1000);
  }

  collectTelemetryData() {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();
    this.telemetryData = {
      connected: true,
      timestamp: now,
      // Add actual data collection here
    };
  }

  updateDashboards() {
    switch (this.currentDashboard) {
      case 'main': this.dashboards.main.updateDashboard(this.telemetryData); break;
      case 'agent': this.dashboards.agent.updateAgentDashboard(this.telemetryData); break;
      case 'sandbox': this.dashboards.sandbox.updateSandboxDashboard(this.telemetryData); break;
      case 'git': this.dashboards.git.updateGitDashboard(this.telemetryData); break;
    }
  }

  refreshData() {
    this.collectTelemetryData();
    this.updateDashboards();
  }

  run() {
    this.screen.render();
  }
}

export default TaskMasterMonitor; 