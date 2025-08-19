require('dotenv/config');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { RunnablePassthrough, RunnableSequence } = require('@langchain/core/runnables');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { ChatOpenAI, OpenAIEmbeddings } = require('@langchain/openai');
const { SupabaseVectorStore } = require('@langchain/community/vectorstores/supabase');
const { createClient } = require('@supabase/supabase-js');
const { toDataStreamResponse } = require('@ai-sdk/langchain');

// Optional: Ollama (dev)
const { ChatOllama } = require('@langchain/ollama');
const { OllamaEmbeddings } = require('@langchain/ollama');

const PROVIDER = process.env.PROVIDER || 'ollama';

function selectModels(aiSettings = null) {
  let provider = 'ollama';
  let model = 'llama3';
  let embedModel = 'nomic-embed-text';
  
  if (aiSettings && aiSettings.provider) {
    provider = aiSettings.provider;
    model = aiSettings.model || 'llama3';
  } else {
    provider = process.env.PROVIDER || 'ollama';
    model = process.env.OLLAMA_MODEL || 'llama3';
    embedModel = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
  }

  if (provider === 'openai') {
    const chat = new ChatOpenAI({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      apiKey: process.env.OPENAI_API_KEY,
      streaming: true, // Enable streaming
    });
    const embeddings = new OpenAIEmbeddings({
      model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
      apiKey: process.env.OPENAI_API_KEY,
    });
    return { chat, embeddings };
  }
  
  const chat = new ChatOllama({
    baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
    model: model,
    temperature: 0.2,
  });
  const embeddings = new OllamaEmbeddings({
    baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
    model: embedModel,
  });
  return { chat, embeddings };
}

async function getRetriever(embeddings) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (supabaseUrl && supabaseKey) {
    const client = createClient(supabaseUrl, supabaseKey);
    const vectorStore = await SupabaseVectorStore.fromExistingIndex(embeddings, { client });
    return vectorStore.asRetriever({ k: 6 });
  }
  
  console.log('[tnh-langchain-service] No Supabase configuration found, skipping vector store');
  return null;
}

const SYSTEM_TEMPLATE = `Use the following pieces of context to answer the question at the end.
If you don't know the answer from the context, say you don't know. Answer in British English.
Return links as-is. Keep responses concise and cite sources when used.
----------------
{context}`;

function formatDocs(docs) {
  if (!docs || docs.length === 0) return '';
  return docs.map((d) => d.pageContent).join('\n\n');
}

module.exports = async function handler(req, res) {
  // Enable CORS for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.SERVICE_API_KEY || '';
    const auth = req.headers.authorization || '';
    if (apiKey && auth !== `Bearer ${apiKey}`) {
      return res.status(401).json({ error: 'Unauthorised' });
    }

    const { message, conversation_history = [], database_context = '', ai_settings = {} } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid message' });
    }

    console.log('[tnh-langchain-service] Processing streaming chat request');

    const { chat, embeddings } = selectModels(ai_settings);
    
    // Only try to get retriever if we don't have database_context
    let retriever = null;
    if (!database_context || !database_context.trim()) {
      retriever = await getRetriever(embeddings);
    }

    let chain;
    
    // Prioritise database_context from Drupal if provided
    if (database_context && database_context.trim()) {
      const drupalSystemPrompt = `You are an AI assistant for The New Humanitarian, a news website focused on humanitarian crises and aid.

Your role is to help users find information from The New Humanitarian's database of articles.

STRICT GUIDELINES:
- ONLY use information explicitly stated in the provided database context
- If the database context doesn't contain the information requested, clearly state "I don't have that information in our database"
- Never make assumptions or fill in gaps with external knowledge
- Be extremely careful about details like job titles, organisations, dates, and relationships
- When citing articles, use ONLY the exact title and Link from the database context
- If multiple articles mention contradictory information, acknowledge the discrepancy

AUTHORSHIP VS EDITING:
- "Edited by <Name>" does NOT mean the person wrote the article. It indicates editorial oversight, not authorship.
- When users ask for items "written by" a person, use ONLY the Author field to match names, never the editor credit.

PRONOUNS AND GENDER:
- Do not assume a person's gender. If gender is not explicitly stated in the database context, use gender-neutral language and pronouns (they/them) by default.

Response format:
1. Answer based ONLY on the provided database context
2. Include relevant article titles as clickable links using the format: [Article Title](Link)
3. NEVER use tables, pipes (|), or complex formatting - use simple bullet lists only
4. When listing multiple articles, use this format:
   - [Article Title](/node/123) — Date or brief context
   - [Another Article](/node/456) — Date or brief context
5. If no relevant information is found, clearly state this
6. Never speculate or add external information
7. DO NOT create a "Key sources" or "Sources" section - the interface will handle source display automatically

Remember: Accuracy is more important than completeness. If you're not certain about something from the database context, don't include it.

LANGUAGE: Always respond in British English (use "apologise" not "apologize", "whilst" not "while", "colour" not "color", "organisation" not "organization", etc.).

DATABASE CONTEXT:
${database_context}`;

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', drupalSystemPrompt],
        ...conversation_history.map((m) => [m.role, m.content]),
        ['human', message],
      ]);
      
      chain = prompt.pipe(chat).pipe(new StringOutputParser());
    } else if (retriever) {
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', SYSTEM_TEMPLATE],
        ...conversation_history.map((m) => [m.role, m.content]),
        ['human', '{question}'],
      ]);

      chain = RunnableSequence.from([
        {
          context: retriever.pipe((docs) => formatDocs(docs)),
          question: new RunnablePassthrough(),
        },
        prompt,
        chat,
        new StringOutputParser(),
      ]);
    } else {
      // No retriever configured; direct chat
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', 'You are a helpful assistant for The New Humanitarian. Answer in British English.'],
        ...conversation_history.map((m) => [m.role, m.content]),
        ['human', '{question}'],
      ]);
      chain = RunnableSequence.from([
        { question: new RunnablePassthrough() },
        prompt,
        chat,
        new StringOutputParser(),
      ]);
    }

    // Stream the response
    const stream = await chain.stream(message);
    return toDataStreamResponse(stream);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
