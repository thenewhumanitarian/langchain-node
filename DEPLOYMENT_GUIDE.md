# Vercel Deployment Guide - Fix for 405 Errors

## Problem Summary
Your Vercel deployment is currently serving JavaScript source code instead of executing the serverless functions, resulting in 405 Method Not Allowed errors.

## Root Cause
Vercel was not properly recognizing the ES modules format. We've converted the functions to CommonJS format to resolve this.

## Changes Made

### 1. Package.json
- Removed `"type": "module"` to use CommonJS by default

### 2. API Functions
- Converted all `import` statements to `require()`
- Changed `export default` to `module.exports`
- Updated files: `api/health.js`, `api/chat.js`, `api/chat-stream.js`, `api/reindex.js`

### 3. Vercel Configuration
- Simplified `vercel.json` to use minimal configuration
- Kept function timeouts for performance

## Deployment Steps

### Step 1: Commit and Push Changes
```bash
git add .
git commit -m "Fix Vercel deployment: Convert to CommonJS format"
git push origin main
```

### Step 2: Deploy to Vercel
```bash
# If you have Vercel CLI installed
vercel --prod

# Or deploy through GitHub integration
# (Push to main branch will trigger deployment)
```

### Step 3: Set Environment Variables
Make sure these are set in your Vercel project:

```bash
vercel env add OPENAI_API_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add SERVICE_API_KEY
```

### Step 4: Test Deployment
```bash
# Test health endpoint
curl https://tnh-langchain.vercel.app/api/health

# Test chat endpoint
curl -X POST https://tnh-langchain.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8" \
  -d '{"message": "Hello", "conversation_history": []}'

# Test streaming endpoint
curl -X POST https://tnh-langchain.vercel.app/api/chat-stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8" \
  -d '{"message": "Hello", "conversation_history": []}' \
  --no-buffer
```

## Expected Results

### Before Fix:
- `GET /api/health` → Returns JavaScript source code
- `POST /api/chat` → 405 Method Not Allowed
- Root URL → NOT_FOUND

### After Fix:
- `GET /api/health` → Returns JSON with service status
- `POST /api/chat` → Returns AI response
- `POST /api/chat-stream` → Streams AI response
- Root URL → Serves landing page

## Verification Commands

### 1. Health Check
```bash
curl -s https://tnh-langchain.vercel.app/api/health | jq .
```

**Expected Response:**
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

### 2. Chat Test
```bash
curl -X POST https://tnh-langchain.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8" \
  -d '{"message": "Hello", "conversation_history": []}' | jq .
```

**Expected Response:**
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

## Troubleshooting

### If Still Getting 405 Errors:
1. Check Vercel deployment logs
2. Verify environment variables are set
3. Ensure all files are committed and pushed
4. Wait for deployment to complete (can take 2-3 minutes)

### If Functions Still Not Executing:
1. Check Vercel dashboard for build errors
2. Verify function syntax (no ES module imports)
3. Test locally first: `npm run dev`

### Environment Variables Check:
```bash
# Check if variables are set
vercel env ls
```

## Next Steps After Successful Deployment

1. **Update Drupal Integration**: Use the working endpoints
2. **Test All Features**: Health, chat, streaming, reindex
3. **Monitor Performance**: Check response times and errors
4. **Update Documentation**: Share working endpoints with team

## Support

If issues persist:
1. Check Vercel deployment logs
2. Verify all changes are committed
3. Test locally before deploying
4. Contact development team

---

**Last Updated**: January 2025  
**Status**: Ready for deployment  
**Expected Fix**: Convert ES modules to CommonJS
