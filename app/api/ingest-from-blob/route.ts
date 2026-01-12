import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { PDFParserService } from '@/lib/services/pdf-parser.service';
import { ChunkingService } from '@/lib/services/chunking.service';
import { OpenAIService } from '@/lib/services/openai.service';
import { PineconeService } from '@/lib/services/pinecone.service';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large files

/**
 * POST /api/ingest-from-blob
 * Ingest document from Vercel Blob URL into Pinecone
 * This handles large files that were uploaded to blob storage
 */
export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const body = await request.json();
    const {
      blobUrl,
      filename,
      indexName,
      namespace,
      topic,
      subtopic,
      source,
      version,
      chunkSize = 2000,
      overlap = 300,
      useHeadings = false,
      dimensions = 1536,
      forceUpload = false,
    } = body;

    if (!blobUrl || !filename || !indexName || !topic || !source) {
      return NextResponse.json(
        { error: 'Missing required fields: blobUrl, filename, indexName, topic, source' },
        { status: 400 }
      );
    }

    // Download file from blob storage
    console.log(`Downloading file from blob: ${blobUrl}`);
    const blobResponse = await fetch(blobUrl);
    if (!blobResponse.ok) {
      throw new Error(`Failed to download file from blob: ${blobResponse.statusText}`);
    }

    const arrayBuffer = await blobResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    
    console.log(`Downloaded file: ${filename}, size: ${fileSizeMB}MB`);

    // Calculate file hash for duplicate detection
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const uploadedAt = new Date().toISOString();

    // Check for duplicates before processing
    if (!forceUpload) {
      const pineconeService = new PineconeService();
      const duplicate = await pineconeService.checkDuplicateFile(indexName, fileHash, namespace || undefined);
      
      if (duplicate) {
        return NextResponse.json(
          {
            error: 'Duplicate file',
            code: 'DUPLICATE_FILE',
            message: `This file has already been uploaded as '${duplicate.filename}'`,
            existingFile: {
              filename: duplicate.filename,
              uploaded_at: duplicate.uploaded_at,
              namespace: duplicate.namespace || '',
              chunks_count: duplicate.chunks_count,
              vectors_count: duplicate.vectors_count,
            },
            suggestion: 'Use forceUpload=true to upload anyway, or delete the existing file first',
          },
          { status: 409 }
        );
      }
    }

    // Save file temporarily
    tempFilePath = join(tmpdir(), `${uuidv4()}-${filename}`);
    await writeFile(tempFilePath, buffer);

    // Parse document
    console.log(`Parsing file: ${filename} (${fileSizeMB}MB)`);
    const parserService = new PDFParserService();
    let parsed;
    let parseWarnings: string[] = [];
    
    try {
      parsed = await parserService.parseFile(buffer, filename);
      console.log(`Parsed ${parsed.pageCount} pages, ${parsed.text.length} characters`);
      
      if (!parsed.text || parsed.text.length === 0) {
        parseWarnings.push('File appears to be empty or could not extract text');
        parsed.text = 'No text content extracted from this file. It may contain only images or be encrypted.';
        parsed.pageCount = parsed.pageCount || 1;
      }
    } catch (parseError: any) {
      console.error('Error parsing file:', parseError);
      parseWarnings.push(`Initial parse failed: ${parseError.message}`);
      
      if (filename.toLowerCase().endsWith('.pdf')) {
        try {
          console.log('Attempting fallback PDF parsing...');
          const fallbackParsed = await parserService.parsePDF(buffer);
          if (fallbackParsed.text && fallbackParsed.text.trim().length > 0) {
            parsed = fallbackParsed;
            parseWarnings.push('Used fallback parsing method - some formatting may be lost');
          } else {
            throw new Error('Fallback parsing also returned empty text');
          }
        } catch (fallbackError: any) {
          parsed = {
            text: `[File: ${filename}] - Unable to extract text content. File may be corrupted, encrypted, or image-only. Original error: ${parseError.message}`,
            pageCount: 1,
            metadata: {},
          };
          parseWarnings.push('Could not extract text - created placeholder entry.');
        }
      } else {
        parsed = {
          text: `[File: ${filename}] - Parsing failed: ${parseError.message}.`,
          pageCount: 1,
          metadata: {},
        };
        parseWarnings.push('Parsing failed - created placeholder entry.');
      }
    }

    // Chunk text
    const chunkingService = new ChunkingService();
    const chunks = chunkingService.chunkText(parsed.text, {
      chunkSize,
      overlap,
      useHeadings,
    });

    // Generate embeddings
    console.log(`Generating embeddings for ${chunks.length} chunks...`);
    const openAIService = new OpenAIService();
    const texts = chunks.map((chunk) => chunk.text);
    
    let embeddings: number[][];
    let embeddingWarnings: string[] = [];
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        embeddings = await openAIService.generateEmbeddingsBatch(texts, dimensions);
        console.log(`Generated ${embeddings.length} embeddings`);
        break;
      } catch (embeddingError: any) {
        retryCount++;
        console.error(`Error generating embeddings (attempt ${retryCount}/${maxRetries}):`, embeddingError);
        
        if (retryCount >= maxRetries) {
          // Try smaller batches
          try {
            const batchSize = Math.max(1, Math.floor(texts.length / 3));
            embeddings = [];
            
            for (let i = 0; i < texts.length; i += batchSize) {
              const batch = texts.slice(i, i + batchSize);
              try {
                const batchEmbeddings = await openAIService.generateEmbeddingsBatch(batch, dimensions);
                embeddings.push(...batchEmbeddings);
                await new Promise(resolve => setTimeout(resolve, 1000));
              } catch (batchError: any) {
                const zeroVector = new Array(dimensions).fill(0);
                embeddings.push(...batch.map(() => zeroVector));
                embeddingWarnings.push(`Batch ${Math.floor(i / batchSize) + 1} failed - using zero vectors`);
              }
            }
          } catch (finalError: any) {
            return NextResponse.json(
              { 
                error: `Failed to generate embeddings after ${maxRetries} attempts: ${finalError.message || 'OpenAI API error'}`,
                suggestion: 'Please check your OpenAI API key, quota, and network connection.',
              },
              { status: 500 }
            );
          }
        } else {
          const waitTime = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // Prepare vectors
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
        filename: filename,
        file_hash: fileHash,
        uploaded_at: uploadedAt,
        text: chunk.text,
        chunk_text: chunk.text,
        preview: chunk.text.substring(0, 200),
      },
    }));

    // Upsert to Pinecone
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

    // Collect warnings
    const allWarnings = [...parseWarnings, ...embeddingWarnings];
    
    return NextResponse.json({
      success: true,
      message: allWarnings.length > 0 
        ? 'Document ingested with warnings' 
        : 'Document ingested successfully',
      stats: {
        chunksCreated: chunks.length,
        vectorsUpserted: upsertResult.totalVectors,
        batches: upsertResult.batches,
        fileSizeMB: parseFloat(fileSizeMB),
      },
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    });
  } catch (error: any) {
    console.error('Error ingesting from blob:', error);

    if (tempFilePath) {
      await unlink(tempFilePath).catch(console.error);
    }

    return NextResponse.json(
      { error: error.message || 'Failed to ingest document from blob' },
      { status: 500 }
    );
  }
}

