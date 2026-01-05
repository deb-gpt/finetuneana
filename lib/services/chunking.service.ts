/**
 * Chunking Service
 * Handles text chunking with configurable size, overlap, and heading-based splitting
 */

export interface Chunk {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  page?: number;
}

export interface ChunkingConfig {
  chunkSize: number;
  overlap: number;
  useHeadings: boolean;
}

export class ChunkingService {
  /**
   * Split text into chunks
   */
  chunkText(
    text: string,
    config: ChunkingConfig,
    pageNumber?: number
  ): Chunk[] {
    const { chunkSize, overlap, useHeadings } = config;

    if (useHeadings) {
      return this.chunkWithHeadings(text, chunkSize, overlap, pageNumber);
    }

    return this.chunkSimple(text, chunkSize, overlap, pageNumber);
  }

  /**
   * Simple chunking by character count with better boundary detection
   */
  private chunkSimple(
    text: string,
    chunkSize: number,
    overlap: number,
    pageNumber?: number
  ): Chunk[] {
    const chunks: Chunk[] = [];
    let startIndex = 0;
    let chunkId = 0;

    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + chunkSize, text.length);
      const chunkText = text.substring(startIndex, endIndex);

      // Try to break at better boundaries (paragraph > sentence > word)
      let actualEndIndex = endIndex;
      if (endIndex < text.length) {
        // First try to break at paragraph (double newline)
        const lastParagraph = chunkText.lastIndexOf('\n\n');
        if (lastParagraph > chunkSize * 0.6) {
          actualEndIndex = startIndex + lastParagraph + 2;
        } else {
          // Then try sentence boundary (period, exclamation, question mark)
          const sentenceEnders = /[.!?]\s+/g;
          let lastSentenceEnd = -1;
          let match;
          while ((match = sentenceEnders.exec(chunkText)) !== null) {
            lastSentenceEnd = match.index + match[0].length;
          }
          
          if (lastSentenceEnd > chunkSize * 0.5) {
            actualEndIndex = startIndex + lastSentenceEnd;
          } else {
            // Fall back to newline
            const lastNewline = chunkText.lastIndexOf('\n');
            if (lastNewline > chunkSize * 0.5) {
              actualEndIndex = startIndex + lastNewline + 1;
            } else {
              // Last resort: break at word boundary
              const lastSpace = chunkText.lastIndexOf(' ');
              if (lastSpace > chunkSize * 0.7) {
                actualEndIndex = startIndex + lastSpace + 1;
              }
            }
          }
        }
      }

      const chunkTextFinal = text.substring(startIndex, actualEndIndex).trim();
      
      // Only add chunk if it has meaningful content
      if (chunkTextFinal.length > 50) {
        chunks.push({
          id: `chunk-${chunkId++}`,
          text: chunkTextFinal,
          startIndex,
          endIndex: actualEndIndex,
          page: pageNumber,
        });

        // Move start index forward with overlap
        startIndex = actualEndIndex - overlap;
        if (startIndex <= chunks[chunks.length - 1].startIndex) {
          startIndex = chunks[chunks.length - 1].endIndex;
        }
      } else {
        // If chunk is too small, just move forward
        startIndex = actualEndIndex;
      }
    }

    return chunks;
  }

  /**
   * Chunking with heading awareness
   */
  private chunkWithHeadings(
    text: string,
    chunkSize: number,
    overlap: number,
    pageNumber?: number
  ): Chunk[] {
    // Detect headings (lines that are short, all caps, or start with #)
    const lines = text.split('\n');
    const headingIndices: number[] = [];
    let currentIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isHeading =
        (line.length < 100 && /^[A-Z\s#]+$/.test(line)) ||
        /^#{1,6}\s/.test(line) ||
        (line.length < 80 && line.length > 0 && i < lines.length - 1);

      if (isHeading) {
        headingIndices.push(currentIndex);
      }
      currentIndex += lines[i].length + 1; // +1 for newline
    }

    // If no headings found, fall back to simple chunking
    if (headingIndices.length === 0) {
      return this.chunkSimple(text, chunkSize, overlap, pageNumber);
    }

    // Chunk between headings when possible
    const chunks: Chunk[] = [];
    let chunkId = 0;
    let startIndex = 0;

    for (let i = 0; i < headingIndices.length; i++) {
      const headingStart = headingIndices[i];
      const headingEnd =
        i < headingIndices.length - 1
          ? headingIndices[i + 1]
          : text.length;

      const sectionText = text.substring(headingStart, headingEnd);

      // If section is larger than chunk size, split it
      if (sectionText.length > chunkSize) {
        const sectionChunks = this.chunkSimple(
          sectionText,
          chunkSize,
          overlap,
          pageNumber
        );
        sectionChunks.forEach((chunk) => {
          chunks.push({
            ...chunk,
            id: `chunk-${chunkId++}`,
            startIndex: chunk.startIndex + headingStart,
            endIndex: chunk.endIndex + headingStart,
          });
        });
      } else {
        chunks.push({
          id: `chunk-${chunkId++}`,
          text: sectionText.trim(),
          startIndex: headingStart,
          endIndex: headingEnd,
          page: pageNumber,
        });
      }
    }

    return chunks;
  }

  /**
   * Get preview of first chunk
   */
  getFirstChunkPreview(
    text: string,
    config: ChunkingConfig
  ): { preview: string; chunkCount: number } {
    const chunks = this.chunkText(text, config);
    return {
      preview: chunks[0]?.text.substring(0, 300) || '',
      chunkCount: chunks.length,
    };
  }
}

