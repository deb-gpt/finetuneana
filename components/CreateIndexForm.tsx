'use client';

import { useState } from 'react';

interface CreateIndexFormProps {
  onClose: () => void;
  onSuccess: (indexName?: string) => void;
}

export default function CreateIndexForm({
  onClose,
  onSuccess,
}: CreateIndexFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    dimension: 1536,
    metric: 'cosine' as 'cosine' | 'euclidean' | 'dotproduct',
    namespace: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/create-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create index');
      }

      // Wait a moment for Pinecone to register the new index
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      onSuccess(formData.name);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Create New Index</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Index Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="my-memory-index"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dimension *
            </label>
            <select
              value={formData.dimension}
              onChange={(e) =>
                setFormData({ ...formData, dimension: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value={1536}>1536 (text-embedding-3-large default)</option>
              <option value={3072}>3072 (text-embedding-3-large max)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Metric *
            </label>
            <select
              value={formData.metric}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  metric: e.target.value as 'cosine' | 'euclidean' | 'dotproduct',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="cosine">Cosine</option>
              <option value="euclidean">Euclidean</option>
              <option value="dotproduct">Dot Product</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Namespace (Optional)
            </label>
            <input
              type="text"
              value={formData.namespace}
              onChange={(e) =>
                setFormData({ ...formData, namespace: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="optional-namespace"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Index'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

