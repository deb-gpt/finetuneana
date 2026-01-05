import { NextRequest, NextResponse } from 'next/server';
import { OpenAIService } from '@/lib/services/openai.service';
import { PineconeService } from '@/lib/services/pinecone.service';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat
 * RAG Chatbot - Retrieves relevant memories and generates contextual responses
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      indexName,
      query,
      namespace,
      systemPrompt, // Custom system prompt from UI
      conversationHistory = [],
      topK = 5,
      dimensions = 1536,
    } = body;

    if (!indexName || !query) {
      return NextResponse.json(
        { error: 'Index name and query are required' },
        { status: 400 }
      );
    }

    console.log(`Chat query: "${query}" in index: ${indexName}, namespace: ${namespace || 'default'}`);

    // Step 1: Generate embedding for the query
    const openAIService = new OpenAIService();
    const queryEmbedding = await openAIService.generateEmbedding(query, dimensions);

    // Step 2: Search Pinecone for relevant memories
    const pineconeService = new PineconeService();
    const searchResults = await pineconeService.queryIndex(
      indexName,
      queryEmbedding,
      topK,
      undefined, // No metadata filter for chat
      namespace || undefined
    );

    console.log(`Found ${searchResults.length} relevant memories`);

    if (searchResults.length === 0) {
      return NextResponse.json({
        response: "I couldn't find any relevant information in the memory to answer your question. Please try rephrasing or check if the memory has been properly ingested.",
        sources: [],
      });
    }

    // Step 3: Build context from retrieved memories
    // Use full text from metadata (not truncated)
    const context = searchResults
      .map((match: any, index: number) => {
        // Try multiple metadata fields to get full text
        const text = match.metadata?.text || 
                    match.metadata?.chunk_text || 
                    match.metadata?.content || 
                    '';
        const source = match.metadata?.source || match.metadata?.filename || 'Unknown';
        const topic = match.metadata?.topic ? ` (Topic: ${match.metadata.topic})` : '';
        
        // Only include chunks with meaningful content
        if (text.length < 50) {
          return null;
        }
        
        return `[Memory ${index + 1} from ${source}${topic}]:\n${text}`;
      })
      .filter((ctx: string | null) => ctx !== null) // Remove empty chunks
      .join('\n\n');
    
    if (!context || context.trim().length === 0) {
      return NextResponse.json({
        response: "I found some memories but they don't contain enough text to provide a meaningful answer. The chunks may be too small or incomplete.",
        sources: searchResults.map((m: any) => ({
          id: m.id,
          score: m.score,
          text: m.metadata?.text?.substring(0, 100) || 'Incomplete chunk',
        })),
      });
    }

    // Step 4: Build conversation context
    const conversationContext = conversationHistory
      .slice(-4) // Last 4 messages for context
      .map((msg: any) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    // Step 5: Generate response using OpenAI with retrieved context
    // Use custom system prompt if provided, otherwise use default
    const defaultSystemPrompt = `You are Ana, an AI assistant for FreightX. You help users by answering questions based on their stored memories in Pinecone.

Instructions:
- Use ONLY the information provided in the context below to answer the question
- If the context doesn't contain enough information, say so clearly
- Be concise and helpful
- Cite sources when relevant
- If asked about something not in the context, politely explain that you don't have that information in the current memory`;

    const finalSystemPrompt = systemPrompt && systemPrompt.trim()
      ? `${systemPrompt.trim()}\n\nContext from memory:\n${context}`
      : `${defaultSystemPrompt}\n\nContext from memory:\n${context}`;

    const userPrompt = conversationContext
      ? `Previous conversation:\n${conversationContext}\n\nCurrent question: ${query}`
      : query;

    const chatResponse = await openAIService.generateChatResponse(
      finalSystemPrompt,
      userPrompt,
      conversationHistory
    );

    // Step 6: Format sources for display
    const sources = searchResults.map((match: any) => ({
      id: match.id,
      score: match.score,
      text: match.metadata?.text || match.metadata?.chunk_text || '',
      source: match.metadata?.source || match.metadata?.filename || 'Unknown',
      topic: match.metadata?.topic,
    }));

    return NextResponse.json({
      response: chatResponse,
      sources,
      retrievedCount: searchResults.length,
    });
  } catch (error: any) {
    console.error('Error in chat:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate response' },
      { status: 500 }
    );
  }
}

