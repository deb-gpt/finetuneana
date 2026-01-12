import OpenAI from 'openai';

/**
 * OpenAI Service
 * Handles embedding generation using OpenAI's text-embedding-3-large model
 */
export class OpenAIService {
  private client: OpenAI;
  private model: string = 'text-embedding-3-large';
  private defaultDimensions: number = 1536;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Generate embeddings for text
   * @param text - Text to embed
   * @param dimensions - Optional dimensions (1536 or 3072 for text-embedding-3-large)
   */
  async generateEmbedding(
    text: string,
    dimensions: number = this.defaultDimensions
  ): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
        dimensions: dimensions,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param texts - Array of texts to embed
   * @param dimensions - Optional dimensions
   */
  async generateEmbeddingsBatch(
    texts: string[],
    dimensions: number = this.defaultDimensions
  ): Promise<number[][]> {
    try {
      // OpenAI API supports up to 2048 inputs per request
      const batchSize = 100; // Conservative batch size
      const embeddings: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const response = await this.client.embeddings.create({
          model: this.model,
          input: batch,
          dimensions: dimensions,
        });

        const batchEmbeddings = response.data.map((item) => item.embedding);
        embeddings.push(...batchEmbeddings);
      }

      return embeddings;
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw error;
    }
  }

  /**
   * Suggest topic and subtopic for a document using LLM
   */
  async suggestTopic(text: string): Promise<{ topic: string; subtopic?: string }> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'Analyze the following text and suggest a main topic and optional subtopic. Respond in JSON format: {"topic": "main topic", "subtopic": "optional subtopic"}',
          },
          {
            role: 'user',
            content: text.substring(0, 2000), // Limit to first 2000 chars
          },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (content) {
        return JSON.parse(content);
      }

      return { topic: 'General' };
    } catch (error) {
      console.error('Error suggesting topic:', error);
      return { topic: 'General' };
    }
  }

  /**
   * Extract comprehensive metadata from document using GPT-4
   */
  async extractMetadata(
    text: string,
    filename?: string
  ): Promise<{
    topic: string;
    subtopic?: string;
    source: string;
    version?: string;
    document_type?: string;
    tags?: string[];
    summary?: string;
    date?: string;
    author?: string;
  }> {
    try {
      const prompt = `Analyze the following document${filename ? ` (filename: ${filename})` : ''} and extract structured metadata.

Extract the following information:
- topic: Main topic/subject of the document
- subtopic: Optional subtopic or category
- source: Source organization/publication (infer from content or filename)
- version: Version number if mentioned
- document_type: Type of document (report, manual, article, data, etc.)
- tags: List of relevant tags/keywords (3-5 tags)
- summary: Brief summary in 1-2 sentences
- date: Document date if mentioned (YYYY-MM-DD format)
- author: Author or organization if mentioned

Return ONLY valid JSON in this format:
{
    "topic": "string",
    "subtopic": "string or null",
    "source": "string",
    "version": "string or null",
    "document_type": "string or null",
    "tags": ["tag1", "tag2"],
    "summary": "string or null",
    "date": "YYYY-MM-DD or null",
    "author": "string or null"
}`;

      // Limit text to first 5000 chars for efficiency
      const textSample = text.length > 5000 ? text.substring(0, 5000) : text;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'You are a metadata extraction assistant. Analyze documents and extract structured metadata. Always return valid JSON.',
          },
          {
            role: 'user',
            content: `${prompt}\n\nDocument content:\n${textSample}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more consistent extraction
        max_tokens: 500,
      });

      const content = response.choices[0].message.content;
      if (content) {
        const metadata = JSON.parse(content);
        // Validate and clean metadata
        return {
          topic: metadata.topic || 'General',
          subtopic: metadata.subtopic || undefined,
          source: metadata.source || filename || 'Unknown',
          version: metadata.version || undefined,
          document_type: metadata.document_type || undefined,
          tags: metadata.tags || undefined,
          summary: metadata.summary || undefined,
          date: metadata.date || undefined,
          author: metadata.author || undefined,
        };
      }

      return {
        topic: 'General',
        source: filename || 'Unknown',
      };
    } catch (error) {
      console.error('Error extracting metadata:', error);
      return {
        topic: 'General',
        source: filename || 'Unknown',
      };
    }
  }

  /**
   * Generate chat response using OpenAI with context
   */
  async generateChatResponse(
    systemPrompt: string,
    userPrompt: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<string> {
    try {
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Add conversation history (last few messages)
      conversationHistory.slice(-6).forEach((msg) => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      });

      // Add current user prompt
      messages.push({ role: 'user', content: userPrompt });

      const response = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      return response.choices[0].message.content || 'I apologize, but I could not generate a response.';
    } catch (error) {
      console.error('Error generating chat response:', error);
      throw error;
    }
  }
}

