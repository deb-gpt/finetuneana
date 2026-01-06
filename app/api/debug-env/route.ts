import { NextRequest, NextResponse } from 'next/server';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * GET /api/debug-env
 * Debug endpoint to check environment variables (without exposing full keys)
 */
export async function GET(request: NextRequest) {
  try {
    const pineconeKey = process.env.PINECONE_API_KEY || '';
    const openaiKey = process.env.OPENAI_API_KEY || '';
    
    // Create safe previews of API keys
    const pineconePreview = pineconeKey.length > 19 
      ? `${pineconeKey.substring(0, 15)}...${pineconeKey.substring(pineconeKey.length - 4)}`
      : pineconeKey ? `${pineconeKey.substring(0, 10)}...` : 'NOT SET';
    
    const openaiPreview = openaiKey.length > 19
      ? `${openaiKey.substring(0, 15)}...${openaiKey.substring(openaiKey.length - 4)}`
      : openaiKey ? `${openaiKey.substring(0, 10)}...` : 'NOT SET';
    
    return NextResponse.json({
      environment: process.env.NODE_ENV || 'unknown',
      vercel: process.env.VERCEL ? 'true' : 'false',
      apiKeys: {
        pinecone: {
          set: !!pineconeKey,
          preview: pineconePreview,
          length: pineconeKey.length,
        },
        openai: {
          set: !!openaiKey,
          preview: openaiPreview,
          length: openaiKey.length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get environment info' },
      { status: 500 }
    );
  }
}

