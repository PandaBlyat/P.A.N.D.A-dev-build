// P.A.N.D.A. Community Library — API Server
// Thin proxy that keeps Supabase credentials server-side.
// The browser never sees SUPABASE_URL or SUPABASE_SERVICE_KEY.

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

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function sbHeaders(): Record<string, string> {
  return {
    'apikey': SUPABASE_SERVICE_KEY!,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY!}`,
    'Content-Type': 'application/json',
  };
}

function sbEndpoint(path: string): string {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/conversations?faction=stalker
app.get('/api/conversations', async (req, res) => {
  try {
    const params = new URLSearchParams({ select: '*', order: 'created_at.desc' });
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

// POST /api/conversations
app.post('/api/conversations', async (req, res) => {
  try {
    const { faction, label, description, author, data } = req.body ?? {};
    if (!faction || !data) {
      res.status(400).json({ error: 'Missing required fields: faction, data' });
      return;
    }

    const r = await fetch(sbEndpoint(TABLE), {
      method: 'POST',
      headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ faction, label: label ?? '', description: description ?? '', author: author ?? 'Anonymous', data }),
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

// PATCH /api/conversations/:id/download  — best-effort counter increment via RPC
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

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`P.A.N.D.A. API server → http://localhost:${PORT}`);
  console.log(`Supabase project: ${SUPABASE_URL}`);
});
