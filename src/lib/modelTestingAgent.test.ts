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
  assert.match(prompt, /"tool_name": "searchKnowledge"/);
  assert.match(prompt, /"tool_args": \{ "query": "Chlorifix" \}/);
  assert.equal(prompt.includes('"thought"'), false);
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

async function withSequencedFetchMock<T>(
  decisions: unknown[],
  callback: (state: {
    cognitiveRequests: Array<Record<string, unknown>>;
    actionRequests: Array<Record<string, unknown>>;
    requestUrls: string[];
  }) => Promise<T>,
  runtimeOutputs: Record<string, unknown> = {}
) {
  const previousFetch = globalThis.fetch;
  const cognitiveRequests: Array<Record<string, unknown>> = [];
  const actionRequests: Array<Record<string, unknown>> = [];
  const requestUrls: string[] = [];
  let decisionIndex = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requestUrls.push(url);

    if (url.includes('/v2/cognitive/generate-text')) {
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      cognitiveRequests.push(body);
      const nextDecision = decisions[Math.min(decisionIndex, decisions.length - 1)];
      decisionIndex += 1;
      const content = typeof nextDecision === 'string' ? nextDecision : JSON.stringify(nextDecision);
      return jsonResponse({ choices: [{ content }], usage: {} });
    }

    if (url.includes('/v1/chat/actions')) {
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      actionRequests.push(body);
      return jsonResponse({ output: runtimeOutputs[String(body.type)] ?? { answer: 'runtime result' } });
    }

    return jsonResponse({ error: 'Unexpected test URL' }, 404);
  }) as typeof fetch;

  try {
    return await callback({ cognitiveRequests, actionRequests, requestUrls });
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

test('uses the prefetched query when the model omits searchKnowledge arguments', async () => {
  await withSequencedFetchMock(
    [
      { action: 'call_tool', tool_name: 'searchKnowledge', tool_args: {} },
      { action: 'reply_to_user', response_text: 'Réponse basée sur la connaissance.' },
    ],
    async () => {
      const result = await runSingleModelTestingTurn(buildSingleTurnParams('chlorifix'));
      const searchStep = result.turns[0]?.modelA.steps?.find((step) => step.toolName === 'searchKnowledge');

      assert.ok(searchStep);
      assert.equal(searchStep.status, 'completed');
      assert.equal(searchStep.toolSource, 'prefetched');
      assert.match(String(searchStep.toolInput?.query), /chlorifix/);
    },
    { searchKnowledge: { answer: 'knowledge' } }
  );
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

test('renders ordered response parts and resolves only documents returned by searchKnowledge', async () => {
  const searchOutput = {
    answer: JSON.stringify([{ title: 'guide.pdf', content: '# Guide' }]),
  };
  const params = {
    ...buildSingleTurnParams('Comment entretenir ma piscine ?'),
    resolveDocuments: async (docNames: string[]) =>
      docNames.map((docName) => ({ docName, title: 'Guide', url: 'https://example.com/guide.pdf' })),
  };

  await withSequencedFetchMock(
    [
      { action: 'call_tool', tool_name: 'searchKnowledge', tool_args: { query: 'entretien piscine' } },
      {
        action: 'reply_to_user',
        response_parts: [
          { type: 'text', text: 'Voici la procédure.' },
          { type: 'step_list', steps: [{ title: 'Filtrer', text: 'Lancez la filtration.' }] },
        ],
        documents_to_display: ['guide.pdf', 'missing.pdf'],
      },
    ],
    async ({ cognitiveRequests }) => {
      const result = await runSingleModelTestingTurn(params);
      const response = result.turns[0]?.modelA;

      assert.ok(response);
      assert.equal(cognitiveRequests[0]?.model, 'openai:test-cheap-model');
      assert.equal(cognitiveRequests[1]?.model, 'openai:test-model');
      assert.equal(cognitiveRequests[0]?.temperature, 0.2);
      assert.equal(cognitiveRequests[1]?.temperature, 0.3);
      assert.deepEqual(response.responseParts?.map((part) => part.type), ['text', 'step_list', 'sources']);
      assert.equal(response.steps?.filter((step) => step.kind === 'message').length, 3);
      assert.deepEqual(response.responseParts?.[2], {
        type: 'sources',
        title: 'Pour aller plus loin :',
        items: [{ docName: 'guide.pdf', title: 'Guide', url: 'https://example.com/guide.pdf' }],
      });
    },
    { searchKnowledge: searchOutput }
  );
});

test('simulates sendEmail without calling the Botpress runtime action', async () => {
  await withSequencedFetchMock(
    [
      {
        action: 'call_tool',
        tool_name: 'sendEmail',
        tool_args: {
          email: 'user@example.com',
          name: 'Jean',
          surname: 'Dupont',
          problem: 'Problème non résolu',
        },
      },
      { action: 'reply_to_user', response_text: 'Votre demande a été préparée.' },
    ],
    async ({ actionRequests, cognitiveRequests, requestUrls }) => {
      const result = await runSingleModelTestingTurn(buildSingleTurnParams('Envoyez un email au support.'));
      const toolStep = result.turns[0]?.modelA.steps?.find((step) => step.toolName === 'sendEmail');

      assert.ok(toolStep);
      assert.equal(toolStep.toolSource, 'simulated');
      assert.deepEqual(toolStep.toolOutput, {
        success: false,
        simulated: true,
        message: 'Simulation only: no email was sent.',
      });
      assert.equal(actionRequests.some((request) => request.type === 'sendEmail'), false);
      assert.equal(requestUrls.some((url) => url.includes('/messages')), false);
      assert.match(JSON.stringify(cognitiveRequests[1]?.messages), /no email was sent/);
      assert.equal(result.singleHistory[result.singleHistory.length - 1]?.content.includes('no email was sent'), false);
    },
    { searchKnowledge: { answer: 'none' } }
  );
});

test('executes webSearch directly and keeps outbound communication local', async () => {
  await withSequencedFetchMock(
    [
      { action: 'call_tool', tool_name: 'webSearch', tool_args: { query: 'bayrol piscine', count: 1 } },
      { action: 'reply_to_user', response_text: 'Résultat web.' },
    ],
    async ({ actionRequests }) => {
      const result = await runSingleModelTestingTurn(buildSingleTurnParams('Oui, faites une recherche web.'));
      const webSearch = actionRequests.find((request) => request.type === 'webSearch');

      assert.deepEqual(webSearch?.input, { query: 'bayrol piscine', count: 1 });
      assert.equal(actionRequests.some((request) => request.type === 'sendEmail'), false);
      assert.equal(result.turns[0]?.modelA.text, 'Résultat web.');
    },
    { searchKnowledge: { answer: 'none' }, webSearch: { results: [] } }
  );
});

test('analyzes an uploaded image before searching with the extracted context', async () => {
  await withSequencedFetchMock(
    [
      { action: 'call_tool', tool_name: 'analyzeDocument', tool_args: { documentUrl: 'https://example.com/photo.jpg' } },
      { action: 'call_tool', tool_name: 'searchKnowledge', tool_args: { query: 'Bayrol pH Minus erreur E12' } },
      { action: 'reply_to_user', response_text: 'Voici la réponse.' },
    ],
    async ({ actionRequests }) => {
      await runSingleModelTestingTurn(buildSingleTurnParams('Analyse cette image https://example.com/photo.jpg'));
      const searchRequest = actionRequests.find((request) => request.type === 'searchKnowledge');
      assert.match(String((searchRequest?.input as Record<string, unknown>)?.query), /erreur E12/);
    },
    {
      analyzeDocument: { success: true, content: 'Bayrol pH Minus erreur E12', documentType: 'image', error: null },
      searchKnowledge: { answer: 'knowledge' },
    }
  );
});

test('recovers from malformed JSON by continuing the bounded agent loop', async () => {
  await withSequencedFetchMock(
    [
      'not-json',
      { action: 'call_tool', tool_name: 'searchKnowledge', tool_args: { query: 'eau trouble' } },
      { action: 'reply_to_user', response_text: 'Réponse corrigée.' },
    ],
    async ({ cognitiveRequests }) => {
      const result = await runSingleModelTestingTurn(buildSingleTurnParams('Comment traiter une eau trouble ?'));

      assert.equal(cognitiveRequests.length, 3);
      assert.match(JSON.stringify(cognitiveRequests[1]?.messages), /malformed/);
      assert.equal(result.turns[0]?.modelA.text, 'Réponse corrigée.');
    },
    { searchKnowledge: { answer: 'knowledge' } }
  );
});
