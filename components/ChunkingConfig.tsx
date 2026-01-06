'use client';

import { useState, useEffect } from 'react';
import { ChunkingService, Chunk } from '@/lib/services/chunking.service';

interface ChunkingConfigProps {
  text: string;
  onConfigChange: (config: {
    chunkSize: number;
    overlap: number;
    useHeadings: boolean;
  }) => void;
}

export default function ChunkingConfig({
  text,
  onConfigChange,
}: ChunkingConfigProps) {
  const [config, setConfig] = useState({
    chunkSize: 2000, // Increased default for better context
    overlap: 300, // Increased overlap for better continuity
    useHeadings: false,
  });
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());
  const [showAllChunks, setShowAllChunks] = useState(false);

  useEffect(() => {
    onConfigChange(config);
    if (text) {
      const chunkingService = new ChunkingService();
      const allChunks = chunkingService.chunkText(text, config);
      setChunks(allChunks);
      // Expand first chunk by default
      if (allChunks.length > 0) {
        setExpandedChunks(new Set([0]));
      }
    } else {
      setChunks([]);
    }
  }, [config, text, onConfigChange]);

  const toggleChunk = (index: number) => {
    setExpandedChunks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedChunks(new Set(chunks.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedChunks(new Set());
  };

  const avgChunkSize = chunks.length > 0
    ? Math.round(chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / chunks.length)
    : 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">
        Chunking Configuration
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Chunk Size (characters)
          </label>
          <input
            type="number"
            min="100"
            max="5000"
            value={config.chunkSize}
            onChange={(e) =>
              setConfig({ ...config, chunkSize: parseInt(e.target.value) || 1000 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Overlap (characters)
          </label>
          <input
            type="number"
            min="0"
            max={config.chunkSize}
            value={config.overlap}
            onChange={(e) =>
              setConfig({ ...config, overlap: parseInt(e.target.value) || 0 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="useHeadings"
            checked={config.useHeadings}
            onChange={(e) =>
              setConfig({ ...config, useHeadings: e.target.checked })
            }
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="useHeadings" className="ml-2 text-sm text-gray-700">
            Split guided by headings
          </label>
        </div>

        {!text && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-sm text-yellow-700">
              <strong>Note:</strong> Chunk preview is not available for this file. 
              This may be because the file is too large (over 4MB) or the file type requires server-side parsing. 
              The file will be properly parsed during ingestion. 
              You can still configure chunking settings - they will be applied during ingestion.
            </div>
          </div>
        )}

        {chunks.length > 0 && text && (
          <div className="mt-4 space-y-4">
            {/* Chunk Statistics */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-semibold text-gray-700">Total Chunks</div>
                  <div className="text-2xl font-bold text-primary-600">{chunks.length}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700">Avg Size</div>
                  <div className="text-2xl font-bold text-primary-600">{avgChunkSize.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">chars</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700">Min Size</div>
                  <div className="text-2xl font-bold text-primary-600">
                    {Math.min(...chunks.map(c => c.text.length)).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700">Max Size</div>
                  <div className="text-2xl font-bold text-primary-600">
                    {Math.max(...chunks.map(c => c.text.length)).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Chunk Preview Controls */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">
                Chunk Previews ({chunks.length} chunks)
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowAllChunks(!showAllChunks)}
                  className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  {showAllChunks ? 'Hide All' : 'Show All'}
                </button>
                <button
                  onClick={expandAll}
                  className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* Chunk List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {chunks.map((chunk, index) => {
                const isExpanded = showAllChunks || expandedChunks.has(index);
                const previewLength = 200;
                const showFull = chunk.text.length <= previewLength || isExpanded;

                return (
                  <div
                    key={chunk.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleChunk(index)}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex justify-between items-center text-left transition"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="font-semibold text-gray-700">
                          Chunk {index + 1}
                        </span>
                        <span className="text-xs text-gray-500">
                          {chunk.text.length.toLocaleString()} chars
                        </span>
                        {chunk.page && (
                          <span className="text-xs text-gray-500">
                            Page {chunk.page}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="p-4 bg-white border-t border-gray-200">
                        <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                          {showFull ? chunk.text : `${chunk.text.substring(0, previewLength)}...`}
                        </div>
                        {!showFull && (
                          <button
                            onClick={() => toggleChunk(index)}
                            className="mt-2 text-xs text-primary-600 hover:text-primary-800"
                          >
                            Show full chunk ({chunk.text.length.toLocaleString()} chars)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

