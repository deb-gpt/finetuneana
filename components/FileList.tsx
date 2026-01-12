'use client';

import { useState, useEffect } from 'react';

interface File {
  filename: string;
  namespace: string;
  uploaded_at: string;
  chunks_count: number;
  vectors_count: number;
  topic: string;
  source: string;
  metadata: Record<string, any>;
}

interface FileListProps {
  indexName: string;
  namespace?: string;
  onFileDeleted?: () => void;
}

export default function FileList({ indexName, namespace, onFileDeleted }: FileListProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (indexName) {
      fetchFiles();
    }
  }, [indexName, namespace]);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/indexes/${indexName}/files${namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err: any) {
      console.error('Error fetching files:', err);
      setError(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete all vectors for "${filename}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(filename);
    try {
      const url = `/api/indexes/${indexName}/files/${encodeURIComponent(filename)}${namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''}`;
      const response = await fetch(url, { method: 'DELETE' });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete file');
      }
      
      const data = await response.json();
      alert(`Successfully deleted ${data.vectorsDeleted} vectors for "${filename}"`);
      
      // Refresh file list
      await fetchFiles();
      
      // Notify parent component
      if (onFileDeleted) {
        onFileDeleted();
      }
    } catch (err: any) {
      console.error('Error deleting file:', err);
      alert(`Error: ${err.message || 'Failed to delete file'}`);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-gray-600">Loading files...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-600">Error: {error}</div>
        <button
          onClick={fetchFiles}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Uploaded Files</h2>
        <button
          onClick={fetchFiles}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
        >
          🔄 Refresh
        </button>
      </div>

      {namespace && (
        <div className="mb-4 text-sm text-gray-600">
          Namespace: <span className="font-semibold">{namespace}</span>
        </div>
      )}

      {files.length === 0 ? (
        <div className="text-gray-600 p-4 border border-gray-300 rounded">
          No files uploaded yet. Upload a document to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300 rounded-lg">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left border-b">Filename</th>
                <th className="px-4 py-2 text-left border-b">Topic</th>
                <th className="px-4 py-2 text-left border-b">Source</th>
                <th className="px-4 py-2 text-left border-b">Uploaded</th>
                <th className="px-4 py-2 text-left border-b">Chunks</th>
                <th className="px-4 py-2 text-left border-b">Vectors</th>
                <th className="px-4 py-2 text-left border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.filename} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b">
                    <div className="font-medium">{file.filename}</div>
                    {file.namespace && (
                      <div className="text-xs text-gray-500">NS: {file.namespace}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 border-b">{file.topic}</td>
                  <td className="px-4 py-2 border-b">{file.source}</td>
                  <td className="px-4 py-2 border-b text-sm text-gray-600">
                    {formatDate(file.uploaded_at)}
                  </td>
                  <td className="px-4 py-2 border-b text-center">{file.chunks_count}</td>
                  <td className="px-4 py-2 border-b text-center">{file.vectors_count}</td>
                  <td className="px-4 py-2 border-b">
                    <button
                      onClick={() => handleDelete(file.filename)}
                      disabled={deleting === file.filename}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {deleting === file.filename ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        Total files: <span className="font-semibold">{files.length}</span>
      </div>
    </div>
  );
}

