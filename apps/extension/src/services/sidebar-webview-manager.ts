import * as vscode from 'vscode';
import type { TaskMasterApi } from '../utils/task-master-api';

export class SidebarWebviewManager implements vscode.WebviewViewProvider {
	private webviewView?: vscode.WebviewView;
	private api?: TaskMasterApi;

	constructor(private readonly extensionUri: vscode.Uri) {}

	setApi(api: TaskMasterApi): void {
		this.api = api;
		// Update connection status if webview exists
		if (this.webviewView) {
			this.updateConnectionStatus();
		}
	}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		token: vscode.CancellationToken
	): void {
		this.webviewView = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.extensionUri, 'dist'),
				vscode.Uri.joinPath(this.extensionUri, 'assets')
			]
		};

		webviewView.webview.html = this.getHtmlContent(webviewView.webview);

		// Handle messages from the webview
		webviewView.webview.onDidReceiveMessage((message) => {
			if (message.command === 'openBoard') {
				vscode.commands.executeCommand('tm.showKanbanBoard');
			}
		});

		// Update connection status on load
		this.updateConnectionStatus();
	}

	updateConnectionStatus(): void {
		if (!this.webviewView || !this.api) return;

		const status = this.api.getConnectionStatus();
		this.webviewView.webview.postMessage({
			type: 'connectionStatus',
			data: status
		});
	}

	private getHtmlContent(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionUri, 'dist', 'sidebar.js')
		);
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionUri, 'dist', 'index.css')
		);
		const nonce = this.getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';">
  <link href="${styleUri}" rel="stylesheet">
  <title>TaskMaster</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}

	private getNonce(): string {
		let text = '';
		const possible =
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}
}
