import fetch from 'node-fetch';
import * as vscode from 'vscode';

export class GeminiService {
    private static instance: GeminiService;
    private apiKey: string = 'AIzaSyAjVmnO8wHT7YYXFzH-wOb6X8rd-BlclLk'; // Replace with your actual API key
    
    private constructor() {}
    
    public static getInstance(): GeminiService {
        if (!GeminiService.instance) {
            GeminiService.instance = new GeminiService();
        }
        return GeminiService.instance;
    }
    
    // Add a property to store conversation history
    private conversationHistory: {role: 'user' | 'model', content: string}[] = [];
    
    // Generate response method
    public async generateResponse(prompt: string, fileContents?: {[filePath: string]: string}): Promise<string> {
        try {
            // Construct the request payload
            let fullPrompt = prompt;
            
            // Add file contents to the prompt if provided
            if (fileContents) {
                fullPrompt += '\n\nReference files:\n';
                for (const [filePath, content] of Object.entries(fileContents)) {
                    fullPrompt += `\n--- ${filePath} ---\n${content}\n`;
                }
            }
            
            // Add the user message to history
            this.conversationHistory.push({ role: 'user', content: fullPrompt });
            
            // Call Gemini API with conversation history
            const response = await this.callGeminiAPI(this.conversationHistory);
            
            // Add the model response to history
            this.conversationHistory.push({ role: 'model', content: response });
            
            return response;
        } catch (error) {
            console.error('Error generating response:', error);
            return 'Sorry, I encountered an error processing your request.';
        }
    }
    
    // Call Gemini API method
    private async callGeminiAPI(history: {role: 'user' | 'model', content: string}[]): Promise<string> {
        try {
            const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
            
            // Convert history to the format expected by Gemini API
            const contents = history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));
            
            const response = await fetch(`${url}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ contents })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Gemini API error:', errorData);
                throw new Error(`API error: ${response.status} - ${(errorData as any).error?.message || 'Unknown error'}`);
            }
            
            const data = await response.json();
            
            // Extract the response text from the Gemini API response
            if ((data as any).candidates?.[0]?.content) {
                return (data as any).candidates[0].content.parts[0].text;
            } else {
                throw new Error('Invalid response format from Gemini API');
            }
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            throw error;
        }
    }
    }
