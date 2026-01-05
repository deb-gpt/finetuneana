import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/lib/services/pinecone.service';

/**
 * POST /api/create-index
 * Create a new Pinecone index
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, dimension = 1536, metric = 'cosine' } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Index name is required' },
        { status: 400 }
      );
    }

    if (dimension !== 1536 && dimension !== 3072) {
      return NextResponse.json(
        { error: 'Dimension must be 1536 or 3072 for text-embedding-3-large' },
        { status: 400 }
      );
    }

    const pineconeService = new PineconeService();
    const result = await pineconeService.createIndex(name, dimension, metric);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error creating index:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create index' },
      { status: 500 }
    );
  }
}

