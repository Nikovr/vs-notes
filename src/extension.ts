import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('vs-notes.note', () => {
			NotePanel.createOrShow(context.extensionUri);
		}));
}


class NotePanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: NotePanel | undefined;
	
	public static readonly viewType = "note";
	
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];
	
	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
		? vscode.window.activeTextEditor.viewColumn
		: undefined;
	
		// If we already have a panel, show it.
		if (NotePanel.currentPanel) {
		NotePanel.currentPanel._panel.reveal(column);
		NotePanel.currentPanel._update();
		return;
		}
	
		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
		NotePanel.viewType,
		"VS Notes",
		column || vscode.ViewColumn.One,
		{
			// Enable javascript in the webview
			enableScripts: true,
	
			// And restrict the webview to only loading content from our extension's `media` directory.
			localResourceRoots: [
			vscode.Uri.joinPath(extensionUri, "media"),
			vscode.Uri.joinPath(extensionUri, "out/compiled"),
			],
		}
		);
	
		NotePanel.currentPanel = new NotePanel(panel, extensionUri);
	}
	
	public static kill() {
		NotePanel.currentPanel?.dispose();
		NotePanel.currentPanel = undefined;
	}
	
	public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		NotePanel.currentPanel = new NotePanel(panel, extensionUri);
	}
	
	public constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;
	
		// Set the webview's initial html content
		this._update();
	
		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
	
		// // Handle messages from the webview
		// this._panel.webview.onDidReceiveMessage(
		//   (message) => {
		//     switch (message.command) {
		//       case "alert":
		//         vscode.window.showErrorMessage(message.text);
		//         return;
		//     }
		//   },
		//   null,
		//   this._disposables
		// );
	}
	public dispose() {
		NotePanel.currentPanel = undefined;
	
		// Clean up our resources
		this._panel.dispose();
	
		while (this._disposables.length) {
		  const x = this._disposables.pop();
		  if (x) {
			x.dispose();
		  }
		}
	  }
	
	  private async _update() {
		const webview = this._panel.webview;
	
		this._panel.webview.html = this._getHtmlForWebview(webview);
		webview.onDidReceiveMessage(async (data) => {
		  switch (data.type) {
			case "onInfo": {
			  if (!data.value) {
				return;
			  }
			  vscode.window.showInformationMessage(data.value);
			  break;
			}
			case "onError": {
			  if (!data.value) {
				return;
			  }
			  vscode.window.showErrorMessage(data.value);
			  break;
			}
			// case "tokens": {
			//   await Util.globalState.update(accessTokenKey, data.accessToken);
			//   await Util.globalState.update(refreshTokenKey, data.refreshToken);
			//   break;
			// }
		  }
		});
	  }
	
	  private _getHtmlForWebview(webview: vscode.Webview) {
		// // And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(
		  vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
		);
	
		// Local path to css styles
		const styleResetPath = vscode.Uri.joinPath(
		  this._extensionUri,
		  "media",
		  "reset.css"
		);
		const stylesPathMainPath = vscode.Uri.joinPath(
		  this._extensionUri,
		  "media",
		  "vscode.css"
		);
	
		// Uri to load styles into webview
		const stylesResetUri = webview.asWebviewUri(styleResetPath);
		const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);
	
		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();
	
		return `<!DOCTYPE html>
				<html lang="en">
				<head>
					<meta charset="UTF-8">
					<!--
						Use a content security policy to only allow loading images from https or from our extension directory,
						and only allow scripts that have a specific nonce.
			-->
			<meta http-equiv="Content-Security-Policy" content="img-src https: data:; style-src 'unsafe-inline' ${
		  webview.cspSource
		};">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<link href="${stylesResetUri}" rel="stylesheet">
					<link href="${stylesMainUri}" rel="stylesheet">
			<script src="${scriptUri}"></script>
				</head>
		  <body>
				</body onload="LoadNotes()">
				<secition>
                <h2 class="heading">Здесь вы можете написать заметку</h2>
                <div class="main bg-additional">
                    <form onsubmit="CreateNote();return false">
                        <div class="vertical">
                            <input type="text" id="text_id" class="textfield bg-primary">
                            <input type="submit" class="button" value="Добавить заметку">
                        </div>
                    </form>
                </div>
            </secition>
			<section>
                <h2 class="heading">Ваши заметки:</h2>
                <div id="parent_notes">
                    <div id="start_notes"></div>
                </div>
            </section>
				</html>`;
	  }
}
	

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
