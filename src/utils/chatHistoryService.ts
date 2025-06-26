import * as vscode from 'vscode';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  imageData?: string;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  workspaceFolder: string;
  lastUpdated: Date;
}

export class ChatHistoryService {
  private static instance: ChatHistoryService;
  private context: vscode.ExtensionContext | undefined;
  
  private constructor() {}
  
  public static getInstance(): ChatHistoryService {
    if (!ChatHistoryService.instance) {
      ChatHistoryService.instance = new ChatHistoryService();
    }
    return ChatHistoryService.instance;
  }
  
  public initialize(context: vscode.ExtensionContext): void {
    this.context = context;
  }
  
  public saveSession(sessionId: string, messages: ChatMessage[]): void {
    if (!this.context) {
      console.error('ChatHistoryService not initialized with context');
      return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.name || 'default';
    
    // Get existing sessions
    const sessions = this.context.globalState.get<Record<string, ChatSession>>('chatSessions') || {};
    
    // Update or create session
    sessions[sessionId] = {
      id: sessionId,
      messages,
      workspaceFolder,
      lastUpdated: new Date()
    };
    console.log('Saved session:', sessionId, 'with', messages.length, 'messages');
    // Save back to global state
    this.context.globalState.update('chatSessions', sessions);
  }
  
  public getSessionsForWorkspace(workspaceFolder?: string): ChatSession[] {
    if (!this.context) {
      console.error('ChatHistoryService not initialized with context');
      return [];
    }
    
    const currentWorkspace = workspaceFolder || 
      vscode.workspace.workspaceFolders?.[0]?.name || 
      'default';
    
    const sessions = this.context.globalState.get<Record<string, ChatSession>>('chatSessions') || {};
    
    return Object.values(sessions)
      .filter(session => session.workspaceFolder === currentWorkspace)
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  }
  
  public getSession(sessionId: string): ChatSession | undefined {
    if (!this.context) {
      console.error('ChatHistoryService not initialized with context');
      return undefined;
    }
    
    const sessions = this.context.globalState.get<Record<string, ChatSession>>('chatSessions') || {};
    return sessions[sessionId];
  }
  
  public deleteSession(sessionId: string): void {
    if (!this.context) {
      console.error('ChatHistoryService not initialized with context');
      return;
    }
    
    const sessions = this.context.globalState.get<Record<string, ChatSession>>('chatSessions') || {};
    
    if (sessions[sessionId]) {
      delete sessions[sessionId];
      this.context.globalState.update('chatSessions', sessions);
    }
  }
  
  public clearAllSessions(): void {
    if (!this.context) {
      console.error('ChatHistoryService not initialized with context');
      return;
    }
    
    this.context.globalState.update('chatSessions', {});
  }
}