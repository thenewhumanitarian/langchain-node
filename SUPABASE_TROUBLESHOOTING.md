# Supabase Troubleshooting Guide

## Current Issues

### 1. Vercel Deployment Status
✅ **Fixed**: Vercel deployment is now working
- Health endpoint: `https://tnh-langchain.vercel.app/api/health` ✅
- Chat endpoint: Working but needs environment variables
- File conflicts: Resolved

### 2. Supabase Timeout Issues
❌ **Problem**: Supabase queries are timing out
- Database stats query: 500 Internal Server Error (timeout)
- Vector search: 500 Internal Server Error (timeout)
- Error code: 57014 (statement timeout)

## Root Causes & Solutions

### Issue 1: Missing Environment Variables in Vercel

**Problem**: Chat endpoint returns "Server error" because environment variables aren't set.

**Solution**: Set environment variables in Vercel:

```bash
# Set OpenAI API key
vercel env add OPENAI_API_KEY

# Set Supabase credentials
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Set service API key
vercel env add SERVICE_API_KEY
```

**Verify Environment Variables**:
```bash
vercel env ls
```

### Issue 2: Supabase Query Timeouts

**Problem**: Complex queries are timing out in Supabase.

**Solutions**:

#### A. Optimize Database Queries
```sql
-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created);
CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language);

-- Optimize vector search
CREATE INDEX IF NOT EXISTS idx_content_embedding ON articles USING ivfflat (content_embedding vector_cosine_ops);
```

#### B. Implement Query Timeout Handling
```javascript
// Add timeout to Supabase queries
const { data, error } = await supabase
  .from('articles')
  .select('count')
  .timeout(10000); // 10 second timeout
```

#### C. Use Pagination for Large Queries
```javascript
// Instead of getting all articles, paginate
const { data, error } = await supabase
  .from('articles')
  .select('*')
  .range(0, 99) // Get first 100 articles
  .order('created', { ascending: false });
```

### Issue 3: Vector Store Performance

**Problem**: Vector search operations are slow.

**Solutions**:

#### A. Optimize Vector Index
```sql
-- Recreate vector index with better parameters
DROP INDEX IF EXISTS idx_content_embedding;
CREATE INDEX idx_content_embedding ON articles 
USING ivfflat (content_embedding vector_cosine_ops) 
WITH (lists = 100);
```

#### B. Implement Caching
```javascript
// Cache vector search results
const cacheKey = `vector_search_${query}_${limit}`;
let results = await cache.get(cacheKey);
if (!results) {
  results = await vectorSearch(query, limit);
  await cache.set(cacheKey, results, 300); // 5 minute cache
}
```

## Immediate Actions

### 1. Set Vercel Environment Variables
```bash
# Navigate to your project directory
cd /path/to/tnh-langchain

# Set environment variables
vercel env add OPENAI_API_KEY
# Enter your OpenAI API key when prompted

vercel env add SUPABASE_URL
# Enter: https://ulcyimrzcuzvebeflrng.supabase.co

vercel env add SUPABASE_SERVICE_ROLE_KEY
# Enter your Supabase service role key

vercel env add SERVICE_API_KEY
# Enter: tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8

# Redeploy
vercel --prod
```

### 2. Test Vercel Deployment
```bash
# Test health endpoint
curl https://tnh-langchain.vercel.app/api/health

# Test chat endpoint
curl -X POST https://tnh-langchain.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8" \
  -d '{"message": "Hello", "conversation_history": []}'
```

### 3. Optimize Supabase Queries
```sql
-- Run these in your Supabase SQL editor

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_articles_status_created 
ON articles(status, created DESC);

CREATE INDEX IF NOT EXISTS idx_articles_language_status 
ON articles(language, status);

-- Optimize vector search
CREATE INDEX IF NOT EXISTS idx_content_embedding_optimized 
ON articles USING ivfflat (content_embedding vector_cosine_ops) 
WITH (lists = 100);
```

## Testing Strategy

### 1. Test Vercel Service First
```bash
# Use the test script
npm run test:deployment
```

### 2. Test Drupal Integration
```bash
# Test with a simple query first
ddev exec drush tnh:debug-chatbot "Hello" --verbose

# Then test with complex query
ddev exec drush tnh:debug-chatbot "What are the latest developments in humanitarian aid in Yemen?" --verbose
```

### 3. Monitor Supabase Performance
- Check Supabase dashboard for query performance
- Monitor timeout errors
- Review query execution plans

## Expected Results After Fixes

### Vercel Service:
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

### Drupal Integration:
- ✅ Supabase connection successful
- ✅ Database stats retrieved (non-zero counts)
- ✅ Vector search working
- ✅ AI responses generated

## Troubleshooting Commands

### Check Vercel Environment Variables:
```bash
vercel env ls
```

### Test Supabase Connection:
```bash
curl -X GET "https://ulcyimrzcuzvebeflrng.supabase.co/rest/v1/articles?select=count" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY"
```

### Monitor Vercel Logs:
```bash
vercel logs
```

## Next Steps

1. **Set environment variables** in Vercel
2. **Optimize Supabase queries** with indexes
3. **Test Vercel deployment** with environment variables
4. **Test Drupal integration** with optimized queries
5. **Monitor performance** and adjust as needed

---

**Status**: Vercel deployment fixed, Supabase optimization needed  
**Priority**: Set environment variables first, then optimize Supabase
