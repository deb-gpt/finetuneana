'use client';

import { useState } from 'react';
import MemoryIndexDashboard from '@/components/MemoryIndexDashboard';
import CreateIndexForm from '@/components/CreateIndexForm';
import DocumentUpload from '@/components/DocumentUpload';
import MetadataForm from '@/components/MetadataForm';
import ChunkingConfig from '@/components/ChunkingConfig';
import IngestionControls from '@/components/IngestionControls';
import QueryPanel from '@/components/QueryPanel';
import Chatbot from '@/components/Chatbot';

type ViewMode = 'dashboard' | 'upload' | 'query' | 'chatbot';

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [showCreateIndex, setShowCreateIndex] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState<string>('');
  const [metadata, setMetadata] = useState<{
    topic: string;
    subtopic?: string;
    source: string;
    version?: string;
  }>({
    topic: '',
    source: '',
  });
  const [chunkingConfig, setChunkingConfig] = useState({
    chunkSize: 2000, // Increased default for better context
    overlap: 300, // Increased overlap for better continuity
    useHeadings: false,
  });
  const [namespace, setNamespace] = useState('');
  const [dimensions, setDimensions] = useState(1536);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    // For chunking preview, we need to parse the file properly
    // PDF/DOCX are binary files and need server-side parsing
    try {
      // For text-based files (CSV, TXT), read directly
      if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        const text = await file.text();
        setFileText(text); // Full text for text-based files
      } else if (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        // For binary files (PDF/DOCX), we need to parse on server
        // Call API to parse and get text for preview
        setFileText(''); // Clear previous text
        const formData = new FormData();
        formData.append('file', file);
        formData.append('preview', 'true'); // Flag for preview mode
        
        try {
          const response = await fetch('/api/parse-preview', {
            method: 'POST',
            body: formData,
          });
          
          if (response.ok) {
            const data = await response.json();
            setFileText(data.text || '');
          } else if (response.status === 413) {
            // File too large - skip preview but show message
            const data = await response.json().catch(() => ({}));
            setFileText('');
            console.warn('File too large for preview, but ingestion will work');
            // Show a user-friendly message (could add a toast notification here)
          } else {
            // If parsing fails, show empty (chunking will work during actual ingestion)
            setFileText('');
            console.warn('Preview parsing not available, but ingestion will work');
          }
        } catch (parseError) {
          // Preview parsing failed, but actual ingestion will work
          setFileText('');
          console.warn('Preview parsing not available, but ingestion will work');
        }
      } else {
        setFileText('');
      }
    } catch (error) {
      console.error('Error reading file:', error);
      setFileText('');
    }
  };

  const handleRefreshDashboard = async (newIndexName?: string) => {
    // Trigger refresh by updating the trigger value
    setRefreshTrigger((prev) => prev + 1);
    // Auto-select the newly created index
    if (newIndexName) {
      setTimeout(() => {
        setSelectedIndex(newIndexName);
        setViewMode('upload');
      }, 2000); // Wait for index to be fully available
    }
    // Return Promise to satisfy type requirement
    return Promise.resolve();
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Ana Memory Creation & Training
          </h1>
          <p className="text-gray-600">
            FreightX proprietary AI agent knowledge management platform. Build intelligent memory systems with seamless document ingestion and semantic search.
          </p>
        </header>

        {/* Navigation Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'dashboard'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setViewMode('upload')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'upload'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upload & Ingest
            </button>
            <button
              onClick={() => setViewMode('query')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'query'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Query Memory
            </button>
            <button
              onClick={() => setViewMode('chatbot')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'chatbot'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Chatbot
            </button>
          </nav>
        </div>

        {/* Dashboard View */}
        {viewMode === 'dashboard' && (
          <MemoryIndexDashboard
            onSelectIndex={(indexName) => {
              setSelectedIndex(indexName);
              setViewMode('upload');
            }}
            onCreateIndex={() => setShowCreateIndex(true)}
            refreshTrigger={refreshTrigger}
          />
        )}

        {/* Upload & Ingest View */}
        {viewMode === 'upload' && (
          <div className="space-y-6">
            {!selectedIndex && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
                Please select an index from the dashboard to upload documents
              </div>
            )}

            {selectedIndex && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
                Selected Index: <strong>{selectedIndex}</strong>
                <button
                  onClick={() => setSelectedIndex(null)}
                  className="ml-4 text-blue-600 hover:text-blue-800 underline"
                >
                  Change
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DocumentUpload
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
              />
              <MetadataForm
                onMetadataChange={setMetadata}
                fileText={fileText}
              />
            </div>

            <ChunkingConfig
              text={fileText}
              onConfigChange={setChunkingConfig}
            />

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">
                Advanced Settings
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Namespace (Optional)
                  </label>
                  <input
                    type="text"
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="optional-namespace"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Embedding Dimensions
                  </label>
                  <select
                    value={dimensions}
                    onChange={(e) =>
                      setDimensions(parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value={1536}>1536</option>
                    <option value={3072}>3072</option>
                  </select>
                </div>
              </div>
            </div>

            <IngestionControls
              onStartIngestion={handleRefreshDashboard}
              selectedIndex={selectedIndex}
              selectedFile={selectedFile}
              metadata={metadata}
              chunkingConfig={chunkingConfig}
              namespace={namespace || undefined}
              dimensions={dimensions}
            />
          </div>
        )}

        {/* Query View */}
        {viewMode === 'query' && (
          <div className="max-w-4xl mx-auto">
            {selectedIndex && (
              <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
                Querying Index: <strong>{selectedIndex}</strong>
                <button
                  onClick={() => setSelectedIndex(null)}
                  className="ml-4 text-blue-600 hover:text-blue-800 underline"
                >
                  Change
                </button>
              </div>
            )}
            <QueryPanel selectedIndex={selectedIndex} />
          </div>
        )}

        {/* Chatbot View */}
        {viewMode === 'chatbot' && (
          <div className="max-w-4xl mx-auto">
            {selectedIndex && (
              <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
                Chatbot Memory: <strong>{selectedIndex}</strong>
                <button
                  onClick={() => setSelectedIndex(null)}
                  className="ml-4 text-blue-600 hover:text-blue-800 underline"
                >
                  Change
                </button>
              </div>
            )}
            {!selectedIndex && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
                Please select an index from the dashboard to use the chatbot
              </div>
            )}
            <Chatbot selectedIndex={selectedIndex} />
          </div>
        )}

        {/* Create Index Modal */}
        {showCreateIndex && (
          <CreateIndexForm
            onClose={() => setShowCreateIndex(false)}
            onSuccess={handleRefreshDashboard}
          />
        )}
      </div>
    </main>
  );
}

