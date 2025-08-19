import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import fetch from 'node-fetch';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnablePassthrough, RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { createClient } from '@supabase/supabase-js';

// Optional: Ollama (dev)
import { ChatOllama } from '@langchain/ollama';
import { OllamaEmbeddings } from '@langchain/ollama';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

const PORT = process.env.PORT || 8787;
const PROVIDER = process.env.PROVIDER || 'ollama';

function selectModels(aiSettings = null) {
  // Use Drupal AI settings if provided, otherwise fall back to environment variables
  let provider = 'ollama';
  let model = 'llama3';
  let embedModel = 'nomic-embed-text';
  
  if (aiSettings && aiSettings.provider) {
    provider = aiSettings.provider;
    model = aiSettings.model || 'llama3';
  } else {
    // Fallback to environment variables
    provider = process.env.PROVIDER || 'ollama';
    model = process.env.OLLAMA_MODEL || 'llama3';
    embedModel = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
  }

  if (provider === 'openai') {
    const chat = new ChatOpenAI({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      apiKey: process.env.OPENAI_API_KEY,
    });
    const embeddings = new OpenAIEmbeddings({
      model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
      apiKey: process.env.OPENAI_API_KEY,
    });
    return { chat, embeddings };
  }
  // Default: Ollama
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

function extractSources(docs) {
  if (!docs) return [];
  const seen = new Set();
  const sources = [];
  for (const d of docs) {
    const url = d?.metadata?.url;
    const label = d?.metadata?.title || d?.metadata?.url || 'Source';
    const id = d?.metadata?.id;
    if (url && !seen.has(url)) {
      seen.add(url);
      sources.push({ id, url, label });
    }
  }
  return sources.slice(0, 8);
}

// API routes - matches Vercel structure
app.post('/api/chat', async (req, res) => {
  // Enable CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

    console.log('[tnh-langchain-service] Processing chat request with database_context length:', database_context ? database_context.length : 0);

    // Log AI settings for debugging
    if (ai_settings && Object.keys(ai_settings).length > 0) {
      console.log('[tnh-langchain-service] Using Drupal AI settings:', ai_settings);
    } else {
      console.log('[tnh-langchain-service] Using environment variable defaults');
    }

    const { chat, embeddings } = selectModels(ai_settings);
    console.log('[tnh-langchain-service] Models selected, provider:', ai_settings?.provider || PROVIDER);
    
    // Only try to get retriever if we don't have database_context
    let retriever = null;
    if (!database_context || !database_context.trim()) {
      console.log('[tnh-langchain-service] No database_context provided, attempting to get retriever');
      retriever = await getRetriever(embeddings);
    } else {
      console.log('[tnh-langchain-service] Using database_context, skipping retriever');
    }

    let chain;
    let usedDocs = [];
    
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
      
      const text = await prompt.pipe(chat).pipe(new StringOutputParser()).invoke({});
      const sources = []; // No sources from vector store when using database_context
      const meta = {
        provider: ai_settings?.provider || PROVIDER,
        model: ai_settings?.model || (PROVIDER === 'openai' ? (process.env.OPENAI_MODEL || 'gpt-4o-mini') : (process.env.OLLAMA_MODEL || 'llama3'))
      };
      return res.json({
        message: text,
        context: { relevant_articles: sources },
        meta
      });
    } else if (retriever) {
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', SYSTEM_TEMPLATE],
        ...conversation_history.map((m) => [m.role, m.content]),
        ['human', '{question}'],
      ]);

      chain = RunnableSequence.from([
        {
          context: retriever.pipe((docs) => {
            usedDocs = docs || [];
            return formatDocs(usedDocs);
          }),
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

    const text = await chain.invoke(message);
    const sources = extractSources(usedDocs);
    // Echo minimal metadata to help Drupal logging
    const meta = {
      provider: ai_settings?.provider || PROVIDER,
      model: ai_settings?.model || (PROVIDER === 'openai' ? (process.env.OPENAI_MODEL || 'gpt-4o-mini') : (process.env.OLLAMA_MODEL || 'llama3'))
    };
    return res.json({
      message: text,
      context: { relevant_articles: sources },
      meta
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Health endpoint - matches Vercel API structure
app.get('/api/health', (req, res) => {
  // Enable CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  return res.json({ 
    ok: true, 
    provider: PROVIDER, 
    port: Number(PORT),
    default_model: process.env.OLLAMA_MODEL || 'llama3',
    default_embed_model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Reindex endpoint - matches Vercel API structure
app.post('/api/reindex', async (req, res) => {
  // Enable CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const apiKey = process.env.SERVICE_API_KEY || '';
    const auth = req.headers.authorization || '';
    if (apiKey && auth !== `Bearer ${apiKey}`) {
      return res.status(401).json({ error: 'Unauthorised' });
    }

    // Placeholder endpoint; will be implemented in Phase 2.
    return res.json({ 
      ok: true, 
      stats: { 
        numAdded: 0, 
        numUpdated: 0, 
        numDeleted: 0, 
        numSkipped: 0 
      },
      message: 'Reindex endpoint ready for implementation',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Streaming chat endpoint
app.post('/api/chat-stream', async (req, res) => {
  // Enable CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
    
    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Stream the response
    for await (const chunk of stream) {
      res.write(chunk);
    }
    
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Legacy endpoints for backward compatibility
app.post('/chat', async (req, res) => {
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

    console.log('[tnh-langchain-service] Processing chat request with database_context length:', database_context ? database_context.length : 0);

    // Log AI settings for debugging
    if (ai_settings && Object.keys(ai_settings).length > 0) {
      console.log('[tnh-langchain-service] Using Drupal AI settings:', ai_settings);
    } else {
      console.log('[tnh-langchain-service] Using environment variable defaults');
    }

    const { chat, embeddings } = selectModels(ai_settings);
    console.log('[tnh-langchain-service] Models selected, provider:', ai_settings?.provider || PROVIDER);
    
    // Only try to get retriever if we don't have database_context
    let retriever = null;
    if (!database_context || !database_context.trim()) {
      console.log('[tnh-langchain-service] No database_context provided, attempting to get retriever');
      retriever = await getRetriever(embeddings);
    } else {
      console.log('[tnh-langchain-service] Using database_context, skipping retriever');
    }

    let chain;
    let usedDocs = [];
    
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
      
      const text = await prompt.pipe(chat).pipe(new StringOutputParser()).invoke({});
      const sources = []; // No sources from vector store when using database_context
      const meta = {
        provider: ai_settings?.provider || PROVIDER,
        model: ai_settings?.model || (PROVIDER === 'openai' ? (process.env.OPENAI_MODEL || 'gpt-4o-mini') : (process.env.OLLAMA_MODEL || 'llama3'))
      };
      return res.json({
        message: text,
        context: { relevant_articles: sources },
        meta
      });
    } else if (retriever) {
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', SYSTEM_TEMPLATE],
        ...conversation_history.map((m) => [m.role, m.content]),
        ['human', '{question}'],
      ]);

      chain = RunnableSequence.from([
        {
          context: retriever.pipe((docs) => {
            usedDocs = docs || [];
            return formatDocs(usedDocs);
          }),
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

    const text = await chain.invoke(message);
    const sources = extractSources(usedDocs);
    // Echo minimal metadata to help Drupal logging
    const meta = {
      provider: ai_settings?.provider || PROVIDER,
      model: ai_settings?.model || (PROVIDER === 'openai' ? (process.env.OPENAI_MODEL || 'gpt-4o-mini') : (process.env.OLLAMA_MODEL || 'llama3'))
    };
    return res.json({
      message: text,
      context: { relevant_articles: sources },
      meta
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/reindex', async (_req, res) => {
  // Placeholder endpoint; will be implemented in Phase 2.
  return res.json({ ok: true, stats: { numAdded: 0, numUpdated: 0, numDeleted: 0, numSkipped: 0 } });
});

// Lightweight health endpoint for ops checks
app.get('/health', (_req, res) => {
  return res.json({ 
    ok: true, 
    provider: PROVIDER, 
    port: Number(PORT),
    default_model: process.env.OLLAMA_MODEL || 'llama3',
    default_embed_model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'
  });
});

app.listen(PORT, () => {
  console.log(`[tnh-langchain-service] Listening on :${PORT}`);
});


