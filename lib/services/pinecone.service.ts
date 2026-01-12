import { Pinecone } from '@pinecone-database/pinecone';

/**
 * Pinecone Service
 * Handles all interactions with Pinecone Vector Database
 */
export class PineconeService {
  private client: Pinecone;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.PINECONE_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is not set');
    }
    // Initialize Pinecone client with API key
    // Note: For serverless indexes, we might need to use the control plane API
    this.client = new Pinecone({ 
      apiKey: this.apiKey,
      // Add environment info for debugging
    });
    // Log API key prefix and length for debugging (first 20 chars + last 10 chars)
    const keyPreview = this.apiKey.length > 30 
      ? `${this.apiKey.substring(0, 20)}...${this.apiKey.substring(this.apiKey.length - 10)}`
      : this.apiKey.length > 19 
        ? `${this.apiKey.substring(0, 15)}...${this.apiKey.substring(this.apiKey.length - 4)}`
        : this.apiKey.substring(0, 10) + '...';
    console.log('Pinecone client initialized with API key:', keyPreview, `(length: ${this.apiKey.length})`);
    console.log('Environment:', process.env.NODE_ENV, 'Vercel:', process.env.VERCEL || 'false');
  }

  /**
   * List all indexes using Pinecone REST API directly
   * Uses: GET https://api.pinecone.io/indexes with api-key header
   * Returns an array of index descriptions
   * Each index has: name, dimension, metric, host, spec, status
   */
  async listIndexes() {
    try {
      console.log('Calling Pinecone REST API: GET https://api.pinecone.io/indexes');
      console.log('API Key preview:', 
        this.apiKey.substring(0, 20) + '...' + this.apiKey.substring(this.apiKey.length - 10));
      
      // Use direct REST API call as specified
      const response = await fetch('https://api.pinecone.io/indexes', {
        method: 'GET',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Pinecone API error:', response.status, errorText);
        throw new Error(`Failed to list indexes: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Pinecone API raw response:', JSON.stringify(data, null, 2));
      
      // Response format: { indexes: [{ name, dimension, metric, host, spec, status }, ...] }
      const indexList = data.indexes || [];
      
      console.log(`Found ${indexList.length} indexes from Pinecone REST API`);
      
      // Log each index for debugging
      if (indexList.length > 0) {
        indexList.forEach((index: any) => {
          console.log(`  - ${index.name}: ${index.dimension}D, ${index.metric}, status: ${index.status?.state || 'unknown'}, ready: ${index.status?.ready || false}`);
          console.log(`    Host: ${index.host || 'N/A'}`);
        });
      } else {
        console.warn('⚠️ No indexes found. This could mean:');
        console.warn('  1. No indexes exist in this Pinecone project');
        console.warn('  2. API key might be for a different project/environment');
        console.warn('  3. Indexes might be in a different region');
      }
      
      return indexList;
    } catch (error: any) {
      console.error('Error listing indexes:', {
        message: error.message,
        status: error.status,
        statusCode: error.statusCode,
        code: error.code,
        fullError: error,
      });
      throw error;
    }
  }

  /**
   * Check if an index exists and is accessible
   */
  async indexExists(indexName: string): Promise<boolean> {
    try {
      const index = this.client.index(indexName);
      await index.describeIndexStats();
      return true;
    } catch (error: any) {
      // Check for common "not found" error patterns
      const errorMsg = error.message?.toLowerCase() || '';
      const errorCode = error.code?.toLowerCase() || '';
      if (
        errorMsg.includes('not found') ||
        errorMsg.includes('does not exist') ||
        errorMsg.includes('404') ||
        errorCode === 'not_found' ||
        error.status === 404 ||
        error.statusCode === 404
      ) {
        return false;
      }
      // For other errors, assume it exists but might be initializing
      return true;
    }
  }

  /**
   * Get index stats including namespace information
   */
  async getIndexStats(indexName: string) {
    try {
      const index = this.client.index(indexName);
      const stats = await index.describeIndexStats();
      
      // Stats include namespaceCounts which shows namespaces and their vector counts
      console.log(`Index ${indexName} stats:`, {
        totalVectors: stats.totalRecordCount,
        namespaces: stats.namespaces ? Object.keys(stats.namespaces) : [],
        namespaceCounts: stats.namespaces,
      });
      
      return stats;
    } catch (error: any) {
      // Enhanced error logging with full error object
      console.error(`Error getting stats for index ${indexName}:`, {
        message: error.message,
        status: error.status,
        statusCode: error.statusCode,
        code: error.code,
        name: error.name,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      throw error;
    }
  }

  /**
   * Get available namespaces for an index
   */
  async getIndexNamespaces(indexName: string): Promise<string[]> {
    try {
      const stats = await this.getIndexStats(indexName);
      // stats.namespaces is an object like { "namespace1": { recordCount: 100 }, "namespace2": { recordCount: 50 } }
      const namespaces = stats.namespaces ? Object.keys(stats.namespaces) : [];
      return namespaces;
    } catch (error: any) {
      console.error(`Error getting namespaces for index ${indexName}:`, error.message);
      return [];
    }
  }

  /**
   * Create a new index
   */
  async createIndex(
    name: string,
    dimension: number,
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine'
  ) {
    try {
      // Check if index already exists
      const existingIndexes = await this.listIndexes();
      const exists = existingIndexes.some((idx: any) => idx.name === name);

      if (exists) {
        throw new Error(`Index ${name} already exists`);
      }

      await this.client.createIndex({
        name,
        dimension,
        metric,
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });

      return { success: true, message: `Index ${name} created successfully` };
    } catch (error: any) {
      console.error('Error creating index:', error);
      throw error;
    }
  }

  /**
   * Delete an index
   */
  async deleteIndex(name: string) {
    try {
      console.log(`Attempting to delete index: ${name}`);
      
      // Use the correct Pinecone API format with required headers
      const deleteResponse = await fetch(`https://api.pinecone.io/indexes/${name}`, {
        method: 'DELETE',
        headers: {
          'Api-Key': this.apiKey,
          'X-Pinecone-Api-Version': '2025-10',
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`Delete response status: ${deleteResponse.status}`);
      
      if (deleteResponse.ok || deleteResponse.status === 202 || deleteResponse.status === 204) {
        console.log(`✓ Index ${name} deletion initiated successfully`);
        
        // Wait a moment for deletion to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify deletion by checking if index still exists
        const verifyResponse = await fetch(`https://api.pinecone.io/indexes/${name}`, {
          method: 'GET',
          headers: {
            'Api-Key': this.apiKey,
            'X-Pinecone-Api-Version': '2025-10',
            'Content-Type': 'application/json',
          },
        });
        
        if (verifyResponse.status === 404) {
          console.log(`✓ Index ${name} confirmed deleted`);
          return { success: true, message: `Index ${name} deleted successfully` };
        } else {
          console.warn(`⚠ Index ${name} deletion initiated but still exists (may be in progress)`);
          return { 
            success: true, 
            message: `Index ${name} deletion initiated. It may take a few moments to complete.` 
          };
        }
      } else {
        const errorText = await deleteResponse.text();
        console.error(`Delete API error:`, deleteResponse.status, errorText);
        
        // Check for specific error cases
        if (deleteResponse.status === 404) {
          return { success: true, message: `Index ${name} does not exist (already deleted)` };
        }
        
        throw new Error(`Failed to delete index: ${deleteResponse.status} - ${errorText}`);
      }
    } catch (error: any) {
      console.error(`Error deleting index ${name}:`, {
        message: error.message,
        status: error.status,
        statusCode: error.statusCode,
        code: error.code,
        fullError: error,
      });
      throw error;
    }
  }

  /**
   * Upsert vectors to an index
   */
  async upsertVectors(
    indexName: string,
    vectors: Array<{
      id: string;
      values: number[];
      metadata: Record<string, any>;
    }>,
    namespace?: string
  ) {
    try {
      const index = this.client.index(indexName);
      const namespaceObj = namespace ? index.namespace(namespace) : index;

      // Batch upserts to avoid rate limits (100 vectors per batch)
      const batchSize = 100;
      const batches = [];

      for (let i = 0; i < vectors.length; i += batchSize) {
        batches.push(vectors.slice(i, i + batchSize));
      }

      const results = [];
      for (const batch of batches) {
        await namespaceObj.upsert(batch);
        results.push({ batchSize: batch.length, success: true });
      }

      return {
        success: true,
        totalVectors: vectors.length,
        batches: results.length,
      };
    } catch (error) {
      console.error('Error upserting vectors:', error);
      throw error;
    }
  }

  /**
   * Query an index using dense vector
   * Uses the Pinecone query operation as per documentation:
   * - vector: dense vector values
   * - namespace: namespace to query (use undefined for default namespace)
   * - topK: number of results to return
   * - includeMetadata: include metadata in response
   * - includeValues: include vector values in response (false for better performance)
   */
  async queryIndex(
    indexName: string,
    queryVector: number[],
    topK: number = 5,
    filter?: Record<string, any>,
    namespace?: string
  ) {
    try {
      // For default namespace, use undefined (not "__default__" which requires API 2025-04+)
      const actualNamespace = namespace || undefined;
      console.log(`Querying index: ${indexName}, topK: ${topK}, namespace: ${actualNamespace || 'default'}`);
      
      const index = this.client.index(indexName);
      const namespaceObj = actualNamespace ? index.namespace(actualNamespace) : index;

      // Use the query operation as per Pinecone documentation
      const queryResponse = await namespaceObj.query({
        vector: queryVector,
        topK, // Note: Pinecone uses topK (camelCase) in the API
        includeMetadata: true,
        includeValues: false, // Don't include vector values for better performance
        filter, // Optional metadata filter
      });

      console.log(`Query returned ${queryResponse.matches?.length || 0} matches`);
      
      // Response structure: { matches: [{ id, score, metadata, values? }], namespace, usage }
      return queryResponse.matches || [];
    } catch (error: any) {
      console.error('Error querying index:', {
        message: error.message,
        status: error.status,
        statusCode: error.statusCode,
        code: error.code,
        fullError: error,
      });
      throw error;
    }
  }

  /**
   * Check if a file with the same hash already exists in the index
   */
  async checkDuplicateFile(
    indexName: string,
    fileHash: string,
    namespace?: string
  ): Promise<{ filename: string; uploaded_at: string; namespace?: string; chunks_count: number; vectors_count: number } | null> {
    try {
      const index = this.client.index(indexName);
      const namespaceObj = namespace ? index.namespace(namespace) : index;

      // Query with a dummy vector to search by metadata filter
      // We'll use a zero vector since we only care about metadata
      const dummyVector = new Array(1536).fill(0); // Default dimension, adjust if needed
      
      const queryResponse = await namespaceObj.query({
        vector: dummyVector,
        topK: 1,
        includeMetadata: true,
        filter: {
          file_hash: { $eq: fileHash },
        },
      });

      if (queryResponse.matches && queryResponse.matches.length > 0) {
        const match = queryResponse.matches[0];
        const metadata = match.metadata || {};
        
        // Get stats for this file
        const stats = await this.getIndexStats(indexName);
        const fileStats = await this.getFileStats(indexName, metadata.filename as string, namespace);
        
        return {
          filename: metadata.filename as string,
          uploaded_at: metadata.uploaded_at as string || new Date().toISOString(),
          namespace: namespace || '',
          chunks_count: fileStats.chunks_count,
          vectors_count: fileStats.vectors_count,
        };
      }

      return null;
    } catch (error: any) {
      console.error('Error checking duplicate file:', error);
      // If query fails, assume no duplicate (allow upload)
      return null;
    }
  }

  /**
   * Get statistics for a specific file
   */
  async getFileStats(
    indexName: string,
    filename: string,
    namespace?: string
  ): Promise<{ chunks_count: number; vectors_count: number }> {
    try {
      const index = this.client.index(indexName);
      const namespaceObj = namespace ? index.namespace(namespace) : index;

      // Query to count vectors for this file
      const dummyVector = new Array(1536).fill(0);
      const queryResponse = await namespaceObj.query({
        vector: dummyVector,
        topK: 10000, // Max to get all vectors for this file
        includeMetadata: true,
        filter: {
          filename: { $eq: filename },
        },
      });

      const vectors_count = queryResponse.matches?.length || 0;
      const chunks_count = vectors_count; // Same for now

      return { chunks_count, vectors_count };
    } catch (error: any) {
      console.error('Error getting file stats:', error);
      return { chunks_count: 0, vectors_count: 0 };
    }
  }

  /**
   * List all unique files in an index
   */
  async listFiles(
    indexName: string,
    namespace?: string
  ): Promise<Array<{
    filename: string;
    namespace: string;
    uploaded_at: string;
    chunks_count: number;
    vectors_count: number;
    topic: string;
    source: string;
    metadata: Record<string, any>;
  }>> {
    try {
      const index = this.client.index(indexName);
      const namespaceObj = namespace ? index.namespace(namespace) : index;

      // Get index stats to see total vectors
      const stats = await this.getIndexStats(indexName);
      
      // Query with dummy vector to get sample of vectors with metadata
      // We'll need to query multiple times or use a different approach
      // For now, query a large sample and extract unique filenames
      const dummyVector = new Array(1536).fill(0);
      const queryResponse = await namespaceObj.query({
        vector: dummyVector,
        topK: 10000, // Get as many as possible
        includeMetadata: true,
      });

      // Group by filename
      const fileMap = new Map<string, {
        filename: string;
        namespace: string;
        uploaded_at: string;
        chunks_count: number;
        vectors_count: number;
        topic: string;
        source: string;
        metadata: Record<string, any>;
      }>();

      if (queryResponse.matches) {
        for (const match of queryResponse.matches) {
          const metadata = match.metadata || {};
          const filename = metadata.filename as string;
          
          if (!filename) continue;

          if (!fileMap.has(filename)) {
            fileMap.set(filename, {
              filename,
              namespace: namespace || '',
              uploaded_at: metadata.uploaded_at as string || new Date().toISOString(),
              chunks_count: 0,
              vectors_count: 0,
              topic: metadata.topic as string || 'Unknown',
              source: metadata.source as string || 'Unknown',
              metadata: metadata,
            });
          }

          const fileInfo = fileMap.get(filename)!;
          fileInfo.vectors_count++;
          fileInfo.chunks_count++;
        }
      }

      return Array.from(fileMap.values()).sort((a, b) => 
        new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
      );
    } catch (error: any) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  /**
   * Delete all vectors for a specific file
   * Uses Pinecone REST API directly since SDK doesn't have delete method
   */
  async deleteFileVectors(
    indexName: string,
    filename: string,
    namespace?: string
  ): Promise<number> {
    try {
      const index = this.client.index(indexName);
      const namespaceObj = namespace ? index.namespace(namespace) : index;

      // Query to find all vector IDs for this file
      const dummyVector = new Array(1536).fill(0);
      const queryResponse = await namespaceObj.query({
        vector: dummyVector,
        topK: 10000,
        includeMetadata: true,
        filter: {
          filename: { $eq: filename },
        },
      });

      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        return 0;
      }

      const vectorIds = queryResponse.matches.map(match => match.id);
      
      // Get index host for REST API
      const indexes = await this.listIndexes();
      const indexInfo = indexes.find((idx: any) => idx.name === indexName);
      
      if (!indexInfo || !indexInfo.host) {
        throw new Error(`Index ${indexName} not found or has no host`);
      }

      const host = indexInfo.host;
      let deletedCount = 0;
      
      // Delete vectors using Pinecone REST API
      // Delete in batches of 1000 (Pinecone limit per request)
      for (let i = 0; i < vectorIds.length; i += 1000) {
        const batch = vectorIds.slice(i, i + 1000);
        try {
          // Use Pinecone REST API for deletion
          const deleteUrl = `https://${host}/vectors/delete`;
          const deletePayload: any = {
            ids: batch,
          };
          
          // Add namespace if not default
          if (namespace && namespace !== '') {
            deletePayload.namespace = namespace;
          }

          const deleteResponse = await fetch(deleteUrl, {
            method: 'POST',
            headers: {
              'Api-Key': this.apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(deletePayload),
          });

          if (deleteResponse.ok) {
            deletedCount += batch.length;
          } else {
            const errorText = await deleteResponse.text();
            console.error(`Error deleting batch ${i / 1000 + 1}:`, deleteResponse.status, errorText);
            // Try individual deletes as fallback
            for (const id of batch) {
              try {
                const singleDeleteResponse = await fetch(deleteUrl, {
                  method: 'POST',
                  headers: {
                    'Api-Key': this.apiKey,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    ids: [id],
                    ...(namespace && namespace !== '' ? { namespace } : {}),
                  }),
                });
                if (singleDeleteResponse.ok) {
                  deletedCount++;
                }
              } catch (err: any) {
                console.error(`Error deleting vector ${id}:`, err);
              }
            }
          }
        } catch (deleteError: any) {
          console.error(`Error deleting batch ${i / 1000 + 1}:`, deleteError);
          // Continue with next batch
        }
      }

      return deletedCount;
    } catch (error: any) {
      console.error('Error deleting file vectors:', error);
      throw error;
    }
  }
}

