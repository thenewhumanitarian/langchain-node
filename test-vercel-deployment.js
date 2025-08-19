#!/usr/bin/env node

/**
 * Test script to verify Vercel deployment
 * Run with: node test-vercel-deployment.js
 */

const BASE_URL = 'https://tnh-langchain.vercel.app';
const API_KEY = 'tnh-langchain-714f5abd7fef62c92e1c166e8b6e36e8';

async function testEndpoint(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    console.log(`\n🔍 Testing ${method} ${endpoint}...`);
    const response = await fetch(url, options);
    const text = await response.text();
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
    
    // Try to parse as JSON, fallback to text
    let data;
    try {
      data = JSON.parse(text);
      console.log('Response (JSON):', JSON.stringify(data, null, 2));
    } catch {
      console.log('Response (Text):', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
    }
    
    return { success: response.ok, status: response.status, data: text };
  } catch (error) {
    console.error(`❌ Error testing ${endpoint}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Testing Vercel Deployment');
  console.log('============================');
  
  // Test 1: Root URL (should serve landing page)
  await testEndpoint('/');
  
  // Test 2: Health endpoint
  await testEndpoint('/api/health');
  
  // Test 3: Chat endpoint
  await testEndpoint('/api/chat', 'POST', {
    message: 'Hello, this is a test',
    conversation_history: []
  });
  
  // Test 4: Streaming endpoint
  await testEndpoint('/api/chat-stream', 'POST', {
    message: 'Hello, this is a streaming test',
    conversation_history: []
  });
  
  // Test 5: Reindex endpoint
  await testEndpoint('/api/reindex', 'POST', {});
  
  console.log('\n✅ Testing complete!');
}

// Run tests
runTests().catch(console.error);
