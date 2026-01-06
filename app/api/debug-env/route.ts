import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/lib/services/pinecone.service';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * GET /api/debug-env
 * Debug endpoint to check environment variables and test Pinecone connection
 */
export async function GET(request: NextRequest) {
  try {
    const pineconeKey = process.env.PINECONE_API_KEY || '';
    const openaiKey = process.env.OPENAI_API_KEY || '';
    
    // Create safe previews of API keys (first 20 + last 10 chars)
    const pineconePreview = pineconeKey.length > 30 
      ? `${pineconeKey.substring(0, 20)}...${pineconeKey.substring(pineconeKey.length - 10)}`
      : pineconeKey ? `${pineconeKey.substring(0, 15)}...` : 'NOT SET';
    
    const openaiPreview = openaiKey.length > 30
      ? `${openaiKey.substring(0, 20)}...${openaiKey.substring(openaiKey.length - 10)}`
      : openaiKey ? `${openaiKey.substring(0, 15)}...` : 'NOT SET';
    
    // Test Pinecone connection and get indexes
    let pineconeTest = {
      connected: false,
      indexes: [] as string[],
      indexDetails: [] as any[],
      error: null as string | null,
    };
    
    if (pineconeKey) {
      try {
        const pineconeService = new PineconeService();
        const indexes = await pineconeService.listIndexes();
        pineconeTest = {
          connected: true,
          indexes: indexes.map((idx: any) => idx.name || idx),
          indexDetails: indexes.map((idx: any) => ({
            name: idx.name,
            dimension: idx.dimension,
            metric: idx.metric,
            status: idx.status?.state || 'unknown',
            ready: idx.status?.ready || false,
          })),
          error: null,
        };
      } catch (error: any) {
        pineconeTest = {
          connected: false,
          indexes: [],
          indexDetails: [],
          error: error.message || 'Unknown error',
        };
      }
    }
    
    return NextResponse.json({
      environment: process.env.NODE_ENV || 'unknown',
      vercel: process.env.VERCEL ? 'true' : 'false',
      vercelEnv: process.env.VERCEL_ENV || 'unknown',
      apiKeys: {
        pinecone: {
          set: !!pineconeKey,
          preview: pineconePreview,
          length: pineconeKey.length,
          // Show more of the key for comparison (first 30 + last 15)
          fullPreview: pineconeKey.length > 45 
            ? `${pineconeKey.substring(0, 30)}...${pineconeKey.substring(pineconeKey.length - 15)}`
            : pineconeKey,
        },
        openai: {
          set: !!openaiKey,
          preview: openaiPreview,
          length: openaiKey.length,
        },
      },
      pineconeTest,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get environment info' },
      { status: 500 }
    );
  }
}

