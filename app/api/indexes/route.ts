import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/lib/services/pinecone.service';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * GET /api/indexes
 * List all Pinecone indexes with stats
 */
export async function GET(request: NextRequest) {
  try {
    // Log environment info for debugging
    const apiKey = process.env.PINECONE_API_KEY || '';
    const keyPreview = apiKey.length > 19 
      ? `${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 4)}`
      : apiKey.substring(0, 10) + '...';
    console.log('Environment check - API key preview:', keyPreview, `(length: ${apiKey.length})`);
    console.log('Environment:', process.env.NODE_ENV || 'unknown');
    
    const pineconeService = new PineconeService();
    
    // First, try to list indexes
    let indexes = await pineconeService.listIndexes();
    
    // Note: We removed the hardcoded fallback that was trying specific index names
    // The control plane API fallback in listIndexes() should handle finding indexes
    // If indexes.length is still 0, it means there are truly no indexes
    
    const finalIndexes = indexes;
    
    console.log(`Found ${finalIndexes.length} indexes from Pinecone`);
    console.log('Raw index names from Pinecone:', finalIndexes.map((idx: any) => idx.name || idx));
    console.log('Full index objects:', JSON.stringify(finalIndexes, null, 2));

    // Get stats for each index and verify it actually exists and is usable
    // Use Promise.allSettled to handle errors gracefully and not fail the entire request
    const indexesWithStats = await Promise.allSettled(
      finalIndexes.map(async (index: any) => {
        // Index from listIndexes() has: name, dimension, metric, host, spec, status
        const indexName = index.name;
        
        // Check if index is in a deleting or deleted state - filter these out
        const indexState = index.status?.state || '';
        if (indexState === 'Deleting' || indexState === 'Deleted' || indexState === 'Terminated') {
          console.log(`→ Filtering out index ${indexName} - status: ${indexState}`);
          return null;
        }
        
        try {
          // Try to get stats - this is the real test if index is accessible
          // Add timeout to prevent hanging on slow connections
          const stats = await Promise.race([
            pineconeService.getIndexStats(indexName),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Stats request timeout')), 10000)
            )
          ]) as any;
          
          console.log(`✓ Index ${indexName} is accessible with ${stats.totalRecordCount || 0} vectors`);
          
          // If index has 0 vectors and seems stale, log a warning but still include it
          if (stats.totalRecordCount === 0) {
            console.warn(`⚠ Index ${indexName} exists but has 0 vectors - might be stale or newly created`);
          }
          return {
            name: indexName,
            dimension: index.dimension || 1536,
            metric: index.metric || 'cosine',
            totalVectors: stats.totalRecordCount || 0,
            lastUpdated: new Date().toISOString(),
          };
        } catch (error: any) {
          // Check error details
          const errorMsg = error.message?.toLowerCase() || '';
          const errorCode = error.code?.toLowerCase() || '';
          const status = error.status || error.statusCode;
          
          console.log(`✗ Index ${indexName} stats check failed:`, {
            message: error.message,
            status,
            code: error.code,
            errorType: error.name,
          });
          
          // If it's a clear "not found" or "doesn't exist" error, filter it out
          if (
            errorMsg.includes('not found') ||
            errorMsg.includes('does not exist') ||
            errorMsg.includes('404') ||
            errorCode === 'not_found' ||
            status === 404 ||
            errorMsg.includes('index not found') ||
            errorMsg.includes('resource not found')
          ) {
            console.log(`→ Filtering out non-existent index: ${indexName}`);
            return null;
          }
          
          // For timeout or network errors, still include the index but with 0 vectors
          // This prevents valid indexes from being filtered out due to temporary issues
          if (
            errorMsg.includes('timeout') ||
            errorMsg.includes('network') ||
            errorMsg.includes('connection') ||
            status === 408 ||
            status === 503 ||
            status === 504
          ) {
            console.warn(`⚠ Index ${indexName} stats check timed out or network error - including with 0 vectors`);
            return {
              name: indexName,
              dimension: index.dimension || 1536,
              metric: index.metric || 'cosine',
              totalVectors: 0,
              lastUpdated: new Date().toISOString(),
            };
          }
          
          // For other errors, check if we can at least access the index object
          try {
            const indexObj = pineconeService['client'].index(indexName);
            // If we can create the index object, it might exist but be initializing
            console.log(`→ Index ${indexName} might be initializing, including with 0 vectors`);
            return {
              name: indexName,
              dimension: index.dimension || 1536,
              metric: index.metric || 'cosine',
              totalVectors: 0,
              lastUpdated: new Date().toISOString(),
            };
          } catch (innerError: any) {
            // Can't even create index object - definitely doesn't exist
            console.log(`→ Filtering out inaccessible index: ${indexName} - inner error: ${innerError.message}`);
            return null;
          }
        }
      })
    );
    
    // Process Promise.allSettled results
    const processedIndexes = indexesWithStats.map((result, idx) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // If the promise was rejected, log and return null
        const indexName = finalIndexes[idx]?.name || 'unknown';
        console.error(`✗ Index ${indexName} processing failed:`, result.reason);
        return null;
      }
    });

    // Filter out null values (indexes that don't exist)
    const validIndexes = processedIndexes.filter((idx: any) => idx !== null);

    // Sort indexes by name in reverse alphabetical order (newer names typically come first)
    // This ensures newly created indexes appear at the top
    validIndexes.sort((a: any, b: any) => {
      return b.name.localeCompare(a.name);
    });

    console.log(`Returning ${validIndexes.length} valid indexes (filtered out ${indexesWithStats.length - validIndexes.length} non-existent)`);
    console.log('Valid index names:', validIndexes.map((i: any) => i.name));
    
    return NextResponse.json(
      { indexes: validIndexes },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    console.error('Error listing indexes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list indexes' },
      { status: 500 }
    );
  }
}

