# Local Development Guide

This guide explains how to run the TNH LangChain Service locally for development and testing, without Docker.

## Prerequisites

1. **Node.js 18+**: Install from [nodejs.org](https://nodejs.org)
2. **Environment Variables**: Configure your `.env` file
3. **Optional: Ollama**: For local AI model testing

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp env.example .env

# Edit .env with your actual values
nano .env
```

### 3. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:8787` with hot reloading enabled.

## Environment Configuration

### For Supabase + OpenAI (Recommended)

```bash
# Required
SERVICE_API_KEY=your-secure-api-key

# AI Provider
PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBED_MODEL=text-embedding-3-small

# Supabase Vector Store
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_TABLE=documents
```

### For Local Development with Ollama

```bash
# Required
SERVICE_API_KEY=your-secure-api-key

# AI Provider
PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3
OLLAMA_EMBED_MODEL=nomic-embed-text

# Supabase Vector Store (still needed for vector search)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_TABLE=documents
```

## API Endpoints

When running locally, the service provides the same API endpoints as Vercel:

- **POST** `http://localhost:8787/api/chat` - Main chat endpoint
- **GET** `http://localhost:8787/api/health` - Health check
- **POST** `http://localhost:8787/api/reindex` - Reindex endpoint

### Legacy Endpoints (for backward compatibility)

- **POST** `http://localhost:8787/chat` - Redirects to `/api/chat`
- **GET** `http://localhost:8787/health` - Redirects to `/api/health`
- **POST** `http://localhost:8787/reindex` - Redirects to `/api/reindex`

## Testing

### Test Locally

```bash
# Test against local server
npm run test:local
```

### Test Against Vercel

```bash
# Set your Vercel URL
export VERCEL_URL=your-app.vercel.app

# Test against deployed server
npm run test:vercel
```

### Manual Testing with curl

```bash
# Health check
curl http://localhost:8787/api/health

# Chat endpoint
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "message": "Hello, can you tell me about The New Humanitarian?",
    "conversation_history": [],
    "ai_settings": {
      "provider": "openai",
      "model": "gpt-4o-mini"
    }
  }'
```

## Development Workflow

### 1. Local Development

```bash
# Start development server with hot reload
npm run dev
```

### 2. Testing Changes

```bash
# Test your changes locally
npm run test:local

# Test against production (if deployed)
npm run test:vercel
```

### 3. Deploy to Vercel

```bash
# Deploy changes
vercel --prod

# Test production deployment
npm run test:vercel
```

## Debugging

### Enable Debug Logging

Add to your `.env` file:

```bash
DEBUG=*
NODE_ENV=development
```

### View Logs

The development server logs all requests and responses:

```bash
[tnh-langchain-service] Local development server listening on :8787
[tnh-langchain-service] API endpoints:
  - POST http://localhost:8787/api/chat
  - GET  http://localhost:8787/api/health
  - POST http://localhost:8787/api/reindex
[tnh-langchain-service] Provider: openai
```

### Common Issues

1. **Port already in use**
   ```bash
   # Change port in .env
   PORT=8788
   ```

2. **Environment variables not loaded**
   ```bash
   # Ensure .env file exists and is in the correct location
   ls -la .env
   ```

3. **CORS issues**
   - CORS is enabled by default for all origins in development
   - Check browser console for specific errors

4. **Vector store connection issues**
   - Verify Supabase credentials
   - Check if pgvector extension is enabled
   - Ensure table exists with correct schema

## Performance

### Local Development Tips

1. **Use Ollama for faster iteration**
   - No API rate limits
   - No costs
   - Faster response times

2. **Limit vector search results**
   - Adjust `k` parameter in `getRetriever()` function
   - Default is 6 documents

3. **Monitor memory usage**
   - Large conversation histories can consume memory
   - Consider implementing conversation limits

## Security

### Local Development Security

1. **Never commit `.env` files**
   ```bash
   # Ensure .env is in .gitignore
   echo ".env" >> .gitignore
   ```

2. **Use strong API keys**
   ```bash
   # Generate a secure API key
   openssl rand -base64 32
   ```

3. **Limit network access**
   ```bash
   # Only bind to localhost in development
   HOST=127.0.0.1
   ```

## Integration with Drupal

### Local Testing with Drupal

1. **Configure Drupal to point to local service**
   ```php
   $config = [
     'tnh_langchain_url' => 'http://localhost:8787/api/chat',
     'tnh_langchain_api_key' => 'your-api-key',
   ];
   ```

2. **Test Drupal integration**
   - Use Drupal's AI chat interface
   - Verify responses are received
   - Check logs for errors

### Production Deployment

1. **Update Drupal configuration**
   ```php
   $config = [
     'tnh_langchain_url' => 'https://your-app.vercel.app/api/chat',
     'tnh_langchain_api_key' => 'your-api-key',
   ];
   ```

2. **Test production integration**
   - Verify all endpoints work
   - Check response times
   - Monitor error rates

## Next Steps

1. **Set up your Supabase vector store** (see `SUPABASE_SETUP.md`)
2. **Configure your AI provider** (OpenAI or Ollama)
3. **Test the API endpoints** locally
4. **Deploy to Vercel** for production use
5. **Integrate with your Drupal site**
