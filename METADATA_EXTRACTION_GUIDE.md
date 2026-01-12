# GPT-Based Metadata Extraction Guide

## Overview

Use ChatGPT API (GPT-4) to automatically extract comprehensive metadata from documents during ingestion. This eliminates manual metadata entry and ensures consistent, structured metadata.

## Features

- **Automatic Extraction**: Analyzes document content and filename
- **Comprehensive Fields**: Extracts topic, subtopic, source, version, document type, tags, summary, date, author
- **Override Support**: Users can override specific fields after extraction
- **Multi-File Support**: Extracts metadata per file in batch uploads
- **Fallback**: Falls back to provided metadata if extraction fails

## API Endpoint

### Extract Metadata

```http
POST /api/extract-metadata
Content-Type: application/json

{
  "text": "Document content here...",
  "filename": "document.pdf"  // Optional
}
```

**Response:**
```json
{
  "topic": "Vehicles",
  "subtopic": "Electric Vehicles",
  "source": "ATRI Reports",
  "version": "2024.1",
  "document_type": "report",
  "tags": ["electric vehicles", "transportation", "sustainability"],
  "summary": "This report discusses the adoption of electric vehicles in the transportation industry...",
  "date": "2024-01-15",
  "author": "ATRI Research Team",
  "confidence": 0.92
}
```

## Usage in Ingestion

### Single File with Auto-Extraction

```python
# Form data
files = {
    'file': open('document.pdf', 'rb'),
    'indexName': 'my-index',
    'namespace': 'documents',
    'autoExtractMetadata': 'true',  # Enable auto-extraction
    'chunkSize': '2000',
    'overlap': '300',
    # Optional: Override specific fields
    'metadataOverrides': json.dumps({
        'source': 'Custom Source Name',
        'version': '2.0'
    })
}
```

### Multi-File with Auto-Extraction

```python
files = [
    ('files', open('doc1.pdf', 'rb')),
    ('files', open('doc2.pdf', 'rb')),
]

data = {
    'indexName': 'my-index',
    'namespace': 'documents',
    'autoExtractMetadata': 'true',  # Extract metadata for each file
    'topic': 'General Topic',  # Shared topic (can be overridden per file)
    'source': 'Shared Source',  # Shared source (can be overridden per file)
    'fileMetadata': json.dumps({
        'doc1.pdf': {
            'source': 'Custom Source 1'  # Override for doc1.pdf
        }
    })
}
```

## Implementation Details

### OpenAI Service Method

```python
async def extract_metadata(self, text: str, filename: str = None) -> dict:
    """
    Extract comprehensive metadata from document using GPT-4.
    
    Args:
        text: Document text content (first 3000-5000 chars recommended)
        filename: Optional filename for context
        
    Returns:
        Dictionary with extracted metadata fields
    """
    # Prepare prompt
    prompt = f"""Analyze the following document{' (filename: ' + filename + ')' if filename else ''} and extract structured metadata.

Extract the following information:
- topic: Main topic/subject of the document
- subtopic: Optional subtopic or category
- source: Source organization/publication (infer from content or filename)
- version: Version number if mentioned
- document_type: Type of document (report, manual, article, data, etc.)
- tags: List of relevant tags/keywords (3-5 tags)
- summary: Brief summary in 1-2 sentences
- date: Document date if mentioned (YYYY-MM-DD format)
- author: Author or organization if mentioned

Return ONLY valid JSON in this format:
{{
    "topic": "string",
    "subtopic": "string or null",
    "source": "string",
    "version": "string or null",
    "document_type": "string or null",
    "tags": ["tag1", "tag2"],
    "summary": "string or null",
    "date": "YYYY-MM-DD or null",
    "author": "string or null"
}}"""

    # Limit text to first 5000 chars for efficiency
    text_sample = text[:5000] if len(text) > 5000 else text
    
    try:
        response = self.client.chat.completions.create(
            model='gpt-4',
            messages=[
                {
                    'role': 'system',
                    'content': 'You are a metadata extraction assistant. Analyze documents and extract structured metadata. Always return valid JSON.'
                },
                {
                    'role': 'user',
                    'content': f'{prompt}\n\nDocument content:\n{text_sample}'
                }
            ],
            response_format={'type': 'json_object'},
            temperature=0.3,  # Lower temperature for more consistent extraction
            max_tokens=500
        )
        
        content = response.choices[0].message.content
        if content:
            metadata = json.loads(content)
            # Validate and clean metadata
            return self._validate_metadata(metadata)
    except Exception as e:
        logger.error(f'Error extracting metadata: {e}')
        return {}
    
    return {}

def _validate_metadata(self, metadata: dict) -> dict:
    """Validate and clean extracted metadata."""
    # Ensure required fields exist
    validated = {
        'topic': metadata.get('topic', 'General'),
        'subtopic': metadata.get('subtopic'),
        'source': metadata.get('source', 'Unknown'),
        'version': metadata.get('version'),
        'document_type': metadata.get('document_type'),
        'tags': metadata.get('tags', []),
        'summary': metadata.get('summary'),
        'date': metadata.get('date'),
        'author': metadata.get('author')
    }
    
    # Convert tags list to comma-separated string if needed
    if isinstance(validated['tags'], list):
        validated['tags'] = ', '.join(validated['tags'])
    
    # Remove None values
    return {k: v for k, v in validated.items() if v is not None}
```

