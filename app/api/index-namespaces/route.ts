import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/lib/services/pinecone.service';

/**
 * GET /api/index-namespaces
 * Get available namespaces for an index
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const indexName = searchParams.get('indexName');

    if (!indexName) {
      return NextResponse.json(
        { error: 'Index name is required' },
        { status: 400 }
      );
    }

    const pineconeService = new PineconeService();
    const namespaces = await pineconeService.getIndexNamespaces(indexName);

    return NextResponse.json({
      success: true,
      namespaces,
      indexName,
    });
  } catch (error: any) {
    console.error('Error getting namespaces:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get namespaces' },
      { status: 500 }
    );
  }
}

