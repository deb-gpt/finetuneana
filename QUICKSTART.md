# Quick Start Guide

## Prerequisites

1. **Node.js 18+** installed
2. **Pinecone Account**: Sign up at [pinecone.io](https://www.pinecone.io/)
3. **OpenAI Account**: Sign up at [platform.openai.com](https://platform.openai.com/)

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
PINECONE_API_KEY=your-pinecone-api-key-here
OPENAI_API_KEY=your-openai-api-key-here
```

**Where to find your keys:**
- **Pinecone API Key**: Dashboard → API Keys
- **OpenAI API Key**: Platform → API Keys

### 3. Start the Development Server

```bash
npm run dev
```

### 4. Open the Application

Navigate to [http://localhost:3000](http://localhost:3000)

## First Steps

### Create Your First Index

1. Click "Create New Index" on the dashboard
2. Enter a unique index name (e.g., `my-first-index`)
3. Select dimension: **1536** (recommended for text-embedding-3-large)
4. Select metric: **Cosine** (recommended)
5. Click "Create Index"

### Upload and Ingest a Document

1. Select your index from the dashboard
2. Go to "Upload & Ingest" tab
3. Upload a PDF, DOCX, or CSV file
4. Fill in metadata:
   - **Topic**: e.g., "Machine Learning"
   - **Source**: e.g., "Research Paper"
5. Configure chunking (defaults are fine for most cases)
6. Click "Start Ingestion"
7. Wait for the process to complete

### Query Your Memory

1. Go to "Query Memory" tab
2. Select your index
3. Enter a query (e.g., "What is machine learning?")
4. Click "Search"
5. View the retrieved chunks with metadata

## Troubleshooting

### "PINECONE_API_KEY is not set"
- Make sure `.env.local` exists in the root directory
- Verify the key is correct (no extra spaces)
- Restart the dev server after adding environment variables

### "Index creation failed"
- Check your Pinecone account has available credits
- Verify the index name is unique (lowercase, alphanumeric, hyphens only)
- Ensure your API key has proper permissions

### "Embedding generation failed"
- Verify your OpenAI API key is valid
- Check your OpenAI account has available credits
- Ensure the dimension matches your index (1536 or 3072)

### "Document parsing error"
- Verify file format is supported (PDF, DOCX, CSV)
- Check file is not corrupted
- Try a smaller file first

## Next Steps

- Explore different chunking strategies
- Use namespaces to organize documents
- Experiment with topic/subtopic filtering
- Try the auto-suggest topic feature

## Support

For detailed documentation, see [README.md](./README.md)

