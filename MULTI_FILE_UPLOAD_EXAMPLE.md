# Multi-File Upload Example

This document shows how to use the multi-file upload feature in the FastAPI implementation.

## API Request Example

### Using curl (Single Request with Multiple Files)

```bash
curl -X POST "http://localhost:8000/api/ingest" \
  -F "files=@document1.pdf" \
  -F "files=@document2.pdf" \
  -F "files=@document3.pdf" \
  -F "indexName=my-index" \
  -F "namespace=my-namespace" \
  -F "topic=General Knowledge" \
  -F "subtopic=Documentation" \
  -F "source=Company Docs" \
  -F "version=1.0" \
  -F "chunkSize=2000" \
  -F "overlap=300" \
  -F "useHeadings=false" \
  -F "dimensions=1536" \
  -F 'fileMetadata={"document1.pdf":{"topic":"Specific Topic 1","subtopic":"Custom Subtopic"},"document2.pdf":{"source":"Custom Source 2"}}'
```

### Using Python requests

```python
import requests

files = [
    ('files', open('document1.pdf', 'rb')),
    ('files', open('document2.pdf', 'rb')),
    ('files', open('document3.pdf', 'rb')),
]

file_metadata = {
    "document1.pdf": {
        "topic": "Custom Topic 1",
        "subtopic": "Custom Subtopic 1",
        "source": "Custom Source 1"
    },
    "document2.pdf": {
        "topic": "Custom Topic 2",
        "source": "Custom Source 2"
    }
    # document3.pdf will use shared metadata
}

data = {
    'indexName': 'my-index',
    'namespace': 'my-namespace',
    'topic': 'General Knowledge',  # Shared topic
    'subtopic': 'Documentation',   # Shared subtopic
    'source': 'Company Docs',      # Shared source
    'version': '1.0',              # Shared version
    'chunkSize': '2000',
    'overlap': '300',
    'useHeadings': 'false',
    'dimensions': '1536',
    'fileMetadata': json.dumps(file_metadata)  # Per-file overrides
}

response = requests.post('http://localhost:8000/api/ingest', files=files, data=data)
print(response.json())
```

## Expected Response

```json
{
    "success": true,
    "message": "Processed 3 files: 3 succeeded, 0 failed",
    "stats": {
        "totalFiles": 3,
        "successfulFiles": 3,
        "failedFiles": 0,
        "totalChunksCreated": 245,
        "totalVectorsUpserted": 245,
        "totalBatches": 3
    },
    "fileResults": [
        {
            "filename": "document1.pdf",
            "success": true,
            "chunksCreated": 85,
            "vectorsUpserted": 85,
            "warnings": []
        },
        {
            "filename": "document2.pdf",
            "success": true,
            "chunksCreated": 92,
            "vectorsUpserted": 92,
            "warnings": ["File size exceeded recommended limit but was processed"]
        },
        {
            "filename": "document3.pdf",
            "success": true,
            "chunksCreated": 68,
            "vectorsUpserted": 68,
            "warnings": []
        }
    ],
    "warnings": []
}
```

## Error Response Example

```json
{
    "success": true,
    "message": "Processed 3 files: 2 succeeded, 1 failed",
    "stats": {
        "totalFiles": 3,
        "successfulFiles": 2,
        "failedFiles": 1,
        "totalChunksCreated": 153,
        "totalVectorsUpserted": 153,
        "totalBatches": 2
    },
    "fileResults": [
        {
            "filename": "document1.pdf",
            "success": true,
            "chunksCreated": 85,
            "vectorsUpserted": 85,
            "warnings": []
        },
        {
            "filename": "document2.pdf",
            "success": false,
            "error": "Failed to parse PDF: corrupted file or encryption",
            "chunksCreated": 0,
            "vectorsUpserted": 0
        },
        {
            "filename": "document3.pdf",
            "success": true,
            "chunksCreated": 68,
            "vectorsUpserted": 68,
            "warnings": []
        }
    ],
    "warnings": ["document2.pdf failed but other files were processed successfully"]
}
```

## Metadata Structure in Pinecone

After ingestion, each vector in Pinecone will have metadata like:

```json
{
    "source": "Company Docs",
    "topic": "Custom Topic 1",  // Overridden for document1.pdf
    "subtopic": "Custom Subtopic 1",  // Overridden for document1.pdf
    "version": "1.0",
    "chunk_id": "document1.pdf-a1b2c3d4-e5f6-7890-abcd-ef1234567890-0",
    "page": 1,
    "filename": "document1.pdf",  // CRITICAL: Identifies source file
    "file_index": 0,  // Order in batch
    "text": "Full chunk text here...",
    "chunk_text": "Full chunk text here...",
    "preview": "First 200 characters..."
}
```

## Querying with File Filter

You can query and filter by filename:

```python
# Query with filename filter
response = requests.post('http://localhost:8000/api/query', json={
    "indexName": "my-index",
    "query": "search term",
    "topK": 10,
    "namespace": "my-namespace",
    "filter": {
        "filename": {"$eq": "document1.pdf"}  # Only results from document1.pdf
    }
})
```

## Implementation Notes

1. **Concurrency**: Files are processed with a concurrency limit (3-5 files at once) to avoid overwhelming the OpenAI API
2. **Error Resilience**: If one file fails, others continue processing
3. **Batch Upsert**: All vectors from all files are combined and upserted together in batches of 100
4. **Metadata Overrides**: Per-file metadata overrides are applied on top of shared metadata
5. **File Identification**: Every vector includes `filename` in metadata for filtering and tracking

