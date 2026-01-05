import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/lib/services/pinecone.service';

/**
 * DELETE /api/index
 * Delete a Pinecone index
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json(
        { error: 'Index name is required' },
        { status: 400 }
      );
    }

    const pineconeService = new PineconeService();
    const result = await pineconeService.deleteIndex(name);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting index:', {
      message: error.message,
      status: error.status,
      statusCode: error.statusCode,
      code: error.code,
      fullError: error,
    });
    
    // Provide more specific error messages
    let errorMessage = error.message || 'Failed to delete index';
    if (error.status === 404 || error.statusCode === 404) {
      errorMessage = `Index "${name}" not found`;
    } else if (error.message?.includes('deletion protection')) {
      errorMessage = `Index "${name}" has deletion protection enabled. Please disable it in Pinecone dashboard first.`;
    } else if (error.status === 403 || error.statusCode === 403) {
      errorMessage = `Permission denied. Check your API key permissions.`;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: error.status || error.statusCode || 500 }
    );
  }
}