### Ingestion Flow with Metadata Extraction

```python
async def ingest_document(file, config):
    # 1. Parse file
    parsed = parser_service.parse_file(file)
    
    # 2. Extract metadata if enabled
    if config.get('autoExtractMetadata'):
        extracted_metadata = await openai_service.extract_metadata(
            text=parsed.text[:5000],  # First 5000 chars
            filename=file.filename
        )
        
        # Merge with provided metadata (provided takes precedence)
        metadata = {
            **extracted_metadata,
            **config.get('metadataOverrides', {})
        }
        
        # Use provided metadata as fallback if extraction failed
        if not extracted_metadata.get('topic'):
            metadata['topic'] = config.get('topic', 'General')
        if not extracted_metadata.get('source'):
            metadata['source'] = config.get('source', 'Unknown')
    else:
        metadata = {
            'topic': config.get('topic'),
            'subtopic': config.get('subtopic'),
            'source': config.get('source'),
            'version': config.get('version')
        }
    
    # 3. Chunk text
    chunks = chunking_service.chunk_text(parsed.text, config)
    
    # 4. Generate embeddings
    embeddings = await openai_service.generate_embeddings_batch(
        [chunk.text for chunk in chunks],
        config.get('dimensions', 1536)
    )
    
    # 5. Prepare vectors with full metadata
    vectors = []
    for i, chunk in enumerate(chunks):
        vectors.append({
            'id': f"{file.filename}-{uuid.uuid4()}-{i}",
            'values': embeddings[i],
            'metadata': {
                **metadata,  # All extracted/provided metadata
                'chunk_id': f"{file.filename}-{uuid.uuid4()}-{i}",
                'filename': file.filename,
                'text': chunk.text,  # FULL text
                'chunk_text': chunk.text,
                'preview': chunk.text[:200],
                'metadata_extracted': config.get('autoExtractMetadata', False)
            }
        })
    
    # 6. Upsert to Pinecone
    await pinecone_service.upsert_vectors(
        index_name=config['indexName'],
        vectors=vectors,
        namespace=config.get('namespace')
    )
    
    return {
        'success': True,
        'metadata': metadata,  # Return extracted metadata
        'stats': {...}
    }
```

## Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topic` | string | Yes | Main topic/subject |
| `subtopic` | string | No | Subtopic or category |
| `source` | string | Yes | Source organization/publication |
| `version` | string | No | Version number |
| `document_type` | string | No | Type (report, manual, article, etc.) |
| `tags` | string/array | No | Comma-separated tags or array |
| `summary` | string | No | Brief summary (1-2 sentences) |
| `date` | string | No | Document date (YYYY-MM-DD) |
| `author` | string | No | Author or organization |

## Best Practices

1. **Text Sampling**: Use first 3000-5000 characters for extraction (balance between context and cost)
2. **Filename Context**: Include filename in prompt for better source inference
3. **Override Support**: Always allow users to override extracted metadata
4. **Fallback**: If extraction fails, use provided metadata or defaults
5. **Validation**: Validate extracted metadata before storing
6. **Cost Consideration**: Metadata extraction adds API cost (~$0.01-0.03 per document)
7. **Caching**: Consider caching extracted metadata for identical documents
8. **Error Handling**: Don't fail ingestion if extraction fails, just use provided metadata

## Cost Estimation

- **GPT-4**: ~$0.01-0.03 per document (depending on length)
- **Text-embedding-3-large**: ~$0.0001 per 1K tokens
- **Total**: ~$0.01-0.04 per document with metadata extraction

## Example Responses

### Successful Extraction
```json
{
  "topic": "Transportation Infrastructure",
  "subtopic": "Highway Maintenance",
  "source": "ATRI Reports",
  "version": "2024.1",
  "document_type": "report",
  "tags": "infrastructure, highways, maintenance, transportation",
  "summary": "This report analyzes highway maintenance practices and costs in 2024.",
  "date": "2024-01-15",
  "author": "ATRI Research Team"
}
```

### Minimal Extraction (when content is unclear)
```json
{
  "topic": "General",
  "source": "document.pdf",
  "document_type": "document"
}
```

## Integration with Existing Endpoints

The `/api/ingest` endpoint should:
1. Check `autoExtractMetadata` flag
2. If true, call `extract_metadata()` after parsing
3. Merge extracted metadata with provided metadata (provided takes precedence)
4. Store all metadata fields in Pinecone
5. Return extracted metadata in response

This ensures backward compatibility while adding powerful auto-extraction capabilities.

