// P.A.N.D.A. Community Library — API Server
// Thin proxy that keeps Supabase credentials server-side.

import express from 'express';
import cors from 'cors';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
const TABLE = 'community_conversations';

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

function escapeIlike(value: string): string {
  return value.replace(/[%_,]/g, c => `\\${c}`);
}

app.get('/api/conversations', async (req, res) => {
  try {
    const params = new URLSearchParams({ select: '*', order: 'updated_at.desc' });
    const { faction } = req.query;
    if (typeof faction === 'string' && faction) {
      params.set('faction', `eq.${faction}`);
    }

    const r = await fetch(`${sbEndpoint(TABLE)}?${params}`, { headers: sbHeaders() });
    if (!r.ok) {
      res.status(r.status).json({ error: `Database error: ${r.status} ${r.statusText}` });
      return;
    }
    res.json(await r.json());
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

    const r = await fetch(sbEndpoint(TABLE), {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        faction,
        label: normalizedLabel,
        description: typeof description === 'string' ? description : '',
        summary: typeof summary === 'string' ? summary : '',
        author: typeof author === 'string' && author.trim() ? author.trim() : 'Anonymous',
        tags: Array.isArray(tags) ? tags : [],
        branch_count: typeof branch_count === 'number' ? branch_count : null,
        complexity: typeof complexity === 'string' ? complexity : null,
        data,
      }),
    });
    if (!r.ok) {
      res.status(r.status).json({ error: `Database error: ${r.status} ${r.statusText}` });
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
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_upvote`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ conv_id: id }),
    });
  } catch {
    // Best-effort — ignore errors
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`P.A.N.D.A. API server → http://localhost:${PORT}`);
  console.log(`Supabase project: ${SUPABASE_URL}`);
});
