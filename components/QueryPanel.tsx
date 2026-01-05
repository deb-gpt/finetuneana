'use client';

import { useState, useEffect } from 'react';

interface QueryResult {
  id: string;
  score: number;
  metadata: {
    source?: string;
    topic?: string;
    subtopic?: string;
    text?: string;
    filename?: string;
    page?: number;
  };
}

interface QueryPanelProps {
  selectedIndex: string | null;
}

export default function QueryPanel({ selectedIndex }: QueryPanelProps) {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [topK, setTopK] = useState(5);
  const [namespace, setNamespace] = useState('');
  const [availableNamespaces, setAvailableNamespaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingNamespaces, setLoadingNamespaces] = useState(false);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load available namespaces when index changes
  useEffect(() => {
    if (selectedIndex) {
      loadNamespaces();
    } else {
      setAvailableNamespaces([]);
      setNamespace('');
    }
  }, [selectedIndex]);

  const loadNamespaces = async () => {
    if (!selectedIndex) return;
    
    setLoadingNamespaces(true);
    try {
      const response = await fetch(`/api/index-namespaces?indexName=${encodeURIComponent(selectedIndex)}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableNamespaces(data.namespaces || []);
        
        // Auto-select the first namespace if only one exists
        if (data.namespaces && data.namespaces.length === 1) {
          setNamespace(data.namespaces[0]);
        }
      }
    } catch (err) {
      console.error('Error loading namespaces:', err);
    } finally {
      setLoadingNamespaces(false);
    }
  };

  const handleQuery = async () => {
    if (!selectedIndex || !query.trim()) {
      alert('Please select an index and enter a query');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indexName: selectedIndex,
          query: query.trim(),
          topK,
          topic: topic.trim() || undefined,
          subtopic: subtopic.trim() || undefined,
          namespace: namespace.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Query failed');
      }

      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Query Memory</h2>

      {!selectedIndex && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-4">
          Please select an index from the dashboard to query
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Query Text *
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your search query..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topic Filter (Optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Filter by topic"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subtopic Filter (Optional)
            </label>
            <input
              type="text"
              value={subtopic}
              onChange={(e) => setSubtopic(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Filter by subtopic"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Top K Results
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Namespace {availableNamespaces.length > 0 && `(Found: ${availableNamespaces.length})`}
            </label>
            {loadingNamespaces ? (
              <div className="text-sm text-gray-500 py-2">Loading namespaces...</div>
            ) : availableNamespaces.length > 0 ? (
              <select
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Default namespace (empty)</option>
                {availableNamespaces.map((ns) => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter namespace (e.g., atri_reports) or leave empty for default"
              />
            )}
            {availableNamespaces.length > 0 && namespace && (
              <p className="text-xs text-gray-500 mt-1">
                Selected: <strong>{namespace}</strong>
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleQuery}
          disabled={!selectedIndex || !query.trim() || loading}
          className="w-full bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="font-semibold text-gray-800">
              Results ({results.length})
            </h3>
            {results.map((result, index) => (
              <div
                key={result.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium text-gray-600">
                    Result #{index + 1} (Score: {result.score.toFixed(4)})
                  </div>
                  <div className="text-xs text-gray-500">
                    {result.metadata.filename && (
                      <span>File: {result.metadata.filename}</span>
                    )}
                    {result.metadata.page && (
                      <span className="ml-2">Page: {result.metadata.page}</span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-700 mb-2">
                  <div>
                    <strong>Topic:</strong> {result.metadata.topic || 'N/A'}
                    {result.metadata.subtopic && (
                      <span className="ml-2">
                        → <strong>Subtopic:</strong> {result.metadata.subtopic}
                      </span>
                    )}
                  </div>
                  <div>
                    <strong>Source:</strong> {result.metadata.source || 'N/A'}
                  </div>
                </div>
                <div className="text-sm text-gray-800 bg-gray-50 p-3 rounded mt-2">
                  {result.metadata.text || 'No text preview available'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

