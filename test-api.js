#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:8787';

const API_KEY = process.env.SERVICE_API_KEY || 'test-key';

async function testHealth() {
  console.log('🔍 Testing health endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    console.log('✅ Health check passed:', data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testChat() {
  console.log('💬 Testing chat endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        message: 'Hello, can you tell me about The New Humanitarian?',
        conversation_history: [],
        ai_settings: {
          provider: process.env.PROVIDER || 'ollama',
          model: process.env.OLLAMA_MODEL || 'llama3'
        }
      }),
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log('✅ Chat test passed');
      console.log('Response:', data.message.substring(0, 100) + '...');
      return true;
    } else {
      console.error('❌ Chat test failed:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Chat test failed:', error.message);
    return false;
  }
}

async function testReindex() {
  console.log('🔄 Testing reindex endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/reindex`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log('✅ Reindex test passed:', data);
      return true;
    } else {
      console.error('❌ Reindex test failed:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Reindex test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log(`🚀 Testing TNH LangChain Service at ${BASE_URL}`);
  console.log(`🔑 Using API key: ${API_KEY.substring(0, 8)}...`);
  console.log('');

  const results = await Promise.all([
    testHealth(),
    testChat(),
    testReindex(),
  ]);

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log('');
  console.log(`📊 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Your service is ready.');
  } else {
    console.log('⚠️  Some tests failed. Check your configuration.');
    process.exit(1);
  }
}

runTests().catch(console.error);
