// P.A.N.D.A. Community Library — API Server
// Thin proxy that keeps Supabase credentials server-side.

import express from 'express';
import cors from 'cors';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
const TABLE = 'community_conversations';
const SUPPORT_TABLE = 'creator_support_metrics';
const SUPPORT_ROW_ID = 'global';
const COMMUNITY_REQUIRED_COLUMNS = ['id', 'faction', 'label', 'description', 'author', 'data', 'downloads', 'created_at'] as const;
const COMMUNITY_OPTIONAL_COLUMNS = ['summary', 'tags', 'branch_count', 'complexity', 'upvotes', 'updated_at'] as const;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment.');
  console.error('Copy server/.env.example to server/.env and fill in your values.');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '2mb' }));

function sbHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_KEY!,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY!}`,
    'Content-Type': 'application/json',
  };
}

function sbEndpoint(path: string): string {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

function isMissingSchemaColumnError(message: string, column: string): boolean {
  const normalized = message.toLowerCase();
  const normalizedColumn = column.toLowerCase();
  return (
    (normalized.includes('schema cache') && normalized.includes(`'${normalizedColumn}'`))
    || (normalized.includes('column') && normalized.includes('does not exist') && (
      normalized.includes(`${TABLE.toLowerCase()}.${normalizedColumn}`)
      || normalized.includes(`"${normalizedColumn}"`)
      || normalized.includes(`'${normalizedColumn}'`)
    ))
  );
}

function isCommunitySchemaMismatchError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('schema cache') && normalized.includes(`'${TABLE.toLowerCase()}'`);
}

function isMissingOptionalCommunityColumnError(message: string): boolean {
  return COMMUNITY_OPTIONAL_COLUMNS.some(column => isMissingSchemaColumnError(message, column));
}

async function readErrorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.message ?? body.error ?? `Database error: ${res.status} ${res.statusText}`;
}

function escapeIlike(value: string): string {
  return value.replace(/[%_,]/g, c => `\\${c}`);
}

function normalizeConversationRow(row: Record<string, unknown>) {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    faction: typeof row.faction === 'string' ? row.faction : '',
    label: typeof row.label === 'string' ? row.label : '',
    description: typeof row.description === 'string' ? row.description : '',
    summary: typeof row.summary === 'string' ? row.summary : '',
    author: typeof row.author === 'string' ? row.author : 'Anonymous',
    tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    branch_count: typeof row.branch_count === 'number' ? row.branch_count : 0,
    complexity: typeof row.complexity === 'string' ? row.complexity : null,
    downloads: typeof row.downloads === 'number' ? row.downloads : 0,
    upvotes: typeof row.upvotes === 'number' ? row.upvotes : 0,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updated_at: typeof row.updated_at === 'string'
      ? row.updated_at
      : typeof row.created_at === 'string'
        ? row.created_at
        : new Date(0).toISOString(),
    data: row.data ?? null,
  };
}

app.get('/api/conversations', async (req, res) => {
  try {
    const params = new URLSearchParams({
      select: [...COMMUNITY_REQUIRED_COLUMNS, ...COMMUNITY_OPTIONAL_COLUMNS].join(','),
      order: 'updated_at.desc',
    });
    const { faction } = req.query;
    if (typeof faction === 'string' && faction) {
      params.set('faction', `eq.${faction}`);
    }

    let r = await fetch(`${sbEndpoint(TABLE)}?${params}`, { headers: sbHeaders() });
    if (!r.ok) {
      const errorMessage = await readErrorMessage(r);
      if (!isCommunitySchemaMismatchError(errorMessage) && !isMissingOptionalCommunityColumnError(errorMessage)) {
        res.status(r.status).json({ error: errorMessage });
        return;
      }

      const fallbackParams = new URLSearchParams({
        select: COMMUNITY_REQUIRED_COLUMNS.join(','),
        order: 'created_at.desc',
      });
      if (typeof faction === 'string' && faction) {
        fallbackParams.set('faction', `eq.${faction}`);
      }

      r = await fetch(`${sbEndpoint(TABLE)}?${fallbackParams}`, { headers: sbHeaders() });
      if (!r.ok) {
        res.status(r.status).json({ error: await readErrorMessage(r) });
        return;
      }
    }
    const rows = await r.json() as Array<Record<string, unknown>>;
    res.json(rows.map(normalizeConversationRow));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});


app.get('/api/support/upvotes', async (_req, res) => {
  try {
    const params = new URLSearchParams({
      select: 'id,upvotes,visitors,updated_at',
      id: `eq.${SUPPORT_ROW_ID}`,
      limit: '1',
    });

    const r = await fetch(`${sbEndpoint(SUPPORT_TABLE)}?${params}`, { headers: sbHeaders() });
    if (!r.ok) {
      res.status(r.status).json({ error: `Database error: ${r.status} ${r.statusText}` });
      return;
    }

    const rows = await r.json() as Array<{ id: string; upvotes: number; updated_at: string }>;
    res.json(rows[0] ?? { id: SUPPORT_ROW_ID, upvotes: 0, updated_at: new Date(0).toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const { faction, label, description, summary, author, data, tags, branch_count, complexity } = req.body ?? {};
    const normalizedLabel = typeof label === 'string' ? label.trim() : '';
    if (!faction || !data || !normalizedLabel) {
      res.status(400).json({ error: 'Missing required fields: faction, label, data' });
      return;
    }

    const duplicateParams = new URLSearchParams({
      select: 'id',
      limit: '1',
      label: `ilike.${escapeIlike(normalizedLabel)}`,
    });
    const duplicate = await fetch(`${sbEndpoint(TABLE)}?${duplicateParams}`, { headers: sbHeaders() });
    if (duplicate.ok) {
      const rows = await duplicate.json() as Array<{ id: string }>;
      if (rows.length > 0) {
        res.status(409).json({ error: 'A community conversation with this title already exists.' });
        return;
      }
    }

    const headers = { ...sbHeaders(), Prefer: 'return=minimal' };
    const publishBody = {
      faction,
      label: normalizedLabel,
      description: typeof description === 'string' ? description : '',
      summary: typeof summary === 'string' ? summary : '',
      author: typeof author === 'string' && author.trim() ? author.trim() : 'Anonymous',
      tags: Array.isArray(tags) ? tags : [],
      branch_count: typeof branch_count === 'number' ? branch_count : null,
      complexity: typeof complexity === 'string' ? complexity : null,
      data,
    };

    let r = await fetch(sbEndpoint(TABLE), {
      method: 'POST',
      headers,
      body: JSON.stringify(publishBody),
    });
    if (!r.ok) {
      const errorMessage = await readErrorMessage(r);
      if (
        isMissingSchemaColumnError(errorMessage, 'branch_count')
        || isMissingSchemaColumnError(errorMessage, 'complexity')
        || isMissingSchemaColumnError(errorMessage, 'summary')
        || isMissingSchemaColumnError(errorMessage, 'tags')
        || isCommunitySchemaMismatchError(errorMessage)
      ) {
        const {
          summary: _summary,
          tags: _tags,
          branch_count: _branchCount,
          complexity: _complexity,
          ...fallbackBody
        } = publishBody;
        r = await fetch(sbEndpoint(TABLE), {
          method: 'POST',
          headers,
          body: JSON.stringify(fallbackBody),
        });
      }
    }

    if (!r.ok) {
      res.status(r.status).json({ error: await readErrorMessage(r) });
      return;
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.patch('/api/conversations/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_download`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ conv_id: id }),
    });
  } catch {
    // Best-effort — ignore errors
  }
  res.json({ ok: true });
});

