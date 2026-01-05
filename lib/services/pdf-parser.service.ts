import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { parse } from 'csv-parse/sync';
import fs from 'fs/promises';

/**
 * PDF Parser Service
 * Handles parsing of PDF, DOCX, and CSV files
 */
export class PDFParserService {
  /**
   * Parse PDF file with improved table handling
   */
  async parsePDF(buffer: Buffer): Promise<{
    text: string;
    pageCount: number;
    metadata: any;
  }> {
    try {
      // Try using pdf-parse first (faster, good for simple PDFs)
      const data = await pdfParse(buffer);
      let text = data.text;
      
      // Post-process to improve table readability
      text = this.enhanceTableText(text);
      
      return {
        text,
        pageCount: data.numpages,
        metadata: data.info || {},
      };
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error('Failed to parse PDF file');
    }
  }

  /**
   * Enhance text to better preserve table structure
   * Detects table-like patterns and formats them better for embedding
   */
  private enhanceTableText(text: string): string {
    // Split into lines
    const lines = text.split('\n');
    const enhancedLines: string[] = [];
    let inTable = false;
    let tableRows: string[] = [];
    let tableColumnCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      
      if (!line) {
        // If we were in a table, finalize it
        if (inTable && tableRows.length > 0) {
          enhancedLines.push(...this.formatTable(tableRows));
          tableRows = [];
          inTable = false;
          tableColumnCount = 0;
        }
        enhancedLines.push('');
        continue;
      }
      
      // Detect table-like patterns
      const tabSeparated = line.split('\t').filter(col => col.trim());
      const spaceSeparated = line.split(/\s{2,}/).filter(col => col.trim()); // 2+ spaces
      
      // Check if this looks like a table row
      const hasTabs = tabSeparated.length >= 2;
      const hasSpaces = spaceSeparated.length >= 3 && line.length > 40;
      const looksLikeTableRow = hasTabs || hasSpaces;
      
      // Check if next line also looks like a table row (table continuation)
      const nextTabSeparated = nextLine ? nextLine.split('\t').filter(col => col.trim()) : [];
      const nextSpaceSeparated = nextLine ? nextLine.split(/\s{2,}/).filter(col => col.trim()) : [];
      const nextLooksLikeTableRow = nextLine && (
        nextTabSeparated.length >= 2 ||
        (nextSpaceSeparated.length >= 3 && nextLine.length > 40)
      );
      
      // Check if previous line was a table row
      const prevTabSeparated = prevLine ? prevLine.split('\t').filter(col => col.trim()) : [];
      const prevSpaceSeparated = prevLine ? prevLine.split(/\s{2,}/).filter(col => col.trim()) : [];
      const prevLooksLikeTableRow = prevLine && (
        prevTabSeparated.length >= 2 ||
        (prevSpaceSeparated.length >= 3 && prevLine.length > 40)
      );
      
      if (looksLikeTableRow && (nextLooksLikeTableRow || prevLooksLikeTableRow || inTable)) {
        inTable = true;
        // Normalize the row - use tabs if present, otherwise use space-separated
        const row = hasTabs 
          ? tabSeparated.map(col => col.trim()).join('\t')
          : spaceSeparated.map(col => col.trim()).join('\t');
        
        // Track column count
        const colCount = hasTabs ? tabSeparated.length : spaceSeparated.length;
        if (colCount > tableColumnCount) {
          tableColumnCount = colCount;
        }
        
        tableRows.push(row);
      } else {
        // Not a table row
        if (inTable && tableRows.length > 0) {
          // Finalize the table we were building
          enhancedLines.push(...this.formatTable(tableRows, tableColumnCount));
          tableRows = [];
          inTable = false;
          tableColumnCount = 0;
        }
        enhancedLines.push(line);
      }
    }
    
    // Handle table at end of document
    if (inTable && tableRows.length > 0) {
      enhancedLines.push(...this.formatTable(tableRows, tableColumnCount));
    }
    
