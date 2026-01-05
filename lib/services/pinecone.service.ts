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
    });
    console.log('Pinecone client initialized with API key:', this.apiKey.substring(0, 10) + '...');
  }

  /**
   * List all indexes using Pinecone SDK
   * Returns an object with an 'indexes' property containing array of index descriptions
   * Each index has: name, dimension, metric, host, spec, status
   */
  async listIndexes() {
    try {
      console.log('Calling Pinecone listIndexes()...');
      
      // Use the SDK method directly as per Pinecone documentation
      // Returns: { indexes: [{ name, dimension, metric, host, spec, status }, ...] }
      const response = await this.client.listIndexes();
      console.log('Pinecone listIndexes response:', JSON.stringify(response, null, 2));
      
      // The SDK returns an object with an 'indexes' property containing the array
      const indexList = response.indexes || [];
      
      console.log(`Found ${indexList.length} indexes from Pinecone SDK`);
      
      // Log each index for debugging
      if (indexList.length > 0) {
        indexList.forEach((index: any) => {
          console.log(`  - ${index.name}: ${index.dimension}D, ${index.metric}, status: ${index.status?.state || 'unknown'}`);
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
      const exists = existingIndexes.some((idx) => idx.name === name);

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
}

