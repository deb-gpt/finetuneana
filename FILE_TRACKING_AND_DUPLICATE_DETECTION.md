# File Tracking & Duplicate Detection Guide

## Overview

Implement duplicate file detection and comprehensive file tracking to prevent re-uploading the same documents and maintain a registry of all files in each index.

## Features

1. **Duplicate Detection**: Prevent uploading the same file multiple times
2. **File Tracking**: Track all files uploaded to each index
3. **File Management**: List, view details, and delete files
4. **UI Components**: Display file list with details

## Implementation

### 1. File Hash Calculation

Calculate hash of file content for duplicate detection:

```python
import hashlib

def calculate_file_hash(file_content: bytes) -> str:
    """Calculate SHA256 hash of file content."""
    return hashlib.sha256(file_content).hexdigest()

# Usage
file_bytes = await file.read()
file_hash = calculate_file_hash(file_bytes)
```

### 2. Duplicate Detection Service

```python
# services/file_tracker_service.py
import hashlib
from datetime import datetime
from typing import Optional, List, Dict
import sqlite3
from pathlib import Path

class FileTrackerService:
    def __init__(self, db_path: str = "data/file_registry.db"):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize SQLite database for file tracking."""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                index_name TEXT NOT NULL,
                namespace TEXT,
                filename TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                uploaded_at TEXT NOT NULL,
                chunks_count INTEGER,
                vectors_count INTEGER,
                topic TEXT,
                source TEXT,
                metadata TEXT,
                UNIQUE(index_name, namespace, file_hash)
            )
        """)
        conn.commit()
        conn.close()
    
    def calculate_file_hash(self, file_content: bytes) -> str:
        """Calculate SHA256 hash of file content."""
        return hashlib.sha256(file_content).hexdigest()
    
    def check_duplicate(
        self, 
        index_name: str, 
        file_hash: str, 
        namespace: Optional[str] = None
    ) -> Optional[Dict]:
        """Check if file with hash already exists."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT filename, uploaded_at, namespace, chunks_count, vectors_count
            FROM files
            WHERE index_name = ? AND file_hash = ? AND (namespace = ? OR (namespace IS NULL AND ? IS NULL))
        """, (index_name, file_hash, namespace, namespace))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return {
                "filename": result[0],
                "uploaded_at": result[1],
                "namespace": result[2],
                "chunks_count": result[3],
                "vectors_count": result[4]
            }
        return None
    
    def register_file(
        self,
        index_name: str,
        filename: str,
        file_hash: str,
        namespace: Optional[str],
        chunks_count: int,
        vectors_count: int,
        metadata: Dict
    ):
        """Register a new file in the database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO files 
            (index_name, namespace, filename, file_hash, uploaded_at, chunks_count, vectors_count, topic, source, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            index_name,
            namespace,
            filename,
            file_hash,
            datetime.utcnow().isoformat(),
            chunks_count,
            vectors_count,
            metadata.get("topic"),
            metadata.get("source"),
            json.dumps(metadata)
        ))
        
        conn.commit()
        conn.close()
    
    def list_files(
        self, 
        index_name: str, 
        namespace: Optional[str] = None
    ) -> List[Dict]:
        """List all files in an index."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if namespace:
            cursor.execute("""
                SELECT filename, namespace, uploaded_at, chunks_count, vectors_count, topic, source, metadata
                FROM files
                WHERE index_name = ? AND namespace = ?
                ORDER BY uploaded_at DESC
            """, (index_name, namespace))
        else:
            cursor.execute("""
                SELECT filename, namespace, uploaded_at, chunks_count, vectors_count, topic, source, metadata
                FROM files
                WHERE index_name = ?
                ORDER BY uploaded_at DESC
            """, (index_name,))
        
        results = cursor.fetchall()
        conn.close()
        
        files = []
        for row in results:
            files.append({
                "filename": row[0],
                "namespace": row[1] or "",
                "uploaded_at": row[2],
                "chunks_count": row[3],
                "vectors_count": row[4],
                "topic": row[5],
                "source": row[6],
                "metadata": json.loads(row[7]) if row[7] else {}
            })
        
        return files
    
    def get_file_info(
        self,
        index_name: str,
        filename: str,
        namespace: Optional[str] = None
    ) -> Optional[Dict]:
        """Get details about a specific file."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT filename, namespace, uploaded_at, chunks_count, vectors_count, topic, source, metadata, file_hash
            FROM files
            WHERE index_name = ? AND filename = ? AND (namespace = ? OR (namespace IS NULL AND ? IS NULL))
        """, (index_name, filename, namespace, namespace))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return {
                "filename": result[0],
                "namespace": result[1] or "",
                "uploaded_at": result[2],
                "chunks_count": result[3],
                "vectors_count": result[4],
                "topic": result[5],
                "source": result[6],
                "metadata": json.loads(result[7]) if result[7] else {},
                "file_hash": result[8]
            }
        return None
    
    def delete_file(
        self,
        index_name: str,
        filename: str,
        namespace: Optional[str] = None
    ):
        """Remove file from registry."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            DELETE FROM files
            WHERE index_name = ? AND filename = ? AND (namespace = ? OR (namespace IS NULL AND ? IS NULL))
        """, (index_name, filename, namespace, namespace))
        
        conn.commit()
        conn.close()
```

