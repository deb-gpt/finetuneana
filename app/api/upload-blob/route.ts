import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/upload-blob
 * Upload file to Vercel Blob Storage and return URL
 * This bypasses the 4.5MB serverless function limit
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

    // Upload to Vercel Blob Storage
    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true, // Prevent overwrites
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      size: file.size, // Use file size instead of blob.size
      uploadedAt: new Date().toISOString(), // Use current timestamp
    });
  } catch (error: any) {
    console.error('Error uploading to blob:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    );
  }
}

