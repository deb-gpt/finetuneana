'use client';

import { useState } from 'react';

interface IngestionControlsProps {
  onStartIngestion: () => Promise<void>;
  selectedIndex: string | null;
  selectedFile: File | null;
  metadata: {
    topic: string;
    subtopic?: string;
    source: string;
    version?: string;
  };
  chunkingConfig: {
    chunkSize: number;
    overlap: number;
    useHeadings: boolean;
  };
  namespace?: string;
  dimensions?: number;
}

export default function IngestionControls({
  onStartIngestion,
  selectedIndex,
  selectedFile,
  metadata,
  chunkingConfig,
  namespace,
  dimensions = 1536,
}: IngestionControlsProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);

  const handleIngestion = async () => {
    if (!selectedIndex || !selectedFile || !metadata.topic || !metadata.source) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setProgress('');
    setLogs([]);

    try {
      setLogs((prev) => [...prev, 'Starting ingestion process...']);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('indexName', selectedIndex);
      if (namespace) formData.append('namespace', namespace);
      formData.append('topic', metadata.topic);
      if (metadata.subtopic) formData.append('subtopic', metadata.subtopic);
      formData.append('source', metadata.source);
      if (metadata.version) formData.append('version', metadata.version);
      formData.append('chunkSize', chunkingConfig.chunkSize.toString());
      formData.append('overlap', chunkingConfig.overlap.toString());
      formData.append('useHeadings', chunkingConfig.useHeadings.toString());
      formData.append('dimensions', dimensions.toString());

      setLogs((prev) => [...prev, 'Uploading file...']);
      setProgress('Uploading...');

      const response = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      setProgress('Processing...');
      setLogs((prev) => [...prev, 'Processing document...']);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ingestion failed');
      }

      setLogs((prev) => [
        ...prev,
        `✓ Document processed`,
        `✓ Chunking completed: ${data.stats.chunksCreated} chunks`,
        `✓ Embeddings generated`,
        `✓ Vectors upserted: ${data.stats.vectorsUpserted} vectors in ${data.stats.batches} batches`,
        '✓ Ingestion completed successfully!',
      ]);
      setProgress('Complete');

      await onStartIngestion();
    } catch (error: any) {
      setLogs((prev) => [...prev, `✗ Error: ${error.message}`]);
      setProgress('Failed');
      alert(`Ingestion failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const canStart =
    selectedIndex &&
    selectedFile &&
    metadata.topic &&
    metadata.source &&
    !loading;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">
        Ingestion Controls
      </h2>

      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              <strong>Index:</strong> {selectedIndex || 'Not selected'}
            </div>
            <div>
              <strong>File:</strong> {selectedFile?.name || 'Not selected'}
            </div>
            <div>
              <strong>Topic:</strong> {metadata.topic || 'Not set'}
            </div>
            <div>
              <strong>Source:</strong> {metadata.source || 'Not set'}
            </div>
          </div>
        </div>

        {loading && progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{progress}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width:
                    progress === 'Complete'
                      ? '100%'
                      : progress === 'Failed'
                      ? '0%'
                      : '50%',
                }}
              />
            </div>
          </div>
        )}

        {logs.length > 0 && (
          <div className="p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-sm max-h-60 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        )}

        <button
          onClick={handleIngestion}
          disabled={!canStart}
          className="w-full bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
        >
          {loading ? 'Processing...' : 'Start Ingestion'}
        </button>
      </div>
    </div>
  );
}

