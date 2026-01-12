import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/lib/services/pinecone.service';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/indexes/{indexName}/files/{filename}
 * Delete all vectors for a specific file
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { indexName: string; filename: string } }
) {
  try {
    const { indexName, filename } = params;
    const { searchParams } = new URL(request.url);
    const namespace = searchParams.get('namespace') || undefined;

    if (!indexName || !filename) {
      return NextResponse.json(
        { error: 'Index name and filename are required' },
        { status: 400 }
      );
    }

    const pineconeService = new PineconeService();
    
    // Check if file exists first
    const files = await pineconeService.listFiles(indexName, namespace);
    const fileExists = files.some(f => f.filename === filename);
    
    if (!fileExists) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Delete all vectors for this file
    const deletedCount = await pineconeService.deleteFileVectors(
      indexName,
      filename,
      namespace
    );

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} vectors for file '${filename}'`,
      vectorsDeleted: deletedCount,
    });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete file' },
      { status: 500 }
    );
  }
}

