import * as vscode from 'vscode';
import { ChatPanel } from './chatPanel';
import { FileProvider } from './providers/fileProvider';
import { ChatHistoryService } from './utils/chatHistoryService';

export function activate(context: vscode.ExtensionContext) {
    console.log('Chat Assistant extension is now active!');
    
    // Initialize the FileProvider
    const fileProvider = FileProvider.getInstance();
    
    // Initialize the ChatHistoryService
    const chatHistoryService = ChatHistoryService.getInstance();
    chatHistoryService.initialize(context);
    
    const disposable = vscode.commands.registerCommand('chat-assistant.openChat', () => {
        ChatPanel.createOrShow(context.extensionUri);
    });
    
    context.subscriptions.push(disposable);
    
    // Dispose the FileProvider when the extension is deactivated
    context.subscriptions.push({
        dispose: () => {
            fileProvider.dispose();
        }
    });
}

export function deactivate() {}