app.patch('/api/conversations/:id/upvote', async (req, res) => {
  try {
    const { id } = req.params;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_upvote`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ conv_id: id }),
    });

    if (!r.ok) {
      res.status(r.status).json({ error: await readErrorMessage(r) });
      return;
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
    return;
  }
  res.json({ ok: true });
});


app.patch('/api/support/upvote', async (_req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_creator_support_upvote`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ support_id: SUPPORT_ROW_ID }),
    });

    if (!r.ok) {
      res.status(r.status).json({ error: `Database error: ${r.status} ${r.statusText}` });
      return;
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
    return;
  }
  res.json({ ok: true });
});

app.get('/api/visitor', async (_req, res) => {
  try {
    const params = new URLSearchParams({
      select: 'visitors',
      id: `eq.${SUPPORT_ROW_ID}`,
      limit: '1',
    });
    const r = await fetch(`${sbEndpoint(SUPPORT_TABLE)}?${params}`, { headers: sbHeaders() });
    if (!r.ok) {
      res.status(r.status).json({ error: `Database error: ${r.status}` });
      return;
    }
    const rows = await r.json() as Array<{ visitors?: number }>;
    res.json({ visitors: rows[0]?.visitors ?? 0 });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/visitor', async (_req, res) => {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_site_visitor`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ support_id: SUPPORT_ROW_ID }),
    });
  } catch {
    // Best-effort
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`P.A.N.D.A. API server → http://localhost:${PORT}`);
  console.log(`Supabase project: ${SUPABASE_URL}`);
});
