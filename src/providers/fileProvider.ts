import * as vscode from 'vscode';
import * as path from 'path';

export class FileProvider {
    private static instance: FileProvider;
    private workspaceFolders: readonly vscode.WorkspaceFolder[] = [];
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private onFileChangeEmitter = new vscode.EventEmitter<string>();

    public readonly onFileChange = this.onFileChangeEmitter.event;

    private constructor() {
        this.workspaceFolders = vscode.workspace.workspaceFolders || [];
        this.setupFileWatcher();
    }

    public static getInstance(): FileProvider {
        if (!FileProvider.instance) {
            FileProvider.instance = new FileProvider();
        }
        return FileProvider.instance;
    }

    private setupFileWatcher(): void {
        // Watch for file changes in the workspace
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        this.fileWatcher.onDidChange(uri => {
            this.onFileChangeEmitter.fire(uri.fsPath);
        });
        
        this.fileWatcher.onDidCreate(uri => {
            this.onFileChangeEmitter.fire(uri.fsPath);
        });
        
        this.fileWatcher.onDidDelete(uri => {
            this.onFileChangeEmitter.fire(uri.fsPath);
        });
    }

    public async getWorkspaceFiles(includePattern: string = '**/*', excludePattern: string = '**/{node_modules,dist,out}/**'): Promise<vscode.Uri[]> {
        const files = await vscode.workspace.findFiles(includePattern, excludePattern);
        return files;
    }

    public async getFileContent(filePath: string): Promise<string | undefined> {
        try {
            // Try as absolute path first
            try {
                const uri = vscode.Uri.file(filePath);
                const document = await vscode.workspace.openTextDocument(uri);
                return document.getText();
            } catch (error) {
                // If that fails, try as relative path in each workspace folder
                const workspaceFolders = vscode.workspace.workspaceFolders || [];
                for (const folder of workspaceFolders) {
                    const folderPath = folder.uri.fsPath;
                    const fullPath = path.join(folderPath, filePath);
                    try {
                        const uri = vscode.Uri.file(fullPath);
                        const document = await vscode.workspace.openTextDocument(uri);
                        return document.getText();
                    } catch {
                        // Continue to next workspace folder
                    }
                }
            }
            console.error(`Error reading file ${filePath}: File not found in any workspace folder`);
            return undefined;
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            return undefined;
        }
    }

    public async getFileInfo(filePath: string): Promise<{ name: string; type: string; size: number; language: string } | undefined> {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const stat = await vscode.workspace.fs.stat(uri);
            
            return {
                name: path.basename(filePath),
                type: this.getFileType(filePath),
                size: stat.size,
                language: document.languageId
            };
        } catch (error) {
            console.error(`Error getting file info for ${filePath}:`, error);
            return undefined;
        }
    }

    private getFileType(filePath: string): string {
        const extension = path.extname(filePath).toLowerCase();
        
        // Map common extensions to file types
        const extensionMap: Record<string, string> = {
            '.ts': 'TypeScript',
            '.tsx': 'React TypeScript',
            '.js': 'JavaScript',
            '.jsx': 'React JavaScript',
            '.html': 'HTML',
            '.css': 'CSS',
            '.json': 'JSON',
            '.md': 'Markdown'
        };
        
        return extensionMap[extension] || 'Unknown';
    }

    public isValidFilePath(filePath: string): boolean {
        try {
            console.log(`Checking file path: ${filePath}`);
            
            // Check if this is a simple filename without path separators
            const isSimpleFilename = !filePath.includes('/') && !filePath.includes('\\');
            
            // For simple filenames, try relative path first
            if (isSimpleFilename) {
                // Try as relative path in each workspace folder first
                const workspaceFolders = vscode.workspace.workspaceFolders || [];
                for (const folder of workspaceFolders) {
                    const folderPath = folder.uri.fsPath;
                    const fullPath = path.join(folderPath, filePath);
                    try {
                        const fileUri = vscode.Uri.file(fullPath);
                        const stat = vscode.workspace.fs.stat(fileUri);
                        // If we can stat the file, it exists
                        return true;
                    } catch {
                        // File doesn't exist in this workspace folder, continue checking
                    }
                }
            }
            
            // Then try as absolute path
            const absoluteUri = vscode.Uri.file(filePath);
            if (vscode.workspace.getWorkspaceFolder(absoluteUri) !== undefined) {
                return true;
            }
            
            // If not already checked as simple filename, try as relative path
            if (!isSimpleFilename) {
                const workspaceFolders = vscode.workspace.workspaceFolders || [];
                for (const folder of workspaceFolders) {
                    const folderPath = folder.uri.fsPath;
                    const fullPath = path.join(folderPath, filePath);
                    try {
                        const fileUri = vscode.Uri.file(fullPath);
                        const stat = vscode.workspace.fs.stat(fileUri);
                        // If we can stat the file, it exists
                        return true;
                    } catch {
                        // File doesn't exist in this workspace folder, continue checking
                    }
                }
            }
            
            return false;
        } catch {
            return false;
        }
    }

    public dispose(): void {
        this.fileWatcher?.dispose();
        this.onFileChangeEmitter.dispose();
    }
}