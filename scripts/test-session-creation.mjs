#!/usr/bin/env node

/**
 * Test script to reproduce the session creation UUID error
 */

import { createSession } from '../src/lib/chat/sessions.ts';

async function testSessionCreation() {
  console.log('Testing session creation...\n');

  try {
    // Test with a sample persona ID (should be UUID format in real scenario)
    const testPersonaId = 'test-persona-123';
    
    console.log(`Attempting to create session with personaId: ${testPersonaId}`);
    const session = await createSession(testPersonaId);
    
    console.log('✅ Session created successfully:');
    console.log(JSON.stringify(session, null, 2));
  } catch (error) {
    console.error('❌ Session creation failed:');
    console.error(error.message);
    console.error('\nFull error:', error);
  }
}

testSessionCreation();
