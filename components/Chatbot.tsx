'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{
    id: string;
    score: number;
    text?: string;
    source?: string;
  }>;
}

interface ChatbotProps {
  selectedIndex: string | null;
  selectedNamespace?: string;
}

export default function Chatbot({ selectedIndex, selectedNamespace }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableNamespaces, setAvailableNamespaces] = useState<string[]>([]);
  const [currentNamespace, setCurrentNamespace] = useState<string>(selectedNamespace || '');
  const [systemPrompt, setSystemPrompt] = useState<string>(() => {
    // Load from localStorage if available
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chatbot-system-prompt') || '';
    }
    return '';
  });
  const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load namespaces when index changes
  useEffect(() => {
    if (selectedIndex) {
      loadNamespaces();
    }
  }, [selectedIndex]);

  // Update namespace when prop changes
  useEffect(() => {
    if (selectedNamespace) {
      setCurrentNamespace(selectedNamespace);
    }
  }, [selectedNamespace]);

  const loadNamespaces = async () => {
    if (!selectedIndex) return;
    try {
      const response = await fetch(`/api/index-namespaces?indexName=${encodeURIComponent(selectedIndex)}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableNamespaces(data.namespaces || []);
        if (data.namespaces && data.namespaces.length === 1 && !currentNamespace) {
          setCurrentNamespace(data.namespaces[0]);
        }
      }
    } catch (err) {
      console.error('Error loading namespaces:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !selectedIndex || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indexName: selectedIndex,
          namespace: currentNamespace || undefined,
          query: input.trim(),
          systemPrompt: systemPrompt.trim() || undefined, // Pass custom system prompt
          conversationHistory: messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        sources: data.sources || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const handleSystemPromptChange = (newPrompt: string) => {
    setSystemPrompt(newPrompt);
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatbot-system-prompt', newPrompt);
    }
  };

  const resetSystemPrompt = () => {
    const defaultPrompt = '';
    setSystemPrompt(defaultPrompt);
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatbot-system-prompt', defaultPrompt);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg flex flex-col h-[600px]">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Ana Chatbot</h2>
            <p className="text-sm text-gray-500">
              Memory: {selectedIndex || 'None selected'}
              {currentNamespace && ` • Namespace: ${currentNamespace}`}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {availableNamespaces.length > 0 && (
              <select
                value={currentNamespace}
                onChange={(e) => setCurrentNamespace(e.target.value)}
                className="text-sm px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Default</option>
                {availableNamespaces.map((ns) => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowSystemPromptEditor(!showSystemPromptEditor)}
              className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              title="Customize system prompt"
            >
              ⚙️ System Prompt
            </button>
            <button
              onClick={clearChat}
              className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Clear
            </button>
          </div>
        </div>

        {/* System Prompt Editor */}
        {showSystemPromptEditor && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">
                System Prompt (Optional - controls chatbot behavior)
              </label>
              <button
                onClick={resetSystemPrompt}
                className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
              >
                Reset to Default
              </button>
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => handleSystemPromptChange(e.target.value)}
              placeholder="Enter custom system prompt... (e.g., 'You are a helpful assistant specialized in freight logistics. Always provide detailed explanations.')"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to use default prompt. This prompt defines how Ana behaves and responds.
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">👋 Start a conversation</p>
            <p className="text-sm">Ask questions about your stored memories</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.sources && message.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-300">
                  <p className="text-xs font-semibold mb-1">Sources:</p>
                  {message.sources.slice(0, 3).map((source, idx) => (
                    <div key={idx} className="text-xs opacity-75">
                      • {source.text?.substring(0, 100)}... (Score: {source.score.toFixed(3)})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        {!selectedIndex && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded mb-2 text-sm">
            Please select an index from the dashboard to use the chatbot
          </div>
        )}
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your memories..."
            disabled={!selectedIndex || loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none disabled:opacity-50"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!selectedIndex || !input.trim() || loading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

