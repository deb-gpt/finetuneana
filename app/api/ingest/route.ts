import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { PDFParserService } from '@/lib/services/pdf-parser.service';
import { ChunkingService } from '@/lib/services/chunking.service';
import { OpenAIService } from '@/lib/services/openai.service';
import { PineconeService } from '@/lib/services/pinecone.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/ingest
 * Ingest uploaded document into Pinecone index
 */
export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const indexName = formData.get('indexName') as string;
    const namespace = formData.get('namespace') as string | null;
    const topic = formData.get('topic') as string;
    const subtopic = formData.get('subtopic') as string | null;
    const source = formData.get('source') as string;
    const version = formData.get('version') as string | null;
    const chunkSize = parseInt(formData.get('chunkSize') as string) || 1000;
    const overlap = parseInt(formData.get('overlap') as string) || 200;
    const useHeadings = formData.get('useHeadings') === 'true';
    const dimensions = parseInt(formData.get('dimensions') as string) || 1536;

    if (!file || !indexName || !topic || !source) {
      return NextResponse.json(
        { error: 'Missing required fields: file, indexName, topic, source' },
        { status: 400 }
      );
    }

    // Save file temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    tempFilePath = join(tmpdir(), `${uuidv4()}-${file.name}`);
    await writeFile(tempFilePath, buffer);

    // Step 1: Parse document
    const parserService = new PDFParserService();
    const parsed = await parserService.parseFile(buffer, file.name);

    // Step 2: Chunk text
    const chunkingService = new ChunkingService();
    const chunks = chunkingService.chunkText(parsed.text, {
      chunkSize,
      overlap,
      useHeadings,
    });

    // Step 3: Generate embeddings
    const openAIService = new OpenAIService();
    const texts = chunks.map((chunk) => chunk.text);
    const embeddings = await openAIService.generateEmbeddingsBatch(
      texts,
      dimensions
    );

    // Step 4: Prepare vectors for Pinecone
    const vectors = chunks.map((chunk, index) => ({
      id: `${uuidv4()}-${index}`,
      values: embeddings[index],
      metadata: {
        source,
        topic,
        subtopic: subtopic || undefined,
        version: version || undefined,
        chunk_id: chunk.id,
        page: chunk.page || parsed.pageCount || undefined,
        filename: file.name,
        // Store FULL chunk text - don't truncate! This is what the chatbot needs
        text: chunk.text,
        chunk_text: chunk.text, // Also store as chunk_text for compatibility
        // Store preview separately if needed (first 200 chars)
        preview: chunk.text.substring(0, 200),
      },
    }));

    // Step 5: Upsert to Pinecone
    const pineconeService = new PineconeService();
    const upsertResult = await pineconeService.upsertVectors(
      indexName,
      vectors,
      namespace || undefined
    );

    // Clean up temp file
    if (tempFilePath) {
      await unlink(tempFilePath).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      message: 'Document ingested successfully',
      stats: {
        chunksCreated: chunks.length,
        vectorsUpserted: upsertResult.totalVectors,
        batches: upsertResult.batches,
      },
    });
  } catch (error: any) {
    console.error('Error ingesting document:', error);

    // Clean up temp file on error
    if (tempFilePath) {
      await unlink(tempFilePath).catch(console.error);
    }

    return NextResponse.json(
      { error: error.message || 'Failed to ingest document' },
      { status: 500 }
    );
  }
}

