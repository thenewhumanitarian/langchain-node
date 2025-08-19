# Drupal Integration Instructions for TNH LangChain Service

## Overview

This document provides instructions for integrating The New Humanitarian's Drupal site with the LangChain AI service deployed on Vercel at `https://tnh-langchain.vercel.app`.

## Service Endpoints

### Base URL
```
https://tnh-langchain.vercel.app
```

### Available Endpoints

| Endpoint | Method | Purpose | Max Duration |
|----------|--------|---------|--------------|
| `/api/chat` | POST | Regular chat with AI | 60s |
| `/api/chat-stream` | POST | Streaming chat with AI | 60s |
| `/api/health` | GET | Health check | 10s |
| `/api/reindex` | POST | Reindex vector store (Phase 2) | 300s |

## Authentication

All endpoints require authentication using a Bearer token:

```php
$headers = [
  'Authorization' => 'Bearer tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8',
  'Content-Type' => 'application/json',
];
```

## Request Format

### Chat Endpoints (`/api/chat`, `/api/chat-stream`)

```json
{
  "message": "User's question or message",
  "conversation_history": [
    {
      "role": "human",
      "content": "Previous user message"
    },
    {
      "role": "assistant", 
      "content": "Previous AI response"
    }
  ],
  "database_context": "Optional: Pre-filtered content from Drupal",
  "ai_settings": {
    "provider": "openai|ollama",
    "model": "gpt-4o-mini|llama3"
  }
}
```

### Response Format (Regular Chat)

```json
{
  "message": "AI response text",
  "context": {
    "relevant_articles": [
      {
        "id": "node_id",
        "url": "/node/123",
        "label": "Article Title"
      }
    ]
  },
  "meta": {
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```

### Response Format (Streaming Chat)

The streaming endpoint returns plain text chunks that should be concatenated to form the complete response.

## Integration Patterns

### 1. Basic Chat Integration

```php
/**
 * Send a chat request to the LangChain service
 */
function tnh_ai_chat_request($message, $conversation_history = [], $database_context = '') {
  $url = 'https://tnh-langchain.vercel.app/api/chat';
  
  $data = [
    'message' => $message,
    'conversation_history' => $conversation_history,
    'database_context' => $database_context,
    'ai_settings' => [
      'provider' => 'openai',
      'model' => 'gpt-4o-mini'
    ]
  ];
  
  $response = \Drupal::httpClient()->post($url, [
    'headers' => [
      'Authorization' => 'Bearer tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8',
      'Content-Type' => 'application/json',
    ],
    'json' => $data,
    'timeout' => 60,
  ]);
  
  return json_decode($response->getBody(), TRUE);
}
```

### 2. Streaming Chat Integration

```php
/**
 * Send a streaming chat request to the LangChain service
 */
function tnh_ai_chat_stream_request($message, $conversation_history = [], $database_context = '') {
  $url = 'https://tnh-langchain.vercel.app/api/chat-stream';
  
  $data = [
    'message' => $message,
    'conversation_history' => $conversation_history,
    'database_context' => $database_context,
    'ai_settings' => [
      'provider' => 'openai',
      'model' => 'gpt-4o-mini'
    ]
  ];
  
  $response = \Drupal::httpClient()->post($url, [
    'headers' => [
      'Authorization' => 'Bearer tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8',
      'Content-Type' => 'application/json',
    ],
    'json' => $data,
    'timeout' => 60,
    'stream' => TRUE,
  ]);
  
  return $response;
}
```

### 3. JavaScript Frontend Integration

```javascript
// Regular chat
async function sendChatMessage(message, conversationHistory = [], databaseContext = '') {
  const response = await fetch('https://tnh-langchain.vercel.app/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8'
    },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
      database_context: databaseContext,
      ai_settings: {
        provider: 'openai',
        model: 'gpt-4o-mini'
      }
    })
  });
  
  return await response.json();
}

// Streaming chat
async function sendStreamingChatMessage(message, conversationHistory = [], databaseContext = '', onChunk) {
  const response = await fetch('https://tnh-langchain.vercel.app/api/chat-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8'
    },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
      database_context: databaseContext,
      ai_settings: {
        provider: 'openai',
        model: 'gpt-4o-mini'
      }
    })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    onChunk(chunk);
  }
}
```

## Database Context Strategy

### Option 1: Pre-filtered Content (Recommended)

Send relevant content directly from Drupal to avoid vector store lookups:

