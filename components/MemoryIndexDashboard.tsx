'use client';

import { useState, useEffect } from 'react';

interface Index {
  name: string;
  dimension: number;
  metric: string;
  totalVectors: number;
  lastUpdated: string;
}

interface MemoryIndexDashboardProps {
  onSelectIndex: (indexName: string) => void;
  onCreateIndex: () => void;
  refreshTrigger?: number;
}

export default function MemoryIndexDashboard({
  onSelectIndex,
  onCreateIndex,
  refreshTrigger,
}: MemoryIndexDashboardProps) {
  const [indexes, setIndexes] = useState<Index[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIndexes = async (retryCount = 0) => {
    try {
      setLoading(true);
      // Add cache busting to ensure fresh data - use timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/indexes?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch indexes');
      const data = await response.json();
      let indexesList = data.indexes || [];
      
      // Sort by name in reverse alphabetical order (newest first)
      // This ensures newly created indexes appear at the top
      indexesList.sort((a: Index, b: Index) => {
        return b.name.localeCompare(a.name);
      });
      
      setIndexes(indexesList);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      // Retry once after a delay if this is a refresh trigger
      if (retryCount === 0 && refreshTrigger !== undefined) {
        setTimeout(() => fetchIndexes(1), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIndexes();
  }, [refreshTrigger]);

  const handleDelete = async (indexName: string) => {
    if (!confirm(`Are you sure you want to delete index "${indexName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/index?name=${encodeURIComponent(indexName)}`, {
        method: 'DELETE',
        cache: 'no-store', // Prevent caching
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete index');
      }

      // Optimistically remove from UI immediately for better UX
      setIndexes(prev => prev.filter(idx => idx.name !== indexName));
      
      // Pinecone deletion is asynchronous - wait and retry fetching
      // The index will be in "Deleting" state first, then disappear
      // Refresh multiple times to catch the deletion
      const refreshAfterDelete = async () => {
        for (let i = 0; i < 4; i++) {
          await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1))); // 1.5s, 3s, 4.5s, 6s
          await fetchIndexes();
        }
      };
      
      // Start refreshing after initial delay
      refreshAfterDelete();
      
    } catch (err: any) {
      setError(`Error deleting index: ${err.message}`);
      // Refresh to get accurate state
      await fetchIndexes();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">Loading indexes...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Memory Indexes</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => fetchIndexes()}
            disabled={loading}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
            title="Refresh list"
          >
            🔄 Refresh
          </button>
          <button
            onClick={onCreateIndex}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
          >
            Create New Index
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {indexes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No indexes found. Create your first index to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dimension
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metric
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vectors
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {indexes.map((index) => (
                <tr key={index.name} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {index.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {index.dimension}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {index.metric}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {index.totalVectors.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(index.lastUpdated).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => onSelectIndex(index.name)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      View
                    </button>
                    <button
                      onClick={() => onSelectIndex(index.name)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      Query
                    </button>
                    <button
                      onClick={() => handleDelete(index.name)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

