// ── Tutorial modal ───────────────────────────────────────────────────────────
// Page-by-page guide to the generator.
// Each page: { section, title, demo (HTML), desc (HTML) }
// demo uses a position:relative container (560×285px).
// Node mockups reuse existing .dlg-node / .task-card CSS — no extra styles needed.
// SVG overlays draw annotation lines + labels on top.

(function () {

let _page = 0;

// ── Shared SVG arrowhead marker ──────────────────────────────────────────────
const DEFS = `<defs>
  <marker id="ta" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
    <path d="M0,0 L5,2.5 L0,5 Z" fill="#ff8c00"/>
  </marker>
  <marker id="ta2" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
    <path d="M0,0 L5,2.5 L0,5 Z" fill="#c8b870"/>
  </marker>
  <marker id="ta3" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
    <path d="M0,0 L5,2.5 L0,5 Z" fill="#7a9a50"/>
  </marker>
  <marker id="ta4" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
    <path d="M0,0 L5,2.5 L0,5 Z" fill="#9a4a3a"/>
  </marker>
</defs>`;

function ann(tx, ty, lx, ly, text, color) {
  color = color || '#ff8c00';
  const markerId = color === '#c8b870' ? 'ta2' : color === '#7a9a50' ? 'ta3' : color === '#9a4a3a' ? 'ta4' : 'ta';
  const w = Math.max(text.length * 6.5 + 12, 120);
  const cx = lx + w / 2;
  const cy = ly + 9;
  return `
  <circle cx="${tx}" cy="${ty}" r="3" fill="${color}"/>
  <line x1="${tx}" y1="${ty}" x2="${cx}" y2="${cy}" stroke="${color}" stroke-width="1.2" marker-end="url(#${markerId})" opacity=".85"/>
  <rect x="${lx}" y="${ly}" width="${w}" height="18" rx="2" fill="#151515" stroke="${color}" stroke-width="1" opacity=".96"/>
  <text x="${cx}" y="${ly+12}" text-anchor="middle" fill="#e0e0e0" font-size="10" font-family="'Courier New',monospace">${text}</text>`;
}

function svg(w, h, content) {
  return `<svg style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none;overflow:visible">${DEFS}${content}</svg>`;
}

// ── Mock node builders ────────────────────────────────────────────────────────

function hubNode(rows, x, y) {
  const rowsHtml = rows.map(r => `
    <div class="dlg-node-row${r.cls ? ' ' + r.cls : ''}">
      <span class="dlg-node-row-text"${r.cls ? '' : ''}>${r.text || 'Player reply...'}</span>
      ${r.badge ? `<span class="lnk-badge ${r.badge.cls}">${r.badge.text}</span>` : ''}
      ${!r.cls ? `<button class="dlg-lnk-btn" style="pointer-events:none">🔗</button>` : ''}
      <button class="dlg-del-row" style="pointer-events:none">✕</button>
      <span class="dlg-port-out"></span>
    </div>`).join('');
  return `
  <div class="dlg-node start-node" style="position:absolute;left:${x}px;top:${y}px;width:220px;pointer-events:none">
    <div class="dlg-node-header hub-header">
      <span class="dlg-port-hub"></span>
      <span class="dlg-node-title">● HUB</span>
      <button class="dlg-hbtn edit" style="pointer-events:none">✎</button>
      <button class="dlg-hbtn del" style="pointer-events:none">✕</button>
    </div>
    <div class="dlg-node-npc" style="pointer-events:none;min-height:34px">NPC greeting text goes here...</div>
    ${rowsHtml}
    <div class="dlg-node-add-row">
      <button class="dlg-add-direct" style="pointer-events:none">+ Response</button>
      <button class="dlg-add-menu-btn" style="pointer-events:none">▾</button>
    </div>
  </div>`;
}

function childNode(id, rows, x, y) {
  const rowsHtml = rows.map(r => `
    <div class="dlg-node-row${r.cls ? ' ' + r.cls : ''}">
      <span class="dlg-node-row-text">${r.text || 'Player reply...'}</span>
      ${r.badge ? `<span class="lnk-badge ${r.badge.cls}">${r.badge.text}</span>` : ''}
      <button class="dlg-del-row" style="pointer-events:none">✕</button>
      <span class="dlg-port-out"></span>
    </div>`).join('');
  return `
  <div class="dlg-node" style="position:absolute;left:${x}px;top:${y}px;width:200px;pointer-events:none">
    <div class="dlg-node-header">
      <span class="dlg-port-in"></span>
      <span class="dlg-node-title">[${id}]</span>
      <button class="dlg-hbtn edit" style="pointer-events:none">✎</button>
      <button class="dlg-hbtn del" style="pointer-events:none">✕</button>
    </div>
    <div class="dlg-node-npc" style="pointer-events:none;min-height:34px">NPC replies here...</div>
    ${rowsHtml}
    <div class="dlg-node-add-row">
      <button class="dlg-add-direct" style="pointer-events:none">+ Response</button>
      <button class="dlg-add-menu-btn" style="pointer-events:none">▾</button>
    </div>
  </div>`;
}

// ── Page definitions ──────────────────────────────────────────────────────────

const PAGES = [

  // ── 1. Hub Node ─────────────────────────────────────────────────────────────
  {
    section: 'Dialog Nodes',
    title: 'Hub Node',
    demo: (() => {
      const NX = 30, NY = 20;
      // Row heights: header=28, npc~40, row=28, row=28, add=26
      const headerCy  = NY + 14;
      const npcCy     = NY + 28 + 20;
      const row1Cy    = NY + 28 + 40 + 14;
      const portX     = NX + 218;
      const addCy     = NY + 28 + 40 + 28 + 13;
      return hubNode(
        [{text:'Reply option one'}, {text:'Reply option two'}],
        NX, NY
      ) + svg(560, 285, `
        ${ann(NX+10, headerCy,   300, 10,  'Starting node — NPC speaks first')}
        ${ann(NX+110,npcCy,      300, 55,  'NPC dialogue text', '#c8b870')}
        ${ann(NX+110,row1Cy,     300, 100, 'Player reply choices', '#c8b870')}
        ${ann(portX, row1Cy,     300, 145, 'Output port — drag to connect', '#ff8c00')}
        ${ann(NX+110,addCy,      300, 185, 'Add more replies', '#c8b870')}
      `);
    })(),
    desc: 'The <strong>Hub Node</strong> is the entry point of every dialog. The NPC speaks first, then the player sees all reply options. Each reply can lead to a child node, return to hub, or end the conversation.'
  },

  // ── 2. Connecting Nodes ──────────────────────────────────────────────────────
  {
    section: 'Dialog Nodes',
    title: 'Connecting Nodes',
    demo: (() => {
      // HUB at left, two child nodes at right
      const HX = 20, HY = 50;
      const N1X = 310, N1Y = 20;
      const N2X = 310, N2Y = 155;
      // Hub row 1 port-out position (header28 + npc40 + 14 = 82 from top of node)
      const hr1py = HY + 28 + 40 + 14;
      const hr2py = HY + 28 + 40 + 28 + 14;
      // Child node port-in x, center-y of header
      const n1iny = N1Y + 14;
      const n2iny = N2Y + 14;
      const hubPortX = HX + 218;
      return hubNode(
        [{text:'Ask about the mission'}, {text:'Tell me about yourself'}],
        HX, HY
      ) + childNode('n1', [{text:'Understood, I will help.', badge:{cls:'lnk-hub',text:'↩ hub'}}], N1X, N1Y)
        + childNode('n2', [{text:'Farewell.', badge:{cls:'lnk-end',text:'exit'}}], N2X, N2Y)
        + svg(560, 285, `
          <path d="M${hubPortX},${hr1py} C${hubPortX+30},${hr1py} ${N1X-30},${n1iny} ${N1X},${n1iny}"
            stroke="#6a6a50" stroke-width="1.5" fill="none" opacity=".8"/>
          <path d="M${hubPortX},${hr2py} C${hubPortX+30},${hr2py} ${N2X-30},${n2iny} ${N2X},${n2iny}"
            stroke="#6a6a50" stroke-width="1.5" fill="none" opacity=".8"/>
          ${ann(HX+110, HY+14,      20, 2,   'Hub — starts the dialog')}
          ${ann(hubPortX-2, hr1py,  186, 215, 'Drag output port to connect', '#ff8c00')}
          ${ann(N1X+10, n1iny,      380, 2,   'Child node — NPC reply', '#c8b870')}
          ${ann(N2X+10, n2iny,      380, 215, 'Another branch / choice', '#c8b870')}
        `);
    })(),
    desc: 'Drag the <strong>orange output port</strong> from a player reply row to a child node\'s input port to connect them. Each player choice can lead to a different branch of the conversation.'
  },

  // ── 3. Response Types ────────────────────────────────────────────────────────
  {
    section: 'Dialog Nodes',
    title: 'Response Types',
    demo: (() => {
      const NX = 30, NY = 30;
      // Three rows: normal, end-hub, end-exit
      const r1y = NY + 28 + 40 + 14;
      const r2y = r1y + 28;
      const r3y = r2y + 28;
      const portX = NX + 218;
      return `
      <div class="dlg-node start-node" style="position:absolute;left:${NX}px;top:${NY}px;width:220px;pointer-events:none">
        <div class="dlg-node-header hub-header">
          <span class="dlg-port-hub"></span>
          <span class="dlg-node-title">● HUB</span>
        </div>
        <div class="dlg-node-npc" style="pointer-events:none;min-height:34px">What do you need?</div>
        <div class="dlg-node-row">
          <span class="dlg-node-row-text">Tell me more...</span>
          <span class="lnk-badge lnk-node">→ n1</span>
          <span class="dlg-port-out"></span>
        </div>
        <div class="dlg-node-row end-hub">
          <span class="dlg-node-row-text">Let me think about it.</span>
          <span class="lnk-badge lnk-hub">↩ hub</span>
          <span class="dlg-port-hub" style="margin-right:-3px"></span>
        </div>
        <div class="dlg-node-row end-exit">
          <span class="dlg-node-row-text">Goodbye.</span>
          <span class="lnk-badge lnk-end">exit</span>
          <span class="dlg-port-end" style="margin-right:-3px"></span>
        </div>
        <div class="dlg-node-add-row">
          <button class="dlg-add-direct" style="pointer-events:none">+ Response</button>
          <button class="dlg-add-menu-btn" style="pointer-events:none">▾</button>
        </div>
      </div>` + svg(560, 285, `
        ${ann(portX-2, r1y, 290, 52,  'Links to another node [n1]', '#c8b870')}
        ${ann(portX-2, r2y, 290, 102, 'Returns player to Hub menu', '#7a9a50')}
        ${ann(portX-2, r3y, 290, 152, 'Ends the conversation', '#9a4a3a')}
      `);
    })(),
    desc: 'Each player reply has three possible destinations: <strong>→ node</strong> (continues to a child node), <strong>↩ hub</strong> (returns to the Hub so the player can pick again), or <strong>exit</strong> (closes the dialog entirely).'
  },

  // ── 4. Tasks ─────────────────────────────────────────────────────────────────
  {
    section: 'Tasks',
    title: 'Fetch Task',
    demo: (() => {
      return `
      <div style="position:absolute;left:20px;top:10px;width:340px;pointer-events:none">
        <div class="task-card">
          <div class="task-card-header">
            <span class="task-type-badge fetch">FETCH</span>
            <input class="task-id-input" value="t_find_supplies" style="pointer-events:none" readonly/>
            <input type="checkbox" class="task-enable-chk" checked style="pointer-events:none"/>
            <span style="font-size:10px;color:#888;margin-left:4px">Wt</span>
            <input class="task-weight-input" value="10" style="pointer-events:none" readonly/>
          </div>
          <div class="task-section">
            <div class="task-section-head">
              <span class="task-section-arrow">▶</span>
              <span class="task-section-title">Targets</span>
              <span class="task-section-summary">medkit ×2</span>
            </div>
          </div>
          <div class="task-section">
            <div class="task-section-head">
              <span class="task-section-arrow" style="transform:rotate(90deg)">▶</span>
              <span class="task-section-title">Reward</span>
            </div>
            <div class="task-section-body">
              <div class="task-row">
                <span class="task-label">RU</span>
                <input class="task-input" value="500" style="pointer-events:none;max-width:80px" readonly/>
                <span class="task-label" style="margin-left:8px">XP</span>
                <input class="task-input" value="100" style="pointer-events:none;max-width:80px" readonly/>
              </div>
            </div>
          </div>
          <div class="task-section">
            <div class="task-section-head">
              <span class="task-section-arrow">▶</span>
              <span class="task-section-title">Availability</span>
              <span class="task-section-summary">Any rank</span>
            </div>
          </div>
        </div>
      </div>` + svg(560, 285, `
        ${ann(60,  28,  380, 4,   'Task type (Fetch = bring items)')}
        ${ann(120, 28,  380, 36,  'Task ID — unique per pool', '#c8b870')}
        ${ann(300, 28,  380, 68,  'Enable/disable + spawn weight', '#c8b870')}
        ${ann(180, 78,  380, 108, 'Items to fetch (Targets section)', '#c8b870')}
        ${ann(180, 118, 380, 148, 'Ruble + XP reward on completion', '#7a9a50')}
        ${ann(180, 158, 380, 188, 'Rank / day gate for availability', '#c8b870')}
      `);
    })(),
    desc: '<strong>Fetch tasks</strong> ask the player to bring specific items to the NPC. Set the item targets, reward (rubles + XP), and optional availability gates. Tasks are pooled — the archetype randomly assigns one to the NPC on spawn.'
  },

  // ── 5. Specializations ───────────────────────────────────────────────────────
  {
    section: 'Specializations',
    title: 'Specialization Types',
    demo: (() => {
      const specs = [
        {id:'technician', label:'Technician', desc:'Repair weapons & armor', color:'#7dd3fc', wip:false},
        {id:'medic',      label:'Field Medic', desc:'Heal health & radiation', color:'#4caf50', wip:false},
        {id:'cook',       label:'Chef',        desc:'— in the works',          color:'#555',    wip:true},
        {id:'informant',  label:'Informant',   desc:'— in the works',          color:'#555',    wip:true},
      ];
      const rows = specs.map((s, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #1e1e1e;pointer-events:none${s.wip ? ';opacity:0.4' : ''}">
          <input type="checkbox" ${!s.wip && i < 2 ? 'checked' : ''} ${s.wip ? 'disabled' : ''} style="accent-color:${s.color};pointer-events:none"/>
          <span style="color:${s.color};font-size:12px;min-width:100px">${s.label}</span>
          <span style="color:#666;font-size:11px">${s.desc}</span>
        </div>`).join('');
      return `
      <div style="position:absolute;left:20px;top:20px;width:360px;background:linear-gradient(180deg,#1a1a1a,#111);border:1px solid #3a3a3a;border-radius:2px;pointer-events:none">
        ${rows}
      </div>` + svg(560, 285, `
        ${ann(200, 42,  400, 4,   'Check to enable this service')}
        ${ann(200, 78,  400, 44,  'Unlocks NPC repair dialog', '#7dd3fc')}
        ${ann(200, 114, 400, 84,  'Adds medical healing service', '#4caf50')}
        ${ann(200, 150, 400, 124, 'Greyed out — not yet available', '#555')}
      `);
    })(),
    desc: 'Specializations expand what an NPC can <em>do</em>. <strong>Technician</strong> unlocks weapon and armor repair. <strong>Medic</strong> provides health and radiation healing. Chef and Informant are planned for a future update.'
  },

  // ── 6. Settings — Tier & Weight ─────────────────────────────────────────────
  {
    section: 'Settings',
    title: 'Priority Tier & Weight',
    demo: (() => {
      return `
      <div style="position:absolute;left:20px;top:15px;width:340px;pointer-events:none">
        <div class="sec" style="margin:0">
          <div class="fg">
            <label>Priority Tier</label>
            <select style="pointer-events:none;width:100%;padding:8px;background:#0c0c0c;border:1px solid #3a3a3a;color:#d4d4d4;font-family:inherit;font-size:12px">
              <option>Tier 2 — Uncommon</option>
            </select>
          </div>
          <div class="fg">
            <label>Chance Weight</label>
            <input type="number" value="15" style="pointer-events:none;width:100%;padding:8px;background:#0c0c0c;border:1px solid #3a3a3a;color:#d4d4d4;font-family:inherit;font-size:12px" readonly/>
          </div>
          <div class="fg">
            <label>Available After Days</label>
            <input type="number" value="7" style="pointer-events:none;width:100%;padding:8px;background:#0c0c0c;border:1px solid #3a3a3a;color:#d4d4d4;font-family:inherit;font-size:12px" readonly/>
          </div>
        </div>
      </div>` + svg(560, 285, `
        ${ann(180, 46,  380, 20,  'Tier 1=common ... Tier 5=rare')}
        ${ann(180, 104, 380, 95,  'Relative weight within same tier', '#c8b870')}
        ${ann(180, 158, 380, 170, 'Calendar gate — days since game start', '#7a9a50')}
      `);
    })(),
    desc: 'The <strong>tier</strong> controls how rarely an archetype appears (Tier 1 = common, Tier 5 = rare). The <strong>weight</strong> is relative priority within the same tier. The <strong>calendar gate</strong> prevents the archetype from spawning until N in-game days have passed.'
  },

  // ── 7. Spawn Loadout ─────────────────────────────────────────────────────────
  {
    section: 'Settings',
    title: 'Spawn Loadout',
    demo: (() => {
      return `
      <div style="position:absolute;left:20px;top:10px;width:340px;pointer-events:none">
        <div class="sec" style="margin:0">
          <div class="fg">
            <label>Primary Weapon</label>
            <textarea style="pointer-events:none;width:100%;background:#0c0c0c;border:1px solid #3a3a3a;color:#d4d4d4;font-family:inherit;font-size:11px;padding:7px;min-height:54px" readonly>wpn_ak74_npc:100
wpn_sig550_npc:50</textarea>
          </div>
          <div class="fg">
            <label>Secondary Weapon</label>
            <textarea style="pointer-events:none;width:100%;background:#0c0c0c;border:1px solid #3a3a3a;color:#d4d4d4;font-family:inherit;font-size:11px;padding:7px;min-height:34px" readonly>wpn_pm_npc:100</textarea>
          </div>
          <div class="fg">
            <label>Extra Items</label>
            <textarea style="pointer-events:none;width:100%;background:#0c0c0c;border:1px solid #3a3a3a;color:#d4d4d4;font-family:inherit;font-size:11px;padding:7px;min-height:34px" readonly>medkit:100
bandage:80</textarea>
          </div>
        </div>
      </div>` + svg(560, 285, `
        ${ann(180, 38,  380, 4,   'Format: item_id:chance')}
        ${ann(180, 38,  380, 34,  'Multiple lines = random pick', '#c8b870')}
        ${ann(180, 118, 380, 110, 'Pistol / sidearm slot', '#c8b870')}
        ${ann(180, 178, 380, 170, 'Consumables, armor, artifacts…', '#c8b870')}
      `);
    })(),
    desc: 'Each loadout slot (Primary, Secondary, Extra) takes one item ID per line in the format <code>item_id:chance</code>. When multiple lines are provided, one is picked at random on spawn — useful for varied equipment.'
  },

];

// ── Render ────────────────────────────────────────────────────────────────────

function _render() {
  const p = PAGES[_page];

  document.getElementById('tutDemo').innerHTML = p.demo;
  document.getElementById('tutTitle').textContent = p.title;
  document.getElementById('tutDesc').innerHTML = p.desc;
  document.getElementById('tutCounter').textContent = `${_page + 1} / ${PAGES.length}`;

  document.querySelectorAll('.tut-nav-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === _page);
  });

  document.getElementById('tutPrev').disabled = _page === 0;
  document.getElementById('tutNext').disabled = _page === PAGES.length - 1;
}

function _buildNav() {
  const nav = document.getElementById('tutNav');
  let curSection = '';
  PAGES.forEach((p, i) => {
    if (p.section !== curSection) {
      curSection = p.section;
      const sec = document.createElement('div');
      sec.className = 'tut-nav-sec';
      sec.textContent = p.section;
      nav.appendChild(sec);
    }
    const btn = document.createElement('button');
    btn.className = 'tut-nav-btn';
    btn.textContent = p.title;
    btn.onclick = () => { _page = i; _render(); };
    nav.appendChild(btn);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

function openTutorial(startPage) {
  _page = startPage || 0;
  document.getElementById('tutModal').style.display = 'flex';
  _render();
}

function closeTutorial() {
  document.getElementById('tutModal').style.display = 'none';
}

function _tutPrev() { if (_page > 0)               { _page--; _render(); } }
function _tutNext() { if (_page < PAGES.length - 1) { _page++; _render(); } }

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  _buildNav();

  document.getElementById('tutModal').addEventListener('click', e => {
    if (e.target.id === 'tutModal') closeTutorial();
  });

  document.addEventListener('keydown', e => {
    if (document.getElementById('tutModal').style.display !== 'flex') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown')  { e.preventDefault(); _tutNext(); }
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')    { e.preventDefault(); _tutPrev(); }
    if (e.key === 'Escape') closeTutorial();
  });
});

window.openTutorial  = openTutorial;
window.closeTutorial = closeTutorial;
window._tutPrev      = _tutPrev;
window._tutNext      = _tutNext;

})();