```php
/**
 * Get relevant content for AI context
 */
function tnh_ai_get_database_context($query, $limit = 10) {
  // Search Drupal content based on query
  $query = \Drupal::entityQuery('node')
    ->condition('type', 'article')
    ->condition('status', 1)
    ->condition('title', $query, 'CONTAINS')
    ->range(0, $limit)
    ->execute();
  
  $nodes = \Drupal::entityTypeManager()
    ->getStorage('node')
    ->loadMultiple($query);
  
  $context = '';
  foreach ($nodes as $node) {
    $context .= "Title: " . $node->getTitle() . "\n";
    $context .= "Link: " . $node->toUrl()->toString() . "\n";
    $context .= "Author: " . $node->get('field_author')->value . "\n";
    $context .= "Content: " . $node->get('body')->value . "\n\n";
  }
  
  return $context;
}
```

### Option 2: Vector Store Lookup

Let the LangChain service handle content retrieval (requires populated vector store):

```php
// Send empty database_context to trigger vector store lookup
$data['database_context'] = '';
```

## Error Handling

```php
try {
  $result = tnh_ai_chat_request($message, $history, $context);
  
  if (isset($result['error'])) {
    \Drupal::logger('tnh_ai')->error('LangChain API error: @error', ['@error' => $result['error']]);
    return ['error' => 'AI service temporarily unavailable'];
  }
  
  return $result;
} catch (\Exception $e) {
  \Drupal::logger('tnh_ai')->error('LangChain request failed: @error', ['@error' => $e->getMessage()]);
  return ['error' => 'AI service temporarily unavailable'];
}
```

## Health Check

```php
/**
 * Check if the LangChain service is available
 */
function tnh_ai_health_check() {
  try {
    $response = \Drupal::httpClient()->get('https://tnh-langchain.vercel.app/api/health', [
      'timeout' => 10,
    ]);
    
    $data = json_decode($response->getBody(), TRUE);
    return $data['ok'] ?? FALSE;
  } catch (\Exception $e) {
    return FALSE;
  }
}
```

## Configuration

### Environment Variables

Add these to your Drupal settings:

```php
// In settings.php or settings.local.php
$config['tnh_ai.settings'] = [
  'base_url' => 'https://tnh-langchain.vercel.app',
  'api_key' => 'tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8',
  'default_provider' => 'openai',
  'default_model' => 'gpt-4o-mini',
  'timeout' => 60,
];
```

### Module Configuration

Create a configuration form in your custom module:

```php
/**
 * Implements hook_form_FORM_ID_alter().
 */
function tnh_ai_form_tnh_ai_settings_form_alter(&$form, \Drupal\Core\Form\FormStateInterface $form_state, $form_id) {
  $form['api_settings'] = [
    '#type' => 'fieldset',
    '#title' => t('API Settings'),
  ];
  
  $form['api_settings']['base_url'] = [
    '#type' => 'url',
    '#title' => t('LangChain Service URL'),
    '#default_value' => 'https://tnh-langchain.vercel.app',
    '#required' => TRUE,
  ];
  
  $form['api_settings']['api_key'] = [
    '#type' => 'textfield',
    '#title' => t('API Key'),
    '#default_value' => 'tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8',
    '#required' => TRUE,
  ];
}
```

## Best Practices

### 1. Conversation Management

- Store conversation history in session or database
- Limit history length to prevent token limits
- Include user context and preferences

### 2. Content Filtering

- Pre-filter relevant content from Drupal
- Use database_context for better accuracy
- Implement content access controls

### 3. Performance

- Use streaming for better UX
- Implement caching for repeated queries
- Set appropriate timeouts

### 4. Security

- Validate all user input
- Sanitize content before sending to AI
- Implement rate limiting

### 5. Monitoring

- Log all AI interactions
- Monitor response times
- Track usage patterns

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check API key
2. **Timeout**: Increase timeout or use streaming
3. **Empty responses**: Check database_context or vector store
4. **CORS errors**: Ensure proper headers

### Debug Mode

Enable debug logging:

```php
\Drupal::logger('tnh_ai')->debug('Request: @request', ['@request' => json_encode($data)]);
\Drupal::logger('tnh_ai')->debug('Response: @response', ['@response' => json_encode($result)]);
```

## Migration from Local Development

If migrating from local development:

1. Update base URL from `http://localhost:8787` to `https://tnh-langchain.vercel.app`
2. Ensure all endpoints use `/api/` prefix
3. Test authentication with production API key
4. Verify health check endpoint

## Support

For issues with the LangChain service:
- Check service health: `https://tnh-langchain.vercel.app/api/health`
- Review logs in Vercel dashboard
- Contact development team

---

**Last Updated**: January 2025  
**Service Version**: 1.0  
**Drupal Compatibility**: 9.x, 10.x
