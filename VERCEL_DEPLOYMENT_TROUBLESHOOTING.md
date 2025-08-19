# Vercel Deployment Troubleshooting Guide

## Current Issues

### 1. Source Code Being Served Instead of Executed
**Problem**: Vercel is serving the JavaScript source code instead of executing the serverless functions.

**Symptoms**:
- `GET /api/health` returns the function source code
- `POST /api/chat` returns 405 Method Not Allowed
- Root URL returns "NOT_FOUND"

**Root Cause**: Vercel is not properly recognizing the serverless functions.

## Solutions

### Solution 1: Fix Vercel Configuration

The current `vercel.json` is too minimal. Let's use a more explicit configuration:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/public/$1"
    }
  ],
  "functions": {
    "api/chat.js": {
      "maxDuration": 60
    },
    "api/chat-stream.js": {
      "maxDuration": 60
    },
    "api/reindex.js": {
      "maxDuration": 300
    },
    "api/health.js": {
      "maxDuration": 10
    }
  }
}
```

### Solution 2: Check Package.json Configuration

Ensure `package.json` has the correct configuration:

```json
{
  "type": "module",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Solution 3: Verify Function Structure

Each API function should:
1. Use ES modules (`import`/`export`)
2. Export a default async function named `handler`
3. Accept `req` and `res` parameters

### Solution 4: Environment Variables

Ensure all required environment variables are set in Vercel:
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SERVICE_API_KEY`

## Testing Steps

### 1. Local Testing
```bash
# Test local server
npm run dev
curl http://localhost:8787/api/health
```

### 2. Vercel Testing
```bash
# Test Vercel deployment
curl https://tnh-langchain.vercel.app/api/health
curl -X POST https://tnh-langchain.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8" \
  -d '{"message": "Hello", "conversation_history": []}'
```

### 3. Expected Responses

**Health Check**:
```json
{
  "ok": true,
  "provider": "openai",
  "port": 8787,
  "default_model": "llama3",
  "default_embed_model": "nomic-embed-text",
  "environment": "production",
  "timestamp": "2025-01-19T..."
}
```

**Chat Response**:
```json
{
  "message": "Hello! How can I assist you today?",
  "context": {
    "relevant_articles": []
  },
  "meta": {
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```

## Deployment Commands

### 1. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 2. Set Environment Variables
```bash
vercel env add OPENAI_API_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add SERVICE_API_KEY
```

### 3. Redeploy After Changes
```bash
vercel --prod
```

## Common Issues and Fixes

### Issue 1: Module Import Errors
**Fix**: Ensure all dependencies are in `package.json` and use ES module syntax.

### Issue 2: Environment Variables Not Available
**Fix**: Set environment variables in Vercel dashboard or via CLI.

### Issue 3: Function Timeout
**Fix**: Increase `maxDuration` in `vercel.json`.

### Issue 4: CORS Errors
**Fix**: Ensure CORS headers are set in all functions.

## Next Steps

1. Update `vercel.json` with the corrected configuration
2. Verify `package.json` has `"type": "module"`
3. Set all environment variables in Vercel
4. Redeploy the service
5. Test all endpoints
6. Update Drupal integration to use the working endpoints

## Support

If issues persist:
1. Check Vercel deployment logs
2. Verify function syntax
3. Test locally first
4. Contact development team
