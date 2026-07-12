import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInjectedSystemPrompt,
  runCompareModelTestingTurn,
  runSingleModelTestingTurn,
} from './modelTestingAgent.ts';

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function withModelTestingFetchMock<T>(runtimeOutput: unknown, callback: () => Promise<T>, agentCount = 1) {
  const previousFetch = globalThis.fetch;
  let decisionCount = 0;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes('/v2/cognitive/generate-text')) {
      decisionCount += 1;
      const decision =
        decisionCount <= agentCount
          ? {
              action: 'call_tool',
              tool_name: 'searchKnowledge',
              tool_args: { query: 'model query' },
            }
          : {
              action: 'reply_to_user',
              response_text: 'Final answer',
            };

      return jsonResponse({ choices: [{ content: JSON.stringify(decision) }], usage: {} });
    }

    if (url.includes('/v1/chat/actions')) {
      return jsonResponse({ output: runtimeOutput });
    }

    return jsonResponse({ error: 'Unexpected test URL' }, 404);
  }) as typeof fetch;

  try {
    return await callback();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function buildSingleTurnParams(message: string) {
  return {
    token: 'test-token',
    botId: 'test-bot',
    modelId: 'openai:test-model',
    cheapModelId: 'openai:test-cheap-model',
    cheapTemperature: 0.2,
    cheapReasoningEffort: 'high' as const,
    rawSystemPrompt: 'Test prompt',
    message,
    turns: [],
    singleHistory: [],
    temperature: 0.3,
    maxTokens: 1200,
    reasoningEffort: 'medium' as const,
  };
}

function buildCompareTurnParams(message: string) {
  return {
    token: 'test-token',
    botId: 'test-bot',
    modelAId: 'openai:test-model-a',
    modelBId: 'anthropic:test-model-b',
    cheapModelId: 'openai:test-cheap-model',
    cheapTemperature: 0.2,
    cheapReasoningEffort: 'high' as const,
    rawSystemPrompt: 'Test prompt',
    message,
    turns: [],
    compareHistory: { modelA: [], modelB: [] },
    temperature: 0.3,
    maxTokens: 1200,
    reasoningEffort: 'medium' as const,
  };
}

test('captures the prefetched searchKnowledge input, output, duration, and source', async () => {
  const runtimeOutput = { answer: 'Knowledge result', passages: [{ title: 'Guide' }] };

  await withModelTestingFetchMock(runtimeOutput, async () => {
    const result = await runSingleModelTestingTurn(
      buildSingleTurnParams('Quel produit utiliser pour une eau trouble ?')
    );
    const toolStep = result.turns[0]?.modelA.steps?.find((step) => step.kind === 'tool_call');

    assert.ok(toolStep);
    assert.equal(toolStep.toolName, 'searchKnowledge');
    assert.equal(toolStep.toolSource, 'prefetched');
    assert.match(String(toolStep.toolInput?.query), /eau trouble/);
    assert.deepEqual(toolStep.toolOutput, runtimeOutput);
    assert.equal(typeof toolStep.toolDurationMs, 'number');
    assert.equal(toolStep.status, 'completed');
  });
});

test('captures a direct searchKnowledge call when prefetching is disabled', async () => {
  const runtimeOutput = { answer: 'Direct knowledge result' };

  await withModelTestingFetchMock(runtimeOutput, async () => {
    const result = await runSingleModelTestingTurn(
      buildSingleTurnParams('Analyse cette image https://example.com/photo.jpg')
    );
    const toolStep = result.turns[0]?.modelA.steps?.find((step) => step.kind === 'tool_call');

    assert.ok(toolStep);
    assert.equal(toolStep.toolName, 'searchKnowledge');
    assert.equal(toolStep.toolSource, 'direct');
    assert.deepEqual(toolStep.toolInput, { query: 'model query' });
    assert.deepEqual(toolStep.toolOutput, runtimeOutput);
    assert.equal(typeof toolStep.toolDurationMs, 'number');
    assert.equal(toolStep.status, 'completed');
  });
});

test('keeps tool traces independent for both models in comparison mode', async () => {
  const runtimeOutput = { answer: 'Comparison knowledge result' };

  await withModelTestingFetchMock(
    runtimeOutput,
    async () => {
      const result = await runCompareModelTestingTurn(
        buildCompareTurnParams('Quelle est la durée de conservation du produit ?')
      );
      const responseA = result.turns[0]?.modelA;
      const responseB = result.turns[0]?.modelB;
      const toolStepA = responseA?.steps?.find((step) => step.kind === 'tool_call');
      const toolStepB = responseB?.steps?.find((step) => step.kind === 'tool_call');

      assert.ok(toolStepA);
      assert.ok(toolStepB);
      assert.notEqual(toolStepA.id, toolStepB.id);
      assert.deepEqual(toolStepA.toolOutput, runtimeOutput);
      assert.deepEqual(toolStepB.toolOutput, runtimeOutput);
      assert.equal(toolStepA.toolSource, 'prefetched');
      assert.equal(toolStepB.toolSource, 'prefetched');
    },
    2
  );
});
