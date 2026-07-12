import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInjectedSystemPrompt } from './modelTestingAgent.ts';

test('buildInjectedSystemPrompt preserves the live workflow prompt without adding test-only policy', () => {
  const prompt = buildInjectedSystemPrompt('LIVE WORKFLOW PROMPT');

  assert.ok(prompt.startsWith('LIVE WORKFLOW PROMPT\n\n# ACTIONS — STRICT JSON OUTPUT'));
  assert.ok(prompt.includes('## ABSOLUTE RULES'));
  assert.ok(prompt.includes('The "action" field MUST be exactly one of:'));
  assert.ok(prompt.includes('- Tool "findResellers": To find BAYROL resellers. Use this tool and not searchKnowledge if you have to find resellers'));
  assert.ok(prompt.includes('You MUST use this tool at every turn, do NOT take anything for granted'));
  assert.equal(prompt.includes('# IDENTITY'), false);
  assert.equal(prompt.includes('# CRITICAL RULES'), false);
  assert.equal(prompt.includes('# STANDARD OPERATING PROCEDURE'), false);
});
