import * as vscode from 'vscode';
import { ChatPanel } from './chatPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "chat-assistant" is now active!');

  // Register the command to open the chat panel
  const disposable = vscode.commands.registerCommand('chat-assistant.openChat', () => {
    ChatPanel.createOrShow(context.extensionUri);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}