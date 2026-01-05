import { NextRequest, NextResponse } from 'next/server';
import { OpenAIService } from '@/lib/services/openai.service';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * POST /api/suggest-topic
 * Suggest topic and subtopic for a document using LLM
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || text.length < 100) {
      return NextResponse.json(
        { error: 'Text is too short to suggest topics' },
        { status: 400 }
      );
    }

    const openAIService = new OpenAIService();
    const suggestion = await openAIService.suggestTopic(text);

    return NextResponse.json(suggestion);
  } catch (error: any) {
    console.error('Error suggesting topic:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to suggest topic' },
      { status: 500 }
    );
  }
}

