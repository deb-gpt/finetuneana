'use client';

import { useState, useRef } from 'react';

interface DocumentUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

export default function DocumentUpload({
  onFileSelect,
  selectedFile,
}: DocumentUploadProps) {
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

    const files = Array.from(e.dataTransfer.files);
    const validFile = files.find(
      (file) =>
        file.type === 'application/pdf' ||
        file.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.csv')
    );

    if (validFile) {
      onFileSelect(validFile);
    } else {
      alert('Please upload a PDF, DOCX, or CSV file');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Upload Document</h2>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.csv"
          onChange={handleFileInput}
          className="hidden"
        />

        {selectedFile ? (
          <div className="space-y-2">
            <div className="text-green-600 font-medium">
              ✓ {selectedFile.name}
            </div>
            <div className="text-sm text-gray-500">
              Size: {formatFileSize(selectedFile.size)}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-primary-600 hover:text-primary-700 text-sm"
            >
              Change file
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-gray-600">
              <p className="text-lg mb-2">Drag & drop your document here</p>
              <p className="text-sm">or</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition"
            >
              Browse Files
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Supported: PDF, DOCX, CSV
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

