import { NextRequest, NextResponse } from 'next/server';
import { OpenAIService } from '@/lib/services/openai.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/extract-metadata
 * Extract comprehensive metadata from document using GPT
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, filename } = body;

    if (!text || text.length < 50) {
      return NextResponse.json(
        { error: 'Text is too short to extract metadata' },
        { status: 400 }
      );
    }

    const openAIService = new OpenAIService();
    const metadata = await openAIService.extractMetadata(text, filename);

    return NextResponse.json(metadata);
  } catch (error: any) {
    console.error('Error extracting metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract metadata' },
      { status: 500 }
    );
  }
}

