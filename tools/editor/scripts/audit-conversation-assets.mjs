#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ASSET_DIR = path.join(ROOT, 'conversation-assets');
const REPORT_PATH = path.join(ASSET_DIR, 'migration-report.md');

const ALLOWED_CHANNELS = new Set(['pda', 'f2f']);

function normalizeChannel(value, fallback = 'pda') {
  return value === 'f2f' ? 'f2f' : value === 'pda' ? 'pda' : fallback;
}

function loadConversationAssets() {
  if (!fs.existsSync(ASSET_DIR)) return [];
  const files = fs.readdirSync(ASSET_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();

  const assets = [];
  for (const file of files) {
    const fullPath = path.join(ASSET_DIR, file);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed?.conversations)) {
      for (const conv of parsed.conversations) {
        assets.push({ file, conversation: conv });
      }
      continue;
    }

    if (parsed?.project?.conversations && Array.isArray(parsed.project.conversations)) {
      for (const conv of parsed.project.conversations) {
        assets.push({ file, conversation: conv });
      }
      continue;
    }

    if (parsed?.turns && Array.isArray(parsed.turns)) {
      assets.push({ file, conversation: parsed });
      continue;
    }

    throw new Error(`Unsupported conversation asset schema in ${file}`);
  }

  return assets;
}

function createIssue(severity, category, file, conversationId, message) {
  return { severity, category, file, conversationId, message };
}

function auditConversation(file, conversation) {
  const issues = [];
  const turns = Array.isArray(conversation.turns) ? conversation.turns : [];
  const turnById = new Map(turns.map((turn) => [turn.turnNumber, turn]));
  const adjacency = new Map();

  for (const turn of turns) {
    const turnNumber = turn.turnNumber;
    const turnChannel = normalizeChannel(turn.channel, 'pda');

    if (turnChannel === 'f2f' && (typeof turn.npcOpenKey !== 'string' || turn.npcOpenKey.trim() === '')) {
      issues.push(createIssue('must-fix', 'missing-f2f-opener-key', file, conversation.id, `Turn ${turnNumber} is F2F but npcOpenKey is missing.`));
    }

    adjacency.set(turnNumber, new Set());

    const choices = Array.isArray(turn.choices) ? turn.choices : [];
    for (const choice of choices) {
      const terminal = choice.terminal === true;
      const choiceChannel = normalizeChannel(choice.channel, turnChannel);
      const continueChannelRaw = choice.continueChannel ?? choice.continue_channel;

      if (!terminal && continueChannelRaw == null) {
        issues.push(createIssue('must-fix', 'invalid-channel-transition', file, conversation.id, `Turn ${turnNumber} choice ${choice.index} is non-terminal but missing continueChannel/continue_channel.`));
      }

      if (continueChannelRaw != null && !ALLOWED_CHANNELS.has(continueChannelRaw)) {
        issues.push(createIssue('must-fix', 'invalid-channel-transition', file, conversation.id, `Turn ${turnNumber} choice ${choice.index} has invalid continue channel "${String(continueChannelRaw)}".`));
      }

      if (!terminal && choice.continueTo == null) {
        issues.push(createIssue('must-fix', 'dangling-turn-reference', file, conversation.id, `Turn ${turnNumber} choice ${choice.index} is non-terminal but missing continueTo.`));
        continue;
      }

      if (terminal || choice.continueTo == null) continue;

      const target = turnById.get(choice.continueTo);
      if (!target) {
        issues.push(createIssue('must-fix', 'dangling-turn-reference', file, conversation.id, `Turn ${turnNumber} choice ${choice.index} targets missing turn ${choice.continueTo}.`));
        continue;
      }

      adjacency.get(turnNumber)?.add(choice.continueTo);

      const continueChannel = normalizeChannel(continueChannelRaw, choiceChannel);
      const targetChannel = normalizeChannel(target.channel, 'pda');
      if (continueChannel !== targetChannel) {
        const allowedCrossChannel = (choiceChannel === 'pda' && continueChannel === 'f2f') || (choiceChannel === 'f2f' && continueChannel === 'pda');
        if (!allowedCrossChannel) {
          issues.push(createIssue('must-fix', 'invalid-channel-transition', file, conversation.id, `Turn ${turnNumber} choice ${choice.index} continues as ${continueChannel} but target turn ${target.turnNumber} is ${targetChannel}.`));
        }
      }
    }
  }

  const state = new Map();
  const stack = [];

  function dfs(node) {
    state.set(node, 1);
    stack.push(node);

    for (const next of adjacency.get(node) ?? []) {
      const nextState = state.get(next) ?? 0;
      if (nextState === 0) {
        dfs(next);
      } else if (nextState === 1) {
        const cycleStart = stack.indexOf(next);
        const cycle = stack.slice(cycleStart).concat(next);
        issues.push(createIssue('warning', 'loop-hazard', file, conversation.id, `Cycle detected: ${cycle.join(' -> ')}.`));
      }
    }

    stack.pop();
    state.set(node, 2);
  }

  for (const turn of turns) {
    if ((state.get(turn.turnNumber) ?? 0) === 0) {
      dfs(turn.turnNumber);
    }
  }

  return issues;
}

function buildReport(issues) {
  const mustFix = issues.filter((issue) => issue.severity === 'must-fix');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  const lines = [
    '# Conversation Asset Migration Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Must-fix before publish',
  ];

  if (mustFix.length === 0) {
    lines.push('- None ✅');
  } else {
    for (const issue of mustFix) {
      lines.push(`- [${issue.category}] ${issue.file} · C${issue.conversationId}: ${issue.message}`);
    }
  }

  lines.push('', '## Warning (author review)');

  if (warnings.length === 0) {
    lines.push('- None ✅');
  } else {
    for (const issue of warnings) {
      lines.push(`- [${issue.category}] ${issue.file} · C${issue.conversationId}: ${issue.message}`);
    }
  }

  return lines.join('\n') + '\n';
}

function main() {
  const assets = loadConversationAssets();
  const issues = [];

  for (const { file, conversation } of assets) {
    issues.push(...auditConversation(file, conversation));
  }

  fs.mkdirSync(ASSET_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, buildReport(issues), 'utf8');

  const mustFixCount = issues.filter((issue) => issue.severity === 'must-fix').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  console.log(`Audited ${assets.length} conversation(s): ${mustFixCount} must-fix, ${warningCount} warning(s).`);
  console.log(`Report: ${path.relative(process.cwd(), REPORT_PATH)}`);

  if (mustFixCount > 0) {
    process.exitCode = 1;
  }
}

main();
