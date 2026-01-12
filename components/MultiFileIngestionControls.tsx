'use client';

import { useState } from 'react';
import { FileWithMetadata } from './MultiFileUpload';

interface MultiFileIngestionControlsProps {
  onStartIngestion: () => Promise<void>;
  selectedIndex: string | null;
  files: FileWithMetadata[];
  chunkingConfig: {
    chunkSize: number;
    overlap: number;
    useHeadings: boolean;
  };
  namespace?: string;
  dimensions?: number;
}

export default function MultiFileIngestionControls({
  onStartIngestion,
  selectedIndex,
  files,
  chunkingConfig,
  namespace,
  dimensions = 1536,
}: MultiFileIngestionControlsProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0);
  const [results, setResults] = useState<Array<{
    filename: string;
    success: boolean;
    message: string;
    stats?: any;
    error?: string;
  }>>([]);

  const handleIngestion = async () => {
    if (!selectedIndex || files.length === 0) {
      alert('Please select an index and add at least one file');
      return;
    }

    // Validate all files have required metadata
    const invalidFiles = files.filter(
      (f) => !f.metadata.topic || !f.metadata.source
    );
    if (invalidFiles.length > 0) {
      alert(
        `Please fill in topic and source for all files. Missing: ${invalidFiles.map((f) => f.file.name).join(', ')}`
      );
      return;
    }

    setLoading(true);
    setProgress('');
    setLogs([]);
    setResults([]);
    setCurrentFileIndex(0);

    const allResults: typeof results = [];

    try {
      setLogs((prev) => [
        ...prev,
        `Starting ingestion for ${files.length} file(s)...`,
      ]);

      // Process files one by one
      for (let i = 0; i < files.length; i++) {
        const fileWithMeta = files[i];
        setCurrentFileIndex(i);
        setProgress(`Processing ${i + 1}/${files.length}: ${fileWithMeta.file.name}`);

        setLogs((prev) => [
          ...prev,
          `\n[${i + 1}/${files.length}] Processing: ${fileWithMeta.file.name}`,
        ]);

        try {
          const fileSizeMB = fileWithMeta.file.size / (1024 * 1024);
          const VERCEL_LIMIT_MB = 4.0; // Use 4MB as safe limit (Vercel limit is 4.5MB)
          let response: Response;
          let data: any;

          // For files larger than 4MB, upload to Vercel Blob first, then process
          if (fileSizeMB > VERCEL_LIMIT_MB) {
            setLogs((prev) => [
              ...prev,
              `📤 File is ${fileSizeMB.toFixed(2)}MB (exceeds ${VERCEL_LIMIT_MB}MB limit). Uploading to blob storage...`,
            ]);

            // Step 1: Upload to Vercel Blob
            const uploadFormData = new FormData();
            uploadFormData.append('file', fileWithMeta.file);

            const uploadResponse = await fetch('/api/upload-blob', {
              method: 'POST',
              body: uploadFormData,
            });

            if (!uploadResponse.ok) {
              const uploadError = await uploadResponse.json();
              throw new Error(`Failed to upload to blob: ${uploadError.error || 'Unknown error'}`);
            }

            const uploadData = await uploadResponse.json();
            setLogs((prev) => [
              ...prev,
              `✓ Uploaded to blob storage: ${uploadData.url}`,
              `🔄 Processing from blob...`,
            ]);

            // Step 2: Process from blob URL
            response = await fetch('/api/ingest-from-blob', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                blobUrl: uploadData.url,
                filename: fileWithMeta.file.name,
                indexName: selectedIndex,
                namespace: namespace,
                topic: fileWithMeta.metadata.topic,
                subtopic: fileWithMeta.metadata.subtopic,
                source: fileWithMeta.metadata.source,
                version: fileWithMeta.metadata.version,
                chunkSize: chunkingConfig.chunkSize,
                overlap: chunkingConfig.overlap,
                useHeadings: chunkingConfig.useHeadings,
                dimensions: dimensions,
              }),
            });
          } else {
            // For files under 4MB, use direct upload
            const formData = new FormData();
            formData.append('file', fileWithMeta.file);
            formData.append('indexName', selectedIndex);
            if (namespace) formData.append('namespace', namespace);
            formData.append('topic', fileWithMeta.metadata.topic);
            if (fileWithMeta.metadata.subtopic)
              formData.append('subtopic', fileWithMeta.metadata.subtopic);
            formData.append('source', fileWithMeta.metadata.source);
            if (fileWithMeta.metadata.version)
              formData.append('version', fileWithMeta.metadata.version);
            formData.append('chunkSize', chunkingConfig.chunkSize.toString());
            formData.append('overlap', chunkingConfig.overlap.toString());
            formData.append('useHeadings', chunkingConfig.useHeadings.toString());
            formData.append('dimensions', dimensions.toString());

            response = await fetch('/api/ingest', {
              method: 'POST',
              body: formData,
            });
          }

          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            data = await response.json();
          } else {
            const text = await response.text();
            throw new Error(text.substring(0, 200) || 'Ingestion failed');
          }

          if (!response.ok) {
            if (response.status === 409 && data.code === 'DUPLICATE_FILE') {
              throw new Error(
                `Duplicate file: ${data.existingFile?.filename}. ${data.suggestion || ''}`
              );
            }
            throw new Error(data.error || data.message || 'Ingestion failed');
          }

          allResults.push({
            filename: fileWithMeta.file.name,
            success: true,
            message: 'Ingested successfully',
            stats: data.stats,
          });

          setLogs((prev) => [
            ...prev,
            `✓ ${fileWithMeta.file.name}: ${data.stats.vectorsUpserted} vectors upserted`,
          ]);
        } catch (error: any) {
          allResults.push({
            filename: fileWithMeta.file.name,
            success: false,
            message: 'Failed',
            error: error.message,
          });

          setLogs((prev) => [
            ...prev,
            `✗ ${fileWithMeta.file.name}: ${error.message}`,
          ]);
        }
      }

      setResults(allResults);

      const successCount = allResults.filter((r) => r.success).length;
      const failCount = allResults.filter((r) => !r.success).length;

      setLogs((prev) => [
        ...prev,
        `\n=== Summary ===`,
        `✓ Successful: ${successCount}`,
        `✗ Failed: ${failCount}`,
        `Total: ${files.length}`,
      ]);

      setProgress('Complete');

      if (successCount > 0) {
        await onStartIngestion();
      }
    } catch (error: any) {
      setLogs((prev) => [...prev, `✗ Error: ${error.message}`]);
      setProgress('Failed');
    } finally {
      setLoading(false);
    }
  };

  const canStart =
    selectedIndex &&
    files.length > 0 &&
    files.every((f) => f.metadata.topic && f.metadata.source) &&
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
              <strong>Files:</strong> {files.length} file(s) ready
            </div>
            <div>
              <strong>Namespace:</strong> {namespace || 'default'}
            </div>
          </div>
        </div>

        {loading && progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{progress}</span>
              {currentFileIndex < files.length && (
                <span className="text-gray-500">
                  {currentFileIndex + 1}/{files.length}
                </span>
              )}
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
                      : `${((currentFileIndex + 1) / files.length) * 100}%`,
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

        {results.length > 0 && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2">Results:</h3>
            <div className="space-y-1 text-sm">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={result.success ? 'text-green-600' : 'text-red-600'}
                >
                  {result.success ? '✓' : '✗'} {result.filename}
                  {result.stats && (
                    <span className="text-gray-600 ml-2">
                      ({result.stats.vectorsUpserted} vectors)
                    </span>
                  )}
                  {result.error && (
                    <span className="text-red-600 ml-2">- {result.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleIngestion}
          disabled={!canStart}
          className="w-full bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
        >
          {loading
            ? `Processing... (${currentFileIndex + 1}/${files.length})`
            : `Start Ingestion (${files.length} file${files.length !== 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  );
}

