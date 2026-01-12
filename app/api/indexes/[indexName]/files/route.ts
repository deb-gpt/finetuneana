import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/lib/services/pinecone.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/indexes/{indexName}/files
 * List all files uploaded to an index
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { indexName: string } }
) {
  try {
    const { indexName } = params;
    const { searchParams } = new URL(request.url);
    const namespace = searchParams.get('namespace') || undefined;

    if (!indexName) {
      return NextResponse.json(
        { error: 'Index name is required' },
        { status: 400 }
      );
    }

    const pineconeService = new PineconeService();
    const files = await pineconeService.listFiles(indexName, namespace);

    return NextResponse.json({
      files,
      total: files.length,
    });
  } catch (error: any) {
    console.error('Error listing files:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list files' },
      { status: 500 }
    );
  }
}