### 3. Enhanced Ingestion with Duplicate Detection

```python
# api/routes/ingest.py
from fastapi import UploadFile, Form, File
from services.file_tracker_service import FileTrackerService
from datetime import datetime

file_tracker = FileTrackerService()

@app.post("/api/ingest")
async def ingest_document(
    file: UploadFile = File(...),
    indexName: str = Form(...),
    namespace: str = Form(None),
    forceUpload: bool = Form(False),
    # ... other parameters
):
    # Read file content
    file_content = await file.read()
    
    # Calculate file hash
    file_hash = file_tracker.calculate_file_hash(file_content)
    
    # Check for duplicates
    if not forceUpload:
        duplicate = file_tracker.check_duplicate(indexName, file_hash, namespace)
        if duplicate:
            return {
                "error": "Duplicate file",
                "code": "DUPLICATE_FILE",
                "message": f"This file has already been uploaded as '{duplicate['filename']}'",
                "existingFile": {
                    "filename": duplicate["filename"],
                    "uploaded_at": duplicate["uploaded_at"],
                    "namespace": duplicate["namespace"],
                    "chunks_count": duplicate["chunks_count"],
                    "vectors_count": duplicate["vectors_count"]
                },
                "suggestion": "Use forceUpload=true to upload anyway, or delete the existing file first"
            }
    
    # Process file (parse, chunk, embed, upsert)
    # ... existing ingestion logic ...
    
    # Prepare vectors with file_hash and uploaded_at
    uploaded_at = datetime.utcnow().isoformat()
    vectors = []
    for i, chunk in enumerate(chunks):
        vectors.append({
            "id": f"{file.filename}-{uuid.uuid4()}-{i}",
            "values": embeddings[i],
            "metadata": {
                **metadata,
                "filename": file.filename,
                "file_hash": file_hash,  # Add hash
                "uploaded_at": uploaded_at,  # Add timestamp
                "chunk_id": f"{file.filename}-{uuid.uuid4()}-{i}",
                "text": chunk.text,
                "chunk_text": chunk.text,
                "preview": chunk.text[:200]
            }
        })
    
    # Upsert to Pinecone
    await pinecone_service.upsert_vectors(indexName, vectors, namespace)
    
    # Register file in tracker
    file_tracker.register_file(
        index_name=indexName,
        filename=file.filename,
        file_hash=file_hash,
        namespace=namespace,
        chunks_count=len(chunks),
        vectors_count=len(vectors),
        metadata=metadata
    )
    
    return {
        "success": True,
        "message": "File ingested successfully",
        "stats": {
            "chunksCreated": len(chunks),
            "vectorsUpserted": len(vectors),
            "batches": len(vectors) // 100 + 1
        },
        "fileHash": file_hash
    }
```

### 4. File Management Endpoints

```python
# api/routes/files.py
from fastapi import APIRouter, Query
from services.file_tracker_service import FileTrackerService
from services.pinecone_service import PineconeService

router = APIRouter(prefix="/api/indexes/{index_name}/files", tags=["files"])
file_tracker = FileTrackerService()
pinecone_service = PineconeService()

@router.get("")
async def list_files(
    index_name: str,
    namespace: Optional[str] = Query(None)
):
    """List all files in an index."""
    files = file_tracker.list_files(index_name, namespace)
    
    return {
        "files": files,
        "total": len(files)
    }

@router.get("/{filename}")
async def get_file_details(
    index_name: str,
    filename: str,
    namespace: Optional[str] = Query(None)
):
    """Get details about a specific file."""
    file_info = file_tracker.get_file_info(index_name, filename, namespace)
    
    if not file_info:
        return {"error": "File not found"}, 404
    
    return file_info

@router.delete("/{filename}")
async def delete_file(
    index_name: str,
    filename: str,
    namespace: Optional[str] = Query(None)
):
    """Delete all vectors for a specific file."""
    file_info = file_tracker.get_file_info(index_name, filename, namespace)
    
    if not file_info:
        return {"error": "File not found"}, 404
    
    # Delete vectors from Pinecone using metadata filter
    deleted_count = await pinecone_service.delete_file_vectors(
        index_name=index_name,
        filename=filename,
        namespace=namespace
    )
    
    # Remove from tracker
    file_tracker.delete_file(index_name, filename, namespace)
    
    return {
        "success": True,
        "message": f"Deleted {deleted_count} vectors for file '{filename}'",
        "vectorsDeleted": deleted_count
    }
```

