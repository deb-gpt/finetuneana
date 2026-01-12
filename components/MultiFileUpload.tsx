'use client';

import { useState, useRef } from 'react';

export interface FileWithMetadata {
  file: File;
  metadata: {
    topic: string;
    subtopic?: string;
    source: string;
    version?: string;
  };
  extracted: boolean;
  extracting: boolean;
  error?: string;
}

interface MultiFileUploadProps {
  onFilesChange: (files: FileWithMetadata[]) => void;
  files: FileWithMetadata[];
}

export default function MultiFileUpload({
  onFilesChange,
  files,
}: MultiFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) =>
        file.type === 'application/pdf' ||
        file.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.doc')
    );

    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    } else {
      alert('Please upload PDF, DOCX, or CSV files');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
    // Reset input to allow selecting same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addFiles = async (newFiles: File[]) => {
    const newFilesWithMetadata: FileWithMetadata[] = newFiles.map((file) => ({
      file,
      metadata: {
        topic: '',
        source: '',
      },
      extracted: false,
      extracting: false,
    }));

    const updatedFiles = [...files, ...newFilesWithMetadata];
    onFilesChange(updatedFiles);

    // Auto-extract metadata for each new file
    for (let i = files.length; i < updatedFiles.length; i++) {
      await extractMetadataForFile(updatedFiles, i);
    }
  };

  const extractMetadataForFile = async (
    fileList: FileWithMetadata[],
    index: number
  ) => {
    const fileWithMeta = fileList[index];
    if (!fileWithMeta || fileWithMeta.extracted || fileWithMeta.extracting) {
      return;
    }

    // Mark as extracting
    const updated = [...fileList];
    updated[index] = { ...fileWithMeta, extracting: true };
    onFilesChange(updated);

    try {
      // Parse file to get text for metadata extraction
      let text = '';
      if (fileWithMeta.file.name.endsWith('.csv') || fileWithMeta.file.name.endsWith('.txt')) {
        text = await fileWithMeta.file.text();
      } else {
        // For PDF/DOCX, we need to parse on server
        const formData = new FormData();
        formData.append('file', fileWithMeta.file);
        formData.append('preview', 'true');

        const response = await fetch('/api/parse-preview', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          text = data.text || '';
        }
      }

      if (text.length < 50) {
        // Not enough text, use filename-based defaults
        const updated2 = [...updated];
        updated2[index] = {
          ...fileWithMeta,
          extracting: false,
          extracted: true,
          metadata: {
            topic: 'General',
            source: fileWithMeta.file.name.split('.')[0] || 'Unknown',
          },
        };
        onFilesChange(updated2);
        return;
      }

      // Extract metadata using GPT
      const metadataResponse = await fetch('/api/extract-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.substring(0, 5000), // First 5000 chars
          filename: fileWithMeta.file.name,
        }),
      });

      if (metadataResponse.ok) {
        const extractedMetadata = await metadataResponse.json();
        const updated2 = [...updated];
        updated2[index] = {
          ...fileWithMeta,
          extracting: false,
          extracted: true,
          metadata: {
            topic: extractedMetadata.topic || 'General',
            subtopic: extractedMetadata.subtopic,
            source: extractedMetadata.source || fileWithMeta.file.name.split('.')[0] || 'Unknown',
            version: extractedMetadata.version,
          },
        };
        onFilesChange(updated2);
      } else {
        throw new Error('Failed to extract metadata');
      }
    } catch (error: any) {
      console.error('Error extracting metadata:', error);
      const updated2 = [...updated];
      updated2[index] = {
        ...fileWithMeta,
        extracting: false,
        extracted: true,
        error: error.message,
        metadata: {
          topic: 'General',
          source: fileWithMeta.file.name.split('.')[0] || 'Unknown',
        },
      };
      onFilesChange(updated2);
    }
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
  };

  const updateFileMetadata = (
    index: number,
    field: 'topic' | 'subtopic' | 'source' | 'version',
    value: string
  ) => {
    const updated = [...files];
    updated[index] = {
      ...updated[index],
      metadata: {
        ...updated[index].metadata,
        [field]: value,
      },
    };
    onFilesChange(updated);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Upload Documents</h2>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors mb-4 ${
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.csv"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="space-y-4">
          <div className="text-gray-600">
            <p className="text-lg mb-2">Drag & drop your documents here</p>
            <p className="text-sm">or</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition"
          >
            Browse Files (Multiple)
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Supported: PDF, DOCX, CSV (You can select multiple files)
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">
            Selected Files ({files.length})
          </h3>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {files.map((fileWithMeta, index) => (
              <div
                key={`${fileWithMeta.file.name}-${index}`}
                className="border border-gray-300 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">
                      {fileWithMeta.file.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      Size: {formatFileSize(fileWithMeta.file.size)}
                    </div>
                    {fileWithMeta.extracting && (
                      <div className="text-sm text-blue-600 mt-1">
                        ⏳ Extracting metadata...
                      </div>
                    )}
                    {fileWithMeta.error && (
                      <div className="text-sm text-yellow-600 mt-1">
                        ⚠️ {fileWithMeta.error}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Topic *
                    </label>
                    <input
                      type="text"
                      value={fileWithMeta.metadata.topic}
                      onChange={(e) =>
                        updateFileMetadata(index, 'topic', e.target.value)
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                      placeholder="Topic"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Source *
                    </label>
                    <input
                      type="text"
                      value={fileWithMeta.metadata.source}
                      onChange={(e) =>
                        updateFileMetadata(index, 'source', e.target.value)
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                      placeholder="Source"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Subtopic
                    </label>
                    <input
                      type="text"
                      value={fileWithMeta.metadata.subtopic || ''}
                      onChange={(e) =>
                        updateFileMetadata(index, 'subtopic', e.target.value)
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                      placeholder="Subtopic (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Version
                    </label>
                    <input
                      type="text"
                      value={fileWithMeta.metadata.version || ''}
                      onChange={(e) =>
                        updateFileMetadata(index, 'version', e.target.value)
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                      placeholder="Version (optional)"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

