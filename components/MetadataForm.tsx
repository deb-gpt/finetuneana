'use client';

import { useState, useEffect } from 'react';

interface MetadataFormProps {
  onMetadataChange: (metadata: {
    topic: string;
    subtopic?: string;
    source: string;
    version?: string;
  }) => void;
  fileText?: string;
}

export default function MetadataForm({
  onMetadataChange,
  fileText,
}: MetadataFormProps) {
  const [metadata, setMetadata] = useState({
    topic: '',
    subtopic: '',
    source: '',
    version: '',
  });
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    onMetadataChange({
      topic: metadata.topic,
      subtopic: metadata.subtopic || undefined,
      source: metadata.source,
      version: metadata.version || undefined,
    });
  }, [metadata, onMetadataChange]);

  const handleSuggestTopic = async () => {
    if (!fileText || fileText.length < 100) {
      alert('File text is too short to suggest topics');
      return;
    }

    setSuggesting(true);
    try {
      const response = await fetch('/api/suggest-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fileText.substring(0, 2000) }),
      });

      if (!response.ok) throw new Error('Failed to suggest topic');

      const data = await response.json();
      setMetadata({
        ...metadata,
        topic: data.topic || metadata.topic,
        subtopic: data.subtopic || metadata.subtopic,
      });
    } catch (error) {
      console.error('Error suggesting topic:', error);
      alert('Failed to suggest topic. Please enter manually.');
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">
        Metadata & Topic Tagging
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Topic *
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              required
              value={metadata.topic}
              onChange={(e) =>
                setMetadata({ ...metadata, topic: e.target.value })
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="e.g., Machine Learning"
            />
            {fileText && (
              <button
                type="button"
                onClick={handleSuggestTopic}
                disabled={suggesting}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm"
              >
                {suggesting ? 'Suggesting...' : 'Auto-suggest'}
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subtopic (Optional)
          </label>
          <input
            type="text"
            value={metadata.subtopic}
            onChange={(e) =>
              setMetadata({ ...metadata, subtopic: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="e.g., Neural Networks"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Source *
          </label>
          <input
            type="text"
            required
            value={metadata.source}
            onChange={(e) =>
              setMetadata({ ...metadata, source: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="e.g., Research Paper, Documentation"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Version / Year (Optional)
          </label>
          <input
            type="text"
            value={metadata.version}
            onChange={(e) =>
              setMetadata({ ...metadata, version: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="e.g., 2024, v1.0"
          />
        </div>
      </div>
    </div>
  );
}

