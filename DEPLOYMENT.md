# Vercel Deployment Guide

This guide will walk you through deploying the TNH LangChain Service to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally with `npm i -g vercel`
3. **Git Repository**: Your code should be in a Git repository

## Step 1: Prepare Your Environment

1. **Navigate to the service directory:**
   ```bash
   cd services/tnh-langchain-service
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp env.sample .env
   ```

4. **Configure your environment variables in `.env`:**
   ```bash
   # Required
   SERVICE_API_KEY=your-secure-api-key-here
   
   # AI Provider (choose one)
   PROVIDER=openai  # or 'ollama'
   
   # OpenAI Configuration
   OPENAI_API_KEY=sk-your-openai-key
   OPENAI_MODEL=gpt-4o-mini
   OPENAI_EMBED_MODEL=text-embedding-3-small
   
   # OR Ollama Configuration (for local development)
   OLLAMA_HOST=http://localhost:11434
   OLLAMA_MODEL=llama3
   OLLAMA_EMBED_MODEL=nomic-embed-text
   
   # Vector Store (choose one)
   # Option 1: Supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_TABLE=documents
   
   # Option 2: PostgreSQL (pgvector)
   POSTGRES_URL=postgres://user:pass@host:port/db
   PGVECTOR_TABLE=langchain
   ```

## Step 2: Test Locally

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Test the API endpoints:**
   ```bash
   npm test
   ```

3. **Verify all tests pass before deploying**

## Step 3: Deploy to Vercel

1. **Login to Vercel:**
   ```bash
   vercel login
   ```

2. **Deploy the project:**
   ```bash
   vercel
   ```

3. **Follow the prompts:**
   - Link to existing project? `N` (for first deployment)
   - Project name: `tnh-langchain-service` (or your preferred name)
   - Directory: `./` (current directory)
   - Override settings? `N`

4. **Set environment variables in Vercel:**
   ```bash
   vercel env add SERVICE_API_KEY
   vercel env add PROVIDER
   vercel env add OPENAI_API_KEY
   # Add all other environment variables from your .env file
   ```

## Step 4: Configure Production Environment

1. **Go to Vercel Dashboard:**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Select your project

2. **Add Environment Variables:**
   - Go to Settings → Environment Variables
   - Add each variable from your `.env` file
   - Set the environment to "Production"

3. **Configure Domains (Optional):**
   - Go to Settings → Domains
   - Add a custom domain if needed

## Step 5: Test Production Deployment

1. **Get your deployment URL:**
   ```bash
   vercel ls
   ```

2. **Test the production API:**
   ```bash
   # Set the VERCEL_URL environment variable
   export VERCEL_URL=your-app.vercel.app
   npm test
   ```

3. **Test with curl:**
   ```bash
   curl -X POST https://your-app.vercel.app/api/chat \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-api-key" \
     -d '{"message": "Hello", "conversation_history": []}'
   ```

## Step 6: Configure Drupal Integration

1. **Update your Drupal configuration:**
   ```php
   // In your Drupal AI module settings
   $config = [
     'tnh_langchain_url' => 'https://your-app.vercel.app/api/chat',
     'tnh_langchain_api_key' => 'your-service-api-key',
   ];
   ```

2. **Test the integration from Drupal**

## Troubleshooting

### Common Issues

1. **Function Timeout:**
   - Increase timeout in `vercel.json`
   - Optimize your LangChain queries

2. **Environment Variables:**
   - Ensure all variables are set in Vercel dashboard
   - Check for typos in variable names

3. **CORS Issues:**
   - CORS is enabled by default
   - Check your Drupal domain is allowed

4. **Authentication Errors:**
   - Verify `SERVICE_API_KEY` is set correctly
   - Check the Authorization header format

### Debugging

1. **View Vercel logs:**
   ```bash
   vercel logs
   ```

2. **Check function logs in Vercel dashboard**

3. **Test individual endpoints:**
   ```bash
   curl https://your-app.vercel.app/api/health
   ```

## Production Considerations

1. **Security:**
   - Use strong API keys
   - Enable HTTPS (automatic with Vercel)
   - Consider rate limiting

2. **Performance:**
   - Monitor function execution times
   - Optimize vector search queries
   - Consider caching strategies

3. **Monitoring:**
   - Set up Vercel Analytics
   - Monitor error rates
   - Track API usage

## Updating the Deployment

1. **Make your changes locally**

2. **Test locally:**
   ```bash
   npm test
   ```

3. **Deploy updates:**
   ```bash
   vercel --prod
   ```

4. **Verify the update:**
   ```bash
   npm test
   ```

## Rollback

If you need to rollback:

1. **Go to Vercel Dashboard**
2. **Navigate to Deployments**
3. **Select a previous deployment**
4. **Click "Promote to Production"**

## Support

- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **LangChain Documentation**: [langchain.com/docs](https://langchain.com/docs)
- **TNH Development Team**: For Drupal integration questions