    return enhancedLines.join('\n');
  }

  /**
   * Format table rows into readable text format with proper alignment
   */
  private formatTable(rows: string[], expectedColumns?: number): string[] {
    if (rows.length === 0) return [];
    
    // Split rows by tabs
    const tableData = rows.map(row => {
      const cols = row.split('\t').map(col => col.trim());
      // Pad to expected column count if provided
      if (expectedColumns && cols.length < expectedColumns) {
        while (cols.length < expectedColumns) {
          cols.push('');
        }
      }
      return cols;
    });
    
    // Find max width for each column for alignment
    const maxWidths: number[] = [];
    tableData.forEach(row => {
      row.forEach((col, idx) => {
        if (!maxWidths[idx] || col.length > maxWidths[idx]) {
          maxWidths[idx] = Math.min(col.length, 50); // Cap at 50 chars per column
        }
      });
    });
    
    // Format as readable table
    const formatted: string[] = [];
    tableData.forEach((row, rowIdx) => {
      const formattedRow = row
        .map((col, colIdx) => {
          const width = maxWidths[colIdx] || 0;
          // Truncate if too long, add ellipsis
          const displayCol = col.length > width ? col.substring(0, width - 3) + '...' : col;
          return displayCol.padEnd(width);
        })
        .join(' | '); // Use | separator for clarity
      
      formatted.push(formattedRow);
      
      // Add separator after header row (if first row looks like header)
      if (rowIdx === 0 && rows.length > 1) {
        const separator = row.map((_, colIdx) => {
          const width = maxWidths[colIdx] || 0;
          return '-'.repeat(Math.min(width, 20)); // Cap separator length
        }).join('-|-');
        formatted.push(separator);
      }
    });
    
    return formatted;
  }

  /**
   * Parse DOCX file
   */
  async parseDOCX(buffer: Buffer): Promise<{
    text: string;
    pageCount: number;
  }> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      // Estimate page count (roughly 500 words per page)
      const wordCount = result.value.split(/\s+/).length;
      const estimatedPages = Math.ceil(wordCount / 500);

      return {
        text: result.value,
        pageCount: estimatedPages,
      };
    } catch (error) {
      console.error('Error parsing DOCX:', error);
      throw new Error('Failed to parse DOCX file');
    }
  }

  /**
   * Parse CSV file
   */
  async parseCSV(buffer: Buffer): Promise<{
    text: string;
    pageCount: number;
  }> {
    try {
      const text = buffer.toString('utf-8');
      const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
      });

      // Convert CSV records to text format
      const textContent = records
        .map((record: any) => {
          return Object.entries(record)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' | ');
        })
        .join('\n');

      // Estimate page count
      const lineCount = records.length;
      const estimatedPages = Math.ceil(lineCount / 50); // Roughly 50 lines per page

      return {
        text: textContent,
        pageCount: estimatedPages,
      };
    } catch (error) {
      console.error('Error parsing CSV:', error);
      throw new Error('Failed to parse CSV file');
    }
  }

  /**
   * Parse file based on extension
   */
  async parseFile(
    buffer: Buffer,
    filename: string
  ): Promise<{
    text: string;
    pageCount: number;
    metadata?: any;
  }> {
    const extension = filename.toLowerCase().split('.').pop();

    switch (extension) {
      case 'pdf':
        return await this.parsePDF(buffer);
      case 'docx':
      case 'doc':
        return await this.parseDOCX(buffer);
      case 'csv':
        return await this.parseCSV(buffer);
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
  }

  /**
   * Get first page preview (for PDFs)
   */
  async getFirstPagePreview(buffer: Buffer, filename: string): Promise<string> {
    try {
      const extension = filename.toLowerCase().split('.').pop();
      if (extension === 'pdf') {
        const data = await pdfParse(buffer, { page: 1 });
        return data.text.substring(0, 500); // First 500 chars
      } else {
        const parsed = await this.parseFile(buffer, filename);
        return parsed.text.substring(0, 500);
      }
    } catch (error) {
      console.error('Error getting preview:', error);
      return 'Preview not available';
    }
  }
}

