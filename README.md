# TNH LangChain Service

A serverless LangChain service for The New Humanitarian, designed to provide AI-powered chat functionality with vector search capabilities. This service can be deployed on Vercel and integrated with Drupal.

## Features

- **Multi-Provider Support**: OpenAI and Ollama integration
- **Vector Search**: Supabase and PostgreSQL pgvector support
- **Drupal Integration**: Optimized for TNH content database
- **Serverless**: Deployed on Vercel for scalability
- **British English**: Localized responses for TNH audience

## Quick Start

### Prerequisites

- Node.js 18+ 
- Vercel CLI (`npm i -g vercel`)
- Environment variables configured

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Run locally:**
   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:8787` with hot reloading enabled.

   **For detailed local development instructions, see [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)**

### Vercel Deployment

1. **Deploy to Vercel:**
   ```bash
   vercel
   ```

2. **Set environment variables in Vercel dashboard:**
   - Go to your project settings
   - Add all variables from your `.env` file

3. **Your API will be available at:**
   - `https://your-project.vercel.app/api/chat`
   - `https://your-project.vercel.app/api/health`
   - `https://your-project.vercel.app/api/reindex`

## API Endpoints

### POST `/api/chat`

Main chat endpoint for AI interactions.

**Request Body:**
```json
{
  "message": "What articles do you have about Syria?",
  "conversation_history": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi! How can I help you?"}
  ],
  "database_context": "Optional: Pre-filtered content from Drupal",
  "ai_settings": {
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```

**Response:**
```json
{
  "message": "Based on our database, I found several articles about Syria...",
  "context": {
    "relevant_articles": [
      {
        "id": "123",
        "url": "/node/123",
        "label": "Syria Crisis Deepens"
      }
    ]
  },
  "meta": {
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```

### GET `/api/health`

Health check endpoint.

**Response:**
```json
{
  "ok": true,
  "provider": "ollama",
  "port": 8787,
  "default_model": "llama3",
  "default_embed_model": "nomic-embed-text",
  "environment": "production",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST `/api/reindex`

Reindex documents (Phase 2 implementation).

## Environment Variables

### Required
- `SERVICE_API_KEY`: API key for authentication

### AI Provider Configuration
- `PROVIDER`: `ollama` or `openai`
- `OLLAMA_HOST`: Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL`: Ollama model name (default: `llama3`)
- `OLLAMA_EMBED_MODEL`: Ollama embedding model (default: `nomic-embed-text`)
- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_MODEL`: OpenAI model (default: `gpt-4o-mini`)
- `OPENAI_EMBED_MODEL`: OpenAI embedding model (default: `text-embedding-3-small`)

### Vector Store Configuration
Choose either Supabase or PostgreSQL:

**Supabase:**
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key
- `SUPABASE_TABLE`: Vector table name

**PostgreSQL (pgvector):**
- `POSTGRES_URL`: Full connection string
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`: Individual connection params
- `PGVECTOR_TABLE`: Vector table name (default: `langchain`)

## Drupal Integration

### Module Configuration

In your Drupal AI module, configure the service URL:

```php
$config = [
  'tnh_langchain_url' => 'https://your-vercel-app.vercel.app/api/chat',
  'tnh_langchain_api_key' => 'your-service-api-key',
];
```

### Example Drupal Integration

```php
function tnh_ai_chat($message, $conversation_history = [], $database_context = '') {
  $url = \Drupal::config('tnh_ai.settings')->get('langchain_url');
  $api_key = \Drupal::config('tnh_ai.settings')->get('langchain_api_key');
  
  $response = \Drupal::httpClient()->post($url, [
    'headers' => [
      'Authorization' => 'Bearer ' . $api_key,
      'Content-Type' => 'application/json',
    ],
    'json' => [
      'message' => $message,
      'conversation_history' => $conversation_history,
      'database_context' => $database_context,
      'ai_settings' => [
        'provider' => 'openai',
        'model' => 'gpt-4o-mini',
      ],
    ],
  ]);
  
  return json_decode($response->getBody(), TRUE);
}
```

## Development Workflow

### Local Testing

1. **Test with curl:**
   ```bash
   curl -X POST http://localhost:8787/api/chat \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-api-key" \
     -d '{"message": "Hello", "conversation_history": []}'
   ```

2. **Test health endpoint:**
   ```bash
   curl http://localhost:8787/api/health
   ```

### Vercel Development

1. **Deploy to preview:**
   ```bash
   vercel --prod
   ```

2. **Test production endpoint:**
   ```bash
   curl -X POST https://your-app.vercel.app/api/chat \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-api-key" \
     -d '{"message": "Hello"}'
   ```

## Architecture

### Serverless Functions

- `/api/chat.js`: Main chat endpoint (60s timeout)
- `/api/health.js`: Health check (10s timeout)
- `/api/reindex.js`: Document reindexing (300s timeout)

### Vector Store Options

1. **Supabase**: Cloud-hosted pgvector
2. **PostgreSQL**: Self-hosted pgvector (via DDEV)

### AI Providers

1. **OpenAI**: Production-ready, paid
2. **Ollama**: Local development, free

## Troubleshooting

### Common Issues

1. **Timeout errors**: Increase function timeout in `vercel.json`
2. **CORS errors**: CORS is enabled by default for all origins
3. **Authentication errors**: Check `SERVICE_API_KEY` configuration
4. **Vector store connection**: Verify database credentials

### Logs

- Vercel logs: `vercel logs`
- Function logs: Available in Vercel dashboard

## Security

- API key authentication required for all endpoints
- CORS configured for cross-origin requests
- Environment variables for sensitive configuration
- No client-side secrets exposed

## Performance

- Serverless functions scale automatically
- Vector search optimized for TNH content
- Response caching recommended for production
- Consider CDN for static assets

## Future Enhancements

- [ ] Document reindexing from Drupal
- [ ] Streaming responses
- [ ] Conversation persistence
- [ ] Advanced filtering options
- [ ] Analytics and monitoring
- [ ] Multi-language support

## Support

For issues related to:
- **Vercel deployment**: Check Vercel documentation
- **LangChain integration**: Review LangChain docs
- **Drupal integration**: Contact TNH development team
- **Vector store setup**: Refer to pgvector documentation
