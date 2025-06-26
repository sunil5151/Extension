import * as vscode from 'vscode';
import { getNonce } from './utils/messaging';
import { FileProvider } from './providers/fileProvider';
import { FileParser } from './utils/fileParser';
import { GeminiService } from './utils/geminiService';
import { ChatHistoryService, ChatMessage } from './utils/chatHistoryService';
export class ChatPanel {
    public static currentPanel: ChatPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private sessionId: string;
    private webviewReady: boolean = false;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.sessionId = Date.now().toString();
        
    
        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this.sendWorkspaceInfo();
  

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'sendMessage':
                        // Handle the message from the webview
                        this.processUserMessage(message.text);
                        return;
                    
                    case 'getFileSuggestions':
                        this.provideFileSuggestions(message.partial);
                        return;
                    
                    case 'getFileContent':
                        this.provideFileContent(message.filePath);
                        return;
                    case 'webviewReady':
                        // Webview is ready to receive messages
                        this.webviewReady = true;
                        this.loadChatHistory();
                        return;
                }
            },
            null,
            this._disposables
        );
        setTimeout(() => {
            if (!this.webviewReady) {
                console.log('Webview ready signal not received, loading chat history with fallback');
                this.loadChatHistory();
            }
        }, 2000); // 2 second fallback delay
    }

   private loadChatHistory(): void {
        const chatHistoryService = ChatHistoryService.getInstance();
        const sessions = chatHistoryService.getSessionsForWorkspace();
        console.log('Loading chat history...');
        console.log('Found', sessions.length, 'sessions');
        
        if (sessions.length > 0) {
            // Use the most recent session
            const latestSession = sessions[0];
            this.sessionId = latestSession.id;
            console.log('Latest session ID:', latestSession.id);
            console.log('Latest session messages:', latestSession.messages.length);
            console.log('First message:', latestSession.messages[0]);
            
            // Send messages to webview
            this._panel.webview.postMessage({
                command: 'loadChatHistory',
                messages: latestSession.messages
            });
        } else {
            console.log('No chat history sessions found');
        }
    }

    private async processUserMessage(text: string) {
        try {
            // Save user message to chat history
            const chatHistoryService = ChatHistoryService.getInstance();
            const userMessage: ChatMessage = {
                id: Date.now().toString(),
                text: text,
                sender: 'user',
                timestamp: new Date()
            };
            
            // Get current session messages
            const currentSession = chatHistoryService.getSession(this.sessionId);
            const messages = currentSession ? [...currentSession.messages, userMessage] : [userMessage];
            
            // Save updated messages
            chatHistoryService.saveSession(this.sessionId, messages);
            
            // Parse file mentions
            const mentions = FileParser.parseFileMentions(text);
            const fileContents: {[filePath: string]: string} = {};
            const invalidFiles: string[] = [];
            
            // Get file contents for all mentioned files
            if (mentions.length > 0) {
                const fileProvider = FileProvider.getInstance();
                
                for (const mention of mentions) {
                    if (mention.isValid) {
                        const content = await fileProvider.getFileContent(mention.filePath);
                        if (content) {
                            fileContents[mention.filePath] = content;
                        }
                    } else {
                        invalidFiles.push(mention.filePath);
                    }
                }
                
                // Handle file mentions (for displaying in UI)
                this.handleFileMentions(mentions);
                
                // Provide feedback for invalid files
                if (invalidFiles.length > 0) {
                    this._panel.webview.postMessage({
                        command: 'fileAccessError',
                        files: invalidFiles
                    });
                }
            }
            
            // Get response from Gemini
            const geminiService = GeminiService.getInstance();
            const response = await geminiService.generateResponse(text, Object.keys(fileContents).length > 0 ? fileContents : undefined);
            
            // Save assistant message to chat history
            const assistantMessage: ChatMessage = {
                id: Date.now().toString(),
                text: response,
                sender: 'bot',
                timestamp: new Date()
            };
            
            // Update messages array with assistant response
            messages.push(assistantMessage);
            chatHistoryService.saveSession(this.sessionId, messages);
            
            // Send response back to webview
            this._panel.webview.postMessage({
                command: 'receiveMessage',
                text: response
            });
        } catch (error) {
            console.error('Error processing message:', error);
            this._panel.webview.postMessage({
                command: 'receiveMessage',
                text: 'Sorry, I encountered an error processing your request.'
            });
        }
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            'chatAssistant',
            'Chat Assistant',
            column || vscode.ViewColumn.One,
            {
                // Enable javascript in the webview
                enableScripts: true,
                // Restrict the webview to only load resources from the `dist` directory
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist'),
                    vscode.Uri.joinPath(extensionUri, 'dist/webview')
                ],
                retainContextWhenHidden: true
            }
        );

        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = "Chat Assistant";
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Local path to main script run in the webview
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'main.js')
        );
    
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();
    
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'">
            <title>Chat Assistant</title>
        </head>
        <body>
            <div id="root"></div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    private async handleFileMentions(mentions: any[]) {
        const fileProvider = FileProvider.getInstance();
        
        for (const mention of mentions) {
            if (mention.isValid) {
                const content = await fileProvider.getFileContent(mention.filePath);
                const fileInfo = await fileProvider.getFileInfo(mention.filePath);
                
                if (content && fileInfo) {
                    this._panel.webview.postMessage({
                        command: 'fileAttachment',
                        filePath: mention.filePath,
                        content,
                        fileInfo
                    });
                }
            }
        }
    }

    private async provideFileSuggestions(partialPath: string) {
        const suggestions = await FileParser.getFileSuggestions(partialPath);
        
        this._panel.webview.postMessage({
            command: 'fileSuggestions',
            suggestions
        });
    }

    private async provideFileContent(filePath: string) {
        const fileProvider = FileProvider.getInstance();
        const content = await fileProvider.getFileContent(filePath);
        const fileInfo = await fileProvider.getFileInfo(filePath);
        
        if (content && fileInfo) {
            this._panel.webview.postMessage({
                command: 'fileContent',
                filePath,
                content,
                fileInfo
            });
        }
    }

    private sendWorkspaceInfo(): void {
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        
        // Send workspace info to webview
        this._panel.webview.postMessage({
            command: 'workspaceInfo',
            folders: workspaceFolders.map(folder => ({
                name: folder.name,
                path: folder.uri.fsPath
            }))
        });
    }

    public dispose() {
        ChatPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}