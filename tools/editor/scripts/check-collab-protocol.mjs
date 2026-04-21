import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourceUrl = new URL('../src/lib/collab-protocol.ts', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2020,
  },
});
const protocol = await import(`data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`);

const fixture = {
  id: 7,
  label: 'Collab fixture',
  preconditions: [],
  turns: [
    {
      turnNumber: 1,
      openingMessage: 'Old opener',
      choices: [
        {
          index: 1,
          text: 'Old choice',
          reply: 'Old reply',
          outcomes: [],
          preconditions: [],
        },
      ],
      position: { x: 120, y: 90 },
    },
  ],
};

const before = protocol.cloneConversation(fixture);
const setOp = protocol.createConversationSetOp({
  sessionId: 'session-a',
  authorId: 'author-a',
  version: 1,
  path: 'turns/1/openingMessage',
  value: 'New opener',
});
const inverse = protocol.invertCollabOp(before, setOp);
const changed = protocol.applyCollabOpToConversation(fixture, setOp);
assert.equal(changed, true);
assert.equal(fixture.turns[0].openingMessage, 'New opener');
protocol.applyCollabOpToConversation(fixture, inverse);
assert.deepEqual(fixture, before);

const coalesced = protocol.coalesceCollabOps([
  protocol.createConversationSetOp({ sessionId: 'session-a', authorId: 'a', version: 1, path: 'label', value: 'One' }),
  protocol.createConversationSetOp({ sessionId: 'session-a', authorId: 'a', version: 2, path: 'label', value: 'Two' }),
]);
assert.equal(coalesced.length, 1);
assert.equal(coalesced[0].value, 'Two');

console.log('collab protocol smoke checks passed');
