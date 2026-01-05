# Ana Memory Creation & Training

Ana is FreightX's proprietary AI agent memory management platform. A comprehensive no-code solution for building, training, and optimizing knowledge bases with intelligent document ingestion, semantic search, and vector storage. Built with Next.js 13+, Pinecone Vector DB, and OpenAI embeddings.

## Features

- **Memory Index Dashboard**: Create, view, delete, and manage Pinecone indexes
- **Document Upload**: Support for PDF, DOCX, and CSV files with drag-and-drop
- **Metadata Tagging**: Organize documents with topics, subtopics, sources, and versions
- **Intelligent Chunking**: Configurable chunking with heading-aware splitting
- **Embedding Generation**: Automatic embedding generation using OpenAI's `text-embedding-3-large`
- **Vector Storage**: Store and manage vectors in Pinecone with namespace support
- **Semantic Search**: Query your memory with topic/subtopic filtering
- **Progress Tracking**: Real-time progress bars and logs during ingestion

## Prerequisites

- Node.js 18+ and npm/yarn
- Pinecone account and API key ([Get one here](https://www.pinecone.io/))
- OpenAI API key ([Get one here](https://platform.openai.com/))

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd finetuneana
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory:
```bash
cp .env.example .env.local
```

4. Add your API keys to `.env.local`:
```env
PINECONE_API_KEY=your-pinecone-api-key-here
OPENAI_API_KEY=your-openai-api-key-here
```

## Running the Application

1. Start the development server:
```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### 1. Create an Index

1. Navigate to the Dashboard tab
2. Click "Create New Index"
3. Enter:
   - Index name (must be unique)
   - Dimension (1536 or 3072 for text-embedding-3-large)
   - Metric (cosine, euclidean, or dotproduct)
   - Optional namespace

### 2. Upload and Ingest Documents

1. Select an index from the dashboard
2. Go to the "Upload & Ingest" tab
3. Upload a PDF, DOCX, or CSV file
4. Fill in metadata:
   - Topic (required)
   - Subtopic (optional)
   - Source (required)
   - Version/Year (optional)
5. Configure chunking:
   - Chunk size (default: 1000 characters)
   - Overlap (default: 200 characters)
   - Option to split by headings
6. Click "Start Ingestion" and monitor progress

### 3. Query Memory

1. Go to the "Query Memory" tab
2. Select an index (if not already selected)
3. Enter your query text
4. Optionally filter by topic/subtopic
5. Adjust Top-K results (default: 5)
6. Click "Search" to retrieve relevant chunks

## Architecture

### Frontend
- **Next.js 13+** with App Router
- **React** components for modular UI
- **Tailwind CSS** for styling
- All API keys and secrets remain server-side

### Backend
- **Next.js API Routes** for server-side operations
- **Pinecone Service**: Manages index operations and vector storage
- **OpenAI Service**: Handles embedding generation
- **PDF Parser Service**: Parses PDF, DOCX, and CSV files
- **Chunking Service**: Intelligent text chunking with heading awareness

### API Routes

- `POST /api/create-index` - Create a new Pinecone index
- `GET /api/indexes` - List all indexes with stats
- `DELETE /api/index` - Delete an index
- `POST /api/ingest` - Ingest document into index
- `POST /api/query` - Semantic search in index

## Configuration

### Embedding Model
- Default: `text-embedding-3-large`
- Dimensions: 1536 (default) or 3072 (maximum)

### Chunking Defaults
- Chunk size: 1000 characters
- Overlap: 200 characters
- Heading-aware splitting: Optional

### Pinecone Settings
- Default metric: Cosine similarity
- Serverless deployment on AWS
- Region: us-east-1 (configurable in code)

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   │   ├── create-index/
│   │   ├── indexes/
│   │   ├── index/
│   │   ├── ingest/
│   │   └── query/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx          # Main page
├── components/           # React components
│   ├── MemoryIndexDashboard.tsx
│   ├── CreateIndexForm.tsx
│   ├── DocumentUpload.tsx
│   ├── MetadataForm.tsx
│   ├── ChunkingConfig.tsx
│   ├── IngestionControls.tsx
│   └── QueryPanel.tsx
├── lib/
│   └── services/         # Backend services
│       ├── pinecone.service.ts
│       ├── openai.service.ts
│       ├── pdf-parser.service.ts
│       └── chunking.service.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## Security

- All API keys are stored server-side in environment variables
- No secrets are exposed to the frontend
- File uploads are processed server-side
- Input validation on all API routes

## Troubleshooting

### Index Creation Fails
- Ensure your Pinecone API key is correct
- Check that the index name is unique
- Verify you have sufficient Pinecone credits

### Embedding Generation Fails
- Verify your OpenAI API key is valid
- Check your OpenAI account has sufficient credits
- Ensure the dimension matches your index configuration

### Document Parsing Errors
- Verify file format is supported (PDF, DOCX, CSV)
- Check file is not corrupted
- Ensure file size is reasonable (< 10MB recommended)

## License

MIT

## Support

For issues and questions, please open an issue on the repository.

