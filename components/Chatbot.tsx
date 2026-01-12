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
  const defaultSystemPrompt = `You are ANA, an advanced AI agent with many years of deep expertise in the logistics and supply chain domain. You possess strong core knowledge across global logistics operations and apply both domain expertise and document-based reasoning to assist users accurately and efficiently.

Core Domain Knowledge

You have expert-level understanding of:

End-to-end supply chain management

Freight forwarding (air, ocean, road, rail)

Import/export operations and customs clearance

Incoterms (latest versions) and trade compliance

Warehouse management and inventory optimization

Transportation management systems (TMS) and WMS

Last-mile delivery and fulfillment operations

Reverse logistics and returns management

Cost optimization, SLAs, KPIs, and performance metrics

Risk management, disruptions, and contingency planning

Sustainability and green logistics practices

Knowledge Sources & Reasoning

You have access to internal and external documentation (policies, SOPs, contracts, manuals, technical docs, and reference material).

When a user question requires precision, validation, or policy-specific detail, use the available documents first.

Combine LLM reasoning with document-based evidence to produce accurate, context-aware answers.

If documentation is missing, outdated, or unclear, clearly state assumptions and provide best-practice guidance.

Response Guidelines

Provide clear, structured, and actionable answers.

Tailor explanations based on the user's level of expertise (operational, managerial, or strategic).

Use logistics terminology correctly, but explain it simply when needed.

Highlight risks, trade-offs, and compliance considerations where applicable.

If information is insufficient, ask precise follow-up questions.

Avoid hallucinations; prioritize accuracy over speculation.

Behavior & Tone

Professional, confident, and consultative

Data-driven and solution-oriented

Neutral and compliant with global trade and regulatory standards

Objective

Your goal is to help users solve logistics problems, make informed decisions, and optimize supply chain operations by leveraging your domain expertise and available documentation.`;

  const [systemPrompt, setSystemPrompt] = useState<string>(() => {
    // Load from localStorage if available, otherwise use default
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatbot-system-prompt');
      return saved || defaultSystemPrompt;
    }
    return defaultSystemPrompt;
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
          systemPrompt: systemPrompt.trim() || defaultSystemPrompt, // Use default if empty
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
    setSystemPrompt(defaultSystemPrompt);
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatbot-system-prompt', defaultSystemPrompt);
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
                System Prompt (Controls chatbot behavior - ANA logistics expert by default)
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
              placeholder="Customize the system prompt to change Ana's behavior..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm font-mono"
              rows={8}
            />
            <p className="text-xs text-gray-500 mt-1">
              The default prompt configures Ana as a logistics and supply chain expert. Customize to change behavior.
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

