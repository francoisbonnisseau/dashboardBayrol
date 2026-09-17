import assert from 'node:assert/strict';
import test from 'node:test';
import {
  serializeMessageForExport,
  serializeMessagesForExport,
} from './messagePayload.ts';

test('exports readable and structured message payloads without repeating the raw payload', () => {
  const payload = {
    type: 'custom',
    data: {
      type: 'step_list',
      title: 'Procedure',
      steps: [{ title: 'Step 1', text: 'Do this' }],
    },
  };

  const exported = serializeMessageForExport({
    id: 'message-1',
    createdAt: '2026-09-17T13:00:00.000Z',
    direction: 'outgoing',
    type: 'custom',
    payload,
  });

  assert.equal(exported.role, 'bot');
  assert.equal(exported.type, 'step_list');
  assert.deepEqual(exported.content, {
    kind: 'step_list',
    title: 'Procedure',
    steps: [{ title: 'Step 1', text: 'Do this' }],
  });
});

test('exports messages oldest first like the conversation detail view', () => {
  const messages = [
    {
      id: 'newest',
      createdAt: '2026-09-17T13:01:00.000Z',
      direction: 'outgoing' as const,
      payload: { type: 'text', text: 'Answer' },
    },
    {
      id: 'oldest',
      createdAt: '2026-09-17T13:00:00.000Z',
      direction: 'incoming' as const,
      payload: { type: 'text', text: 'Question' },
    },
  ];

  assert.deepEqual(
    serializeMessagesForExport(messages).map((message) => message.id),
    ['oldest', 'newest'],
  );
});

test('extracts readable text from composite bloc payloads', () => {
  const exported = serializeMessageForExport({
    id: 'bloc-1',
    createdAt: '2026-09-17T13:00:00.000Z',
    direction: 'incoming',
    type: 'bloc',
    payload: {
      type: 'bloc',
      items: [
        { type: 'text', payload: { text: 'Première partie' } },
        { type: 'text', payload: { text: 'Deuxième partie' } },
      ],
    },
  });

  assert.equal(exported.role, 'user');
  assert.equal(exported.type, 'bloc');
  assert.equal(exported.content, 'Première partie\n\nDeuxième partie');
});

test('keeps choice options without repeating the raw payload', () => {
  const exported = serializeMessageForExport({
    id: 'choice-1',
    createdAt: '2026-09-17T13:00:00.000Z',
    direction: 'outgoing',
    type: 'choice',
    payload: {
      type: 'choice',
      text: 'Choisissez une option',
      options: [{ label: 'Oui', value: 'yes' }],
    },
  });

  assert.deepEqual(exported.content, {
    text: 'Choisissez une option',
    options: [{ label: 'Oui', value: 'yes' }],
  });
});

test('removes duplicate message ids from paginated results', () => {
  const message = {
    id: 'duplicate',
    createdAt: '2026-09-17T13:00:00.000Z',
    direction: 'incoming' as const,
    payload: { type: 'text', text: 'Question' },
  };

  assert.deepEqual(
    serializeMessagesForExport([message, message]).map((item) => item.id),
    ['duplicate'],
  );
});