### 5. Pinecone Service - Delete File Vectors

```python
# services/pinecone_service.py
async def delete_file_vectors(
    self,
    index_name: str,
    filename: str,
    namespace: Optional[str] = None
) -> int:
    """Delete all vectors for a specific file."""
    index = self.client.index(index_name)
    namespace_obj = index.namespace(namespace) if namespace else index
    
    # Query to find all vectors with this filename
    # Note: Pinecone doesn't have direct delete by metadata filter
    # We need to query first, then delete by IDs
    
    # Get all vectors (this is a limitation - we need to query all)
    # Better: Use delete with metadata filter (if supported in your Pinecone version)
    
    # For now, we'll need to query and delete in batches
    # This is a simplified version - actual implementation may vary
    
    deleted_count = 0
    # Implementation depends on Pinecone SDK version
    # Some versions support delete with filter
    
    return deleted_count
```

## UI Components

### File List Component

```python
# Frontend component (React/Next.js example)
# components/FileList.tsx

interface File {
  filename: string;
  namespace: string;
  uploaded_at: string;
  chunks_count: number;
  vectors_count: number;
  topic: string;
  source: string;
}

export default function FileList({ indexName, namespace }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchFiles();
  }, [indexName, namespace]);
  
  const fetchFiles = async () => {
    try {
      const url = `/api/indexes/${indexName}/files${namespace ? `?namespace=${namespace}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      setFiles(data.files);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete all vectors for "${filename}"?`)) return;
    
    try {
      const url = `/api/indexes/${indexName}/files/${filename}${namespace ? `?namespace=${namespace}` : ''}`;
      const response = await fetch(url, { method: 'DELETE' });
      const data = await response.json();
      
      if (data.success) {
        alert(`Deleted ${data.vectorsDeleted} vectors`);
        fetchFiles(); // Refresh list
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };
  
  if (loading) return <div>Loading files...</div>;
  
  return (
    <div className="file-list">
      <h2>Files in Index: {indexName}</h2>
      {namespace && <p>Namespace: {namespace}</p>}
      
      <table>
        <thead>
          <tr>
            <th>Filename</th>
            <th>Topic</th>
            <th>Source</th>
            <th>Uploaded</th>
            <th>Chunks</th>
            <th>Vectors</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.filename}>
              <td>{file.filename}</td>
              <td>{file.topic}</td>
              <td>{file.source}</td>
              <td>{new Date(file.uploaded_at).toLocaleString()}</td>
              <td>{file.chunks_count}</td>
              <td>{file.vectors_count}</td>
              <td>
                <button onClick={() => handleDelete(file.filename)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {files.length === 0 && <p>No files uploaded yet.</p>}
    </div>
  );
}
```

## API Response Examples

### Duplicate Detection Error

```json
{
  "error": "Duplicate file",
  "code": "DUPLICATE_FILE",
  "message": "This file has already been uploaded as 'document.pdf'",
  "existingFile": {
    "filename": "document.pdf",
    "uploaded_at": "2024-01-15T10:30:00Z",
    "namespace": "documents",
    "chunks_count": 45,
    "vectors_count": 45
  },
  "suggestion": "Use forceUpload=true to upload anyway, or delete the existing file first"
}
```

### List Files Response

```json
{
  "files": [
    {
      "filename": "document1.pdf",
      "namespace": "documents",
      "uploaded_at": "2024-01-15T10:30:00Z",
      "chunks_count": 45,
      "vectors_count": 45,
      "topic": "Transportation",
      "source": "ATRI Reports",
      "metadata": {
        "subtopic": "Electric Vehicles",
        "version": "2024.1"
      }
    }
  ],
  "total": 1
}
```

## Best Practices

1. **Hash Algorithm**: Use SHA256 for better collision resistance
2. **File Registry**: Maintain SQLite database for fast lookups (alternative: query Pinecone metadata)
3. **Namespace Support**: Track files per namespace for better organization
4. **Cleanup**: When deleting files, remove from both Pinecone and registry
5. **Force Upload**: Allow `forceUpload=true` for cases where re-upload is intentional
6. **UI Updates**: Refresh file list after upload/delete operations
7. **Error Handling**: Provide clear error messages for duplicate files

## Alternative: Query-Based Tracking

If you don't want to maintain a separate database, you can query Pinecone metadata:

```python
async def check_duplicate_via_query(
    index_name: str,
    file_hash: str,
    namespace: Optional[str] = None
) -> bool:
    """Check duplicate by querying Pinecone metadata."""
    # Query with metadata filter (if supported)
    # This is less efficient but doesn't require separate database
    pass
```

However, maintaining a file registry is recommended for better performance and easier management.

