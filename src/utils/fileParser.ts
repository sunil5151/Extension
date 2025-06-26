import * as path from 'path';
import { FileProvider } from '../providers/fileProvider';

export interface FileMention {
    original: string;  // The original text including @
    filePath: string;  // The extracted file path
    startIndex: number;  // Start index in the original text
    endIndex: number;  // End index in the original text
    isValid: boolean;  // Whether the file exists
}

export class FileParser {
    private static readonly FILE_MENTION_REGEX = /@([\w\-./\\]+\.[\w]+)/g;
    
    /**
     * Parse text for @filename mentions
     */
    public static parseFileMentions(text: string): FileMention[] {
        const mentions: FileMention[] = [];
        const fileProvider = FileProvider.getInstance();
        
        let match;
        while ((match = this.FILE_MENTION_REGEX.exec(text)) !== null) {
            const original = match[0];  // The full match including @
            const filePath = match[1];  // Just the file path
            const startIndex = match.index;
            const endIndex = startIndex + original.length;
            
            // Check if the file exists in the workspace
            const isValid = fileProvider.isValidFilePath(filePath);
            
            mentions.push({
                original,
                filePath,
                startIndex,
                endIndex,
                isValid
            });
        }
        
        return mentions;
    }
    
    /**
     * Get file suggestions based on partial input
     */
    public static async getFileSuggestions(partialPath: string): Promise<string[]> {
        const fileProvider = FileProvider.getInstance();
        const files = await fileProvider.getWorkspaceFiles();
        
        // Filter files that match the partial path
        return files
            .map(file => file.fsPath)
            .filter(filePath => {
                const fileName = path.basename(filePath);
                return fileName.toLowerCase().includes(partialPath.toLowerCase());
            })
            .slice(0, 10); // Limit to 10 suggestions
    }
}