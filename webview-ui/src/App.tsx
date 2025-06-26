import React, { useEffect, useState } from 'react';
import './App.css';
import { useVSCodeApi } from './hooks/useVSCodeApi';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: number;
}
declare global {
  interface Window {
    acquireVsCodeApi(): {
      postMessage(message: any): void;
      getState(): any;
      setState(state: any): void;
    };
  }
}
const App: React.FC = () => {
  const vscode = useVSCodeApi();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    // Listen for messages from the extension
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.command) {
        case 'receiveMessage':
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            text: message.text,
            sender: 'assistant',
            timestamp: Date.now()
          }]);
          setIsLoading(false);
          break;
          
        case 'fileAccessError':
          // Handle file access errors
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            text: `Could not access the following files: ${message.files.join(', ')}`,
            sender: 'assistant',
            timestamp: Date.now()
          }]);
          break;

        case 'loadChatHistory':
          // Handle loading chat history
          console.log('Received loadChatHistory command', message);
          if (message.messages && Array.isArray(message.messages)) {
            // Convert the format if needed
            const convertedMessages = message.messages.map((msg: any) => {
              console.log('Processing message:', msg);
              return {
                id: msg.id || Date.now().toString(),
                text: msg.text || '',
                sender: msg.sender === 'bot' ? 'assistant' : msg.sender,
                timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp).getTime() : 
                        msg.timestamp instanceof Date ? msg.timestamp.getTime() : 
                        Date.now()
              };
            });
            console.log('Converted messages:', convertedMessages);
            setMessages(convertedMessages);
          }
          break;
      }
    };
    
    window.addEventListener('message', messageListener);
    return () => window.removeEventListener('message', messageListener);
  }, []);
  
  const handleSendMessage = () => {
    if (inputText.trim() === '') return;
    
    // Add user message to the chat
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    
    // Send message to extension
    vscode.postMessage({
      command: 'sendMessage',
      text: inputText
    });
  };
  
  return (
    <div className="chat-container">
      <div className="messages-container">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            <div className="message-content">{msg.text}</div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="message-content">Thinking...</div>
          </div>
        )}
      </div>
      
      <div className="input-container">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
};

export default App;