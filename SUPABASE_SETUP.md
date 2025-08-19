# Supabase Vector Store Setup Guide

This guide will help you configure Supabase as your vector store for the TNH LangChain Service.

## Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Supabase Project**: Create a new project or use existing one
3. **pgvector Extension**: Enable the pgvector extension in your Supabase database

## Step 1: Enable pgvector Extension

1. **Go to your Supabase Dashboard**
2. **Navigate to SQL Editor**
3. **Run the following SQL command:**

```sql
-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table for your documents (if not exists)
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding vector(1536) -- Adjust dimension based on your embedding model
);

-- Create an index for similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

## Step 2: Get Your Supabase Credentials

1. **Go to Project Settings → API**
2. **Copy the following values:**
   - **Project URL**: `https://your-project-ref.supabase.co`
   - **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## Step 3: Configure Environment Variables

Create your `.env` file with the following Supabase configuration:

```bash
# Required
SERVICE_API_KEY=your-secure-api-key-here

# AI Provider
PROVIDER=openai  # or 'ollama'

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBED_MODEL=text-embedding-3-small

# Supabase Vector Store Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_TABLE=documents
```

## Step 4: Test Your Configuration

1. **Start the service locally:**
   ```bash
   npm run dev
   ```

2. **Test the health endpoint:**
   ```bash
   curl http://localhost:8787/api/health
   ```

3. **Test the chat endpoint:**
   ```bash
   curl -X POST http://localhost:8787/api/chat \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-api-key" \
     -d '{"message": "Hello", "conversation_history": []}'
   ```

## Step 5: Deploy to Vercel

1. **Set environment variables in Vercel:**
   ```bash
   vercel env add SERVICE_API_KEY
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add SUPABASE_TABLE
   vercel env add OPENAI_API_KEY
   vercel env add PROVIDER
   ```

2. **Deploy:**
   ```bash
   vercel --prod
   ```

## Vector Store Schema

Your Supabase table should have this structure:

```sql
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,           -- The document text
  metadata JSONB,                  -- Metadata (title, url, author, etc.)
  embedding vector(1536)           -- Vector embedding (dimension varies by model)
);
```

### Metadata Structure

The `metadata` field should contain:

```json
{
  "title": "Article Title",
  "url": "/node/123",
  "author": "Author Name",
  "date": "2024-01-01",
  "type": "article",
  "id": "123"
}
```

## Drupal Integration

When your Drupal script populates the vector store, ensure it follows this structure:

```php
// Example Drupal script for populating Supabase
$document = [
  'content' => $node->body->value,
  'metadata' => [
    'title' => $node->title->value,
    'url' => '/node/' . $node->id(),
    'author' => $node->field_author->value,
    'date' => $node->created->value,
    'type' => 'article',
    'id' => $node->id()
  ]
];
```

## Troubleshooting

### Common Issues

1. **"Extension vector does not exist"**
   - Enable pgvector extension in Supabase SQL Editor

2. **"Permission denied"**
   - Use Service Role Key, not anon key
   - Check RLS (Row Level Security) settings

3. **"Table does not exist"**
   - Create the documents table with correct schema
   - Check table name in SUPABASE_TABLE env var

4. **"Invalid embedding dimension"**
   - Match vector dimension to your embedding model
   - OpenAI text-embedding-3-small: 1536
   - Ollama nomic-embed-text: 768

### Security Notes

- **Never commit your `.env` file** to version control
- **Use Service Role Key** for server-side operations
- **Enable RLS** on your documents table for production
- **Rotate API keys** regularly

## Next Steps

1. **Populate your vector store** with Drupal content
2. **Test similarity search** functionality
3. **Monitor performance** and adjust index settings
4. **Set up monitoring** for your Supabase usage
