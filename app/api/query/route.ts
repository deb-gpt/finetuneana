import { NextRequest, NextResponse } from 'next/server';
import { OpenAIService } from '@/lib/services/openai.service';
import { PineconeService } from '@/lib/services/pinecone.service';

/**
 * POST /api/query
 * Query Pinecone index with semantic search
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      indexName,
      query,
      topK = 5,
      topic,
      subtopic,
      namespace,
      dimensions = 1536,
    } = body;

    if (!indexName || !query) {
      return NextResponse.json(
        { error: 'Index name and query are required' },
        { status: 400 }
      );
    }

    // Generate embedding for query
    const openAIService = new OpenAIService();
    console.log(`Generating embedding for query: "${query}" with dimensions: ${dimensions}`);
    const queryEmbedding = await openAIService.generateEmbedding(
      query,
      dimensions
    );
    console.log(`Generated embedding vector of length: ${queryEmbedding.length}`);

    // Build filter if topic/subtopic provided
    const filter: Record<string, any> = {};
    if (topic) {
      filter.topic = { $eq: topic };
      console.log(`Adding topic filter: ${topic}`);
    }
    if (subtopic) {
      filter.subtopic = { $eq: subtopic };
      console.log(`Adding subtopic filter: ${subtopic}`);
    }

    // Query Pinecone using the query operation
    // For default namespace, use undefined (not "__default__" which requires API 2025-04+)
    const queryNamespace = namespace || undefined;
    
    // First, check if index exists and has vectors
    const pineconeService = new PineconeService();
    try {
      const stats = await pineconeService.getIndexStats(indexName);
      console.log(`Index stats: ${stats.totalRecordCount || 0} total vectors`);
      
      if (stats.totalRecordCount === 0) {
        return NextResponse.json({
          success: false,
          error: 'Index is empty. Please ingest some documents first.',
          results: [],
          count: 0,
        });
      }
    } catch (statsError: any) {
      console.error('Error getting index stats:', statsError.message);
      // Continue with query even if stats fail
    }
    
    console.log(`Querying index "${indexName}" with topK=${topK}, namespace=${queryNamespace || 'default'}`);
    const results = await pineconeService.queryIndex(
      indexName,
      queryEmbedding,
      topK,
      Object.keys(filter).length > 0 ? filter : undefined,
      queryNamespace
    );
    
    console.log(`Query returned ${results.length} matches`);

    // Response structure matches Pinecone API:
    // { matches: [{ id, score, metadata }], namespace, usage }
    return NextResponse.json({
      success: true,
      results: results.map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata || {},
      })),
      namespace: queryNamespace || 'default',
      count: results.length,
    });
  } catch (error: any) {
    console.error('Error querying index:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to query index' },
      { status: 500 }
    );
  }
}

