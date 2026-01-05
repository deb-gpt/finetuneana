import { NextRequest, NextResponse } from 'next/server';
import { PDFParserService } from '@/lib/services/pdf-parser.service';

/**
 * POST /api/parse-preview
 * Parse file for preview purposes (limited to prevent server overload)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Limit file size for preview (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large for preview (max 10MB)' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const parserService = new PDFParserService();
    const parsed = await parserService.parseFile(buffer, file.name);

    // Limit text length for preview to prevent UI slowdown
    // Return first 100k characters for chunking preview
    const previewText = parsed.text.substring(0, 100000);

    return NextResponse.json({
      text: previewText,
      pageCount: parsed.pageCount,
      isTruncated: parsed.text.length > 100000,
      originalLength: parsed.text.length,
    });
  } catch (error: any) {
    console.error('Error parsing file for preview:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse file for preview' },
      { status: 500 }
    );
  }
}

