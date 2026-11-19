// For Educators: loads curriculum.json and shows it as a small hash-routed site (open to everyone, read-only).
// Routes: #/  #/lessons?band=&skill=&tool=&q=  #/lesson/<id>  #/standards?grade=  #/tools  #/tool/<id>
//         #/sequence?band=  #/resources  #/resource/<id>
const app = document.getElementById('app');
let C = null; // the curriculum once loaded

async function load() {
  try {
    const res = await fetch('curriculum.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    C = await res.json();
    start();
  } catch {
    app.innerHTML = '<p class="loading">Couldn’t load the curriculum. Check your connection and reload the page.</p>';
  }
}

// ---------- tiny html helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Escapes, then allows **bold** and [label](href) with a safe href. */
function fmt(s) {
  let h = esc(s);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => link(href.replace(/&amp;/g, '&'), label, true));
  return h;
}
function link(href, labelHtml, labelIsHtml = false) {
  const ok = /^(\/|#|https:\/\/)/.test(href);
  if (!ok) return labelIsHtml ? labelHtml : esc(labelHtml);
  const ext = href.startsWith('/') || href.startsWith('https://');
  return `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${labelIsHtml ? labelHtml : esc(labelHtml)}${ext ? ' <span aria-hidden="true">↗</span>' : ''}</a>`;
}
const list = (items, tag = 'ul') => (items && items.length ? `<${tag}>${items.map((i) => `<li>${fmt(i)}</li>`).join('')}</${tag}>` : '');

function blocks(arr) {
  return (arr || []).map((b) => {
    if (b.h) return `<h3>${fmt(b.h)}</h3>`;
    if (b.h4) return `<h4>${fmt(b.h4)}</h4>`;
    if (b.p) return `<p>${fmt(b.p)}</p>`;
    if (b.note) return `<div class="note">${fmt(b.note)}</div>`;
    if (b.ul) return list(b.ul);
    if (b.ol) return list(b.ol, 'ol');
    if (b.table) {
      return `<div class="table-wrap"><table><thead><tr>${b.table.head.map((x) => `<th>${fmt(x)}</th>`).join('')}</tr></thead><tbody>${
        b.table.rows.map((r) => `<tr>${r.map((x) => `<td>${fmt(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    if (b.lines) return `<div class="lines">${'<p>______________________________________________________________</p>'.repeat(b.lines)}</div>`;
    return '';
  }).join('');
}

// ---------- lookups ----------
const tool = (id) => C.tools.find((t) => t.id === id);
const lesson = (id) => C.lessons.find((l) => l.id === id);
const skillChip = (k) => { const s = C.skills[k]; return s ? `<span class="chip sk" style="--c:${s.color}">${esc(s.name)}</span>` : ''; };
const bandChip = (b) => `<span class="chip band">${esc(b)}</span>`;
const gradesOf = (band) => C.bands[band] || [];
const ORDER = ['K', '1', '2', '3', '4', '5', '6'];
/** The grades a lesson lists ('K-1', '4', '2-3'), falling back to its whole band. */
function lessonGrades(l) {
  const [a, b] = String(l.grades).split('-').map((x) => ORDER.indexOf(x.trim()));
  if (a < 0) return gradesOf(l.band);
  return ORDER.slice(a, (b >= 0 ? b : a) + 1);
}
const bandOfGrade = (g) => Object.keys(C.bands).find((b) => C.bands[b].includes(g));
function stdFor(shortId, grade) {
  const m = /^([A-Za-z]{2}\d+\.\d+)([a-z]?)$/.exec(shortId);
  if (!m) return null;
  return C.standards.find((s) => s.code === `MU:${m[1]}.${grade}${m[2]}`) || null;
}
const stdText = (t) => (t ? fmt(t) : '<span class="muted">Not in this framework</span>');
function anchorOf(shortId) {
  const s = C.standards.find((x) => x.code.startsWith(`MU:${shortId.replace(/[a-z]$/, '')}.`));
  return s ? C.anchors.find((a) => a.n === s.anchor) : null;
}
const toolHref = (t) => t.url;

function lessonCard(l) {
  const t = tool(l.tools[0]);
  return `<a class="card skill-card" style="--c:${C.skills[l.skill]?.color}" href="#/lesson/${esc(l.id)}">
    <div class="top"><h3>${esc(l.title)}</h3><span class="emoji" aria-hidden="true">${esc(t?.emoji || '')}</span></div>
    <p>${fmt(l.summary)}</p>
    <div class="chips">${bandChip('Gr ' + l.grades)}${skillChip(l.skill)}<span class="chip">${l.minutes} min${l.sessions > 1 ? ' × ' + l.sessions : ''}</span></div>
    <div class="meta">${l.tools.map((id) => esc(tool(id)?.name)).join(' + ')} · ${l.standards.map(esc).join(', ')}</div>
  </a>`;
}

// ---------- views ----------
function viewHome() {
  const n = (band) => C.lessons.filter((l) => l.band === band).length;
  return `
  <h1>Music Lab Curriculum <span class="muted" style="font-size:1rem">K-6</span></h1>
  <p class="lead">Ready-to-teach lessons for every Music Lab tool, each with objectives, a timed procedure, differentiation, assessment and a 4-level rubric, mapped to the National Core Arts Standards and the New York State Learning Standards for the Arts (Music).</p>
  <div class="stat-row">
    <div class="stat"><b>${C.lessons.length}</b><span>lessons</span></div>
    <div class="stat"><b>${C.tools.length}</b><span>tools</span></div>
    <div class="stat"><b>${C.standards.length}</b><span>grade-level standards mapped</span></div>
    <div class="stat"><b>${C.units.length}</b><span>units in the scope &amp; sequence</span></div>
  </div>
  <div class="cols">
    <a class="card" href="#/sequence?band=K-3"><div class="top"><h3>Grades K-3</h3><span class="emoji">🧸</span></div><p>${n('K-3')} lessons: steady beat, high/low, ta and ti-ti, sol-mi-la, instrument families, block songs.</p></a>
    <a class="card" href="#/sequence?band=4-6"><div class="top"><h3>Grades 4-6</h3><span class="emoji">🎧</span></div><p>${n('4-6')} lessons: staff reading in two clefs, chords and the blues, composing and arranging, producing songs in the DAW.</p></a>
  </div>
  <h2>Browse by skill area</h2>
  <div class="grid">${Object.entries(C.skills).map(([k, s]) => `
    <a class="card skill-card" style="--c:${s.color}" href="#/lessons?skill=${k}"><div class="top"><h3>${esc(s.name)}</h3><span class="emoji">${esc(s.icon)}</span></div>
    <p>${fmt(s.desc)}</p><div class="meta">${C.lessons.filter((l) => l.skill === k || (l.skills || []).includes(k)).length} lessons</div></a>`).join('')}
  </div>
  <h2>Start here</h2>
  <div class="cols">
    <div class="panel"><h3>How a lesson page works</h3>
      <ul>
        <li><strong>Facts strip</strong>: grades, time, tools, and what comes before and after it.</li>
        <li><strong>Standards</strong>: the NCAS / NYS codes, with the exact grade-level expectation for each grade in the band.</li>
        <li><strong>Procedure</strong>: timed steps, with suggested teacher talk in <span style="color:#fde68a">gold</span> and what to look for in <span style="color:#86efac">green</span>.</li>
        <li><strong>Assessment + rubric</strong>: formative checks, a summative task and a 4-level rubric (4 Exceeds, 3 Meets, 2 Approaching, 1 Beginning).</li>
        <li><strong>Print</strong> gives a clean black-and-white copy for a sub folder or lesson binder.</li>
      </ul></div>
    <div class="panel"><h3>Before the first lesson</h3>
      <ul>
        <li>Run the [Tech setup checklist](#/resource/tech-setup) on one student device.</li>
        <li>Skim the [Scope &amp; sequence](#/sequence) for your grade band.</li>
        <li>Print the [Class assessment tracker](#/resource/tracker) and the [Student self-assessment](#/resource/self-assessment).</li>
        <li>Check the [Privacy notes](#/resource/privacy) so you know which tools save student work and where.</li>
      </ul></div>
  </div>`;
}

function viewLessons(q) {
  const band = q.get('band') || '';
  const skill = q.get('skill') || '';
  const tl = q.get('tool') || '';
  const text = (q.get('q') || '').toLowerCase();
  const rows = C.lessons.filter((l) =>
    (!band || l.band === band) && (!skill || l.skill === skill || (l.skills || []).includes(skill)) && (!tl || l.tools.includes(tl)) &&
    (!text || JSON.stringify([l.title, l.summary, l.objectives, l.vocabulary, l.standards]).toLowerCase().includes(text)));
  const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
  return `
  <h1>Lessons</h1>
  <form class="filters no-print" id="lessonFilters">
    <div class="seg" role="group" aria-label="Grade band">${['', 'K-3', '4-6'].map((b) => `<button type="button" data-band="${b}" aria-pressed="${b === band}">${b || 'All grades'}</button>`).join('')}</div>
    <label>Skill area<select name="skill">${opt('', 'All skill areas', skill)}${Object.entries(C.skills).map(([k, s]) => opt(k, s.name, skill)).join('')}</select></label>
    <label>Tool<select name="tool">${opt('', 'All tools', tl)}${C.tools.map((t) => opt(t.id, t.name, tl)).join('')}</select></label>
    <label>Search<input type="search" name="q" value="${esc(q.get('q') || '')}" placeholder="e.g. rondo, Cr2.1a, treble"></label>
  </form>
  <p class="count" aria-live="polite">${rows.length} lesson${rows.length === 1 ? '' : 's'}</p>
  <div class="grid">${rows.map(lessonCard).join('') || '<p class="muted">No lessons match. Clear a filter.</p>'}</div>`;
}

function bindLessonFilters() {
  const f = document.getElementById('lessonFilters');
  if (!f) return;
  const go = (band) => {
    const p = new URLSearchParams();
    const b = band ?? f.querySelector('[aria-pressed="true"]')?.dataset.band ?? '';
    if (b) p.set('band', b);
    for (const k of ['skill', 'tool', 'q']) if (f.elements[k].value) p.set(k, f.elements[k].value);
    const s = p.toString();
    history.replaceState(null, '', '#/lessons' + (s ? '?' + s : ''));
    render(true);
  };
  f.querySelectorAll('[data-band]').forEach((b) => b.addEventListener('click', () => go(b.dataset.band)));
  f.elements.skill.addEventListener('change', () => go());
  f.elements.tool.addEventListener('change', () => go());
  let timer;
  f.elements.q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => go(), 250); });
  f.addEventListener('submit', (e) => e.preventDefault());
}

function standardsBlock(l) {
  return l.standards.map((sid) => {
    const a = anchorOf(sid);
    const rows = lessonGrades(l).map((g) => {
      const s = stdFor(sid, g);
      return s ? `<tr><td><code>${esc(s.code)}</code></td><td>${stdText(s.text)}</td><td>${s.nyText === s.text && s.text ? '<span class="muted">Same as national</span>' : stdText(s.nyText)}</td></tr>` : '';
    }).join('');
    return `<details open><summary>${esc(sid)} · ${esc(a ? `Anchor ${a.n}: ${a.name}` : '')}</summary>
      <div class="table-wrap"><table><thead><tr><th>Code</th><th>National (NCAS)</th><th>New York State</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  }).join('');
}

function viewLesson(id) {
  const l = lesson(id);
  if (!l) return `<h1>Lesson not found</h1><p><a href="#/lessons">All lessons</a></p>`;
  const tools = l.tools.map(tool);
  const pre = l.prereq && lesson(l.prereq);
  const nxt = l.next && lesson(l.next);
  const total = l.steps.reduce((a, s) => a + s.minutes, 0);
  const rub = `<div class="table-wrap rubric"><table><thead><tr><th>Criterion</th><th>4 · Exceeds</th><th>3 · Meets</th><th>2 · Approaching</th><th>1 · Beginning</th></tr></thead><tbody>${
    l.rubric.map((r) => `<tr><td>${fmt(r.criterion)}</td>${r.levels.map((x) => `<td>${fmt(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `
  <div class="crumbs no-print"><a href="#/lessons">Lessons</a> › <a href="#/lessons?band=${esc(l.band)}">Grades ${esc(l.band)}</a> › <a href="#/tool/${esc(tools[0].id)}">${esc(tools[0].name)}</a></div>
  <div class="print-only"><strong>Mr. Arthur's Music Lab · Curriculum</strong> · mrarthurmusic.com/educators/</div>
  <div class="lesson-head">
    <div><h1>${esc(l.title)}</h1><div class="chips">${bandChip('Grades ' + l.grades)}${skillChip(l.skill)}${(l.skills || []).map(skillChip).join('')}</div></div>
    <div class="actions no-print">
      ${tools.map((t) => `<a class="btn" href="${esc(toolHref(t))}" target="_blank" rel="noopener">Open ${esc(t.name)} ↗</a>`).join('')}
      <button class="btn ghost" type="button" onclick="window.print()">Print</button>
    </div>
  </div>
  <p class="lead" style="margin-top:12px">${fmt(l.summary)}</p>
  <div class="facts">
    <div class="fact"><b>Grades</b>${esc(l.grades)} (band ${esc(l.band)})</div>
    <div class="fact"><b>Time</b>${l.minutes} min${l.sessions > 1 ? ` × ${l.sessions} sessions` : ''}${total && Math.abs(total - l.minutes * l.sessions) > 5 && Math.abs(total - l.minutes) > 5 ? ` <span class="muted">(steps: ${total} min)</span>` : ''}</div>
    <div class="fact"><b>Tools</b>${tools.map((t) => `<a href="#/tool/${esc(t.id)}">${esc(t.name)}</a>`).join(', ')}</div>
    <div class="fact"><b>Before this</b>${pre ? `<a href="#/lesson/${esc(pre.id)}">${esc(pre.title)}</a>` : 'No prerequisite'}</div>
    <div class="fact"><b>Next</b>${nxt ? `<a href="#/lesson/${esc(nxt.id)}">${esc(nxt.title)}</a>` : '—'}</div>
  </div>

  <div class="cols">
    <div class="panel"><h2>Objectives</h2><p class="muted">Students will…</p>${list(l.objectives)}<h3>“I can” statements</h3>${list(l.iCan)}</div>
    <div class="panel"><h2>Vocabulary</h2><dl class="vocab">${l.vocabulary.map((v) => `<dt>${esc(v.term)}</dt><dd>${fmt(v.def)}</dd>`).join('')}</dl></div>
  </div>

  <h2>Standards</h2>
  ${standardsBlock(l)}

  <div class="cols">
    <div class="panel"><h2>Materials</h2>${list(l.materials)}${l.links?.length ? `<h3>Links</h3><ul>${l.links.map((x) => `<li>${link(x.href, x.label)}</li>`).join('')}</ul>` : ''}</div>
    <div class="panel"><h2>Prep</h2>${list(l.prep)}</div>
  </div>

  <h2>Procedure</h2>
  <ol class="steps">${l.steps.map((s) => `<li><span class="phase">${esc(s.phase)}</span><span class="min">${s.minutes} min</span>
    <div>${fmt(s.do)}</div>${s.say ? `<p class="say">“${fmt(s.say)}”</p>` : ''}${s.check ? `<p class="check">${fmt(s.check)}</p>` : ''}</li>`).join('')}</ol>

  <h2>Differentiation</h2>
  <div class="cols">
    <div class="panel"><h3>Support</h3>${list(l.differentiation.support)}</div>
    <div class="panel"><h3>Extend</h3>${list(l.differentiation.extend)}</div>
    <div class="panel"><h3>Access (IEP/504, ELL, devices)</h3>${list(l.differentiation.access)}</div>
  </div>

  <h2>Assessment</h2>
  <div class="cols">
    <div class="panel"><h3>Formative (during the lesson)</h3>${list(l.assessment.formative)}</div>
    <div class="panel"><h3>Summative</h3><p>${fmt(l.assessment.summative)}</p><h3>Exit ticket</h3><p>${fmt(l.exitTicket)}</p></div>
  </div>
  <h3>Rubric</h3>
  ${rub}
  ${l.tips?.length ? `<div class="panel"><h2>Teacher tips &amp; troubleshooting</h2>${list(l.tips)}</div>` : ''}
  <p class="footer-note">Standards: National Core Arts Standards (2014) for Music and the New York State Learning Standards for the Arts: Music (2017), General Music PK-8. Wording is paraphrased; see the <a href="#/standards">Standards map</a> for sources.</p>`;
}

function viewStandards(q) {
  const grade = q.get('grade') || '3';
  const band = bandOfGrade(grade);
  const lessonsFor = (sid) => C.lessons.filter((l) => lessonGrades(l).includes(grade) && l.standards.includes(sid));
  const grades = Object.values(C.bands).flat();
  const anchors = C.anchors.map((a) => {
    const stds = C.standards.filter((s) => s.anchor === a.n && s.grade === grade);
    return `<section class="panel"><div class="anchor-h"><h2 style="margin:0">Anchor ${a.n}: ${esc(a.name)}</h2>${a.nyName ? `<span class="muted">NY: ${esc(a.nyName)}</span>` : ''}<span class="proc">${esc(a.process)} · ${esc(a.component)}</span></div>
      ${a.enduringUnderstanding ? `<p class="muted" style="margin-top:6px"><strong>Enduring understanding:</strong> ${fmt(a.enduringUnderstanding)}</p>` : ''}
      ${stds.map((s) => {
        const sid = s.code.replace(/^MU:([A-Za-z]{2}\d+\.\d+)\.(PK|K|\d+)([a-z]?)$/, '$1$3');
        const ls = lessonsFor(sid);
        const ts = [...new Set(ls.flatMap((l) => l.tools))];
        const fw = s.ncas && s.ny ? '' : `<span class="chip">${s.ny ? 'NY only' : 'National only'}</span>`;
        const txt = s.text && s.nyText && s.nyText !== s.text
          ? `${fmt(s.text)}<br><span class="muted"><strong>NY:</strong> ${fmt(s.nyText)}</span>`
          : fmt(s.text || s.nyText);
        return `<div class="std-row"><div><code>${esc(s.code)}</code> ${fw}</div><div>${txt}</div>
          <div class="uses">${ls.length ? `<div class="chips">${ts.map((id) => { const t = tool(id); return `<a class="chip" href="#/tool/${esc(id)}">${esc(t.name)}</a>`; }).join('')}</div>
          <p class="muted" style="margin:6px 0 0">Lessons: ${ls.map((l) => `<a href="#/lesson/${esc(l.id)}">${esc(l.title)}</a>`).join(' · ')}</p>` : '<span class="muted">Not targeted by a lesson in this band yet; see the tips in the Resources section.</span>'}</div></div>`;
      }).join('')}</section>`;
  }).join('');

  // crosswalk: tools x anchors (number of lessons in this band)
  const matrix = `<div class="table-wrap"><table class="matrix"><thead><tr><th>Tool</th>${C.anchors.map((a) => `<th title="${esc(a.name)}">${a.n}</th>`).join('')}</tr></thead><tbody>${
    C.tools.map((t) => {
      const ls = C.lessons.filter((l) => l.band === band && l.tools.includes(t.id));
      if (!ls.length) return '';
      return `<tr><td><a href="#/tool/${esc(t.id)}">${esc(t.name)}</a></td>${C.anchors.map((a) => {
        const n = ls.filter((l) => l.standards.some((sid) => anchorOf(sid)?.n === a.n)).length;
        return `<td>${n ? `<span class="dot" title="${n} lesson(s)">${n}</span>` : ''}</td>`;
      }).join('')}</tr>`;
    }).join('')}</tbody></table></div>`;

  return `
  <h1>Standards map</h1>
  <p class="lead">Every National Core Arts Standard and New York State performance indicator for general music, grade by grade, with the Music Lab tools and lessons that teach it.</p>
  <div class="filters no-print"><div class="seg" role="group" aria-label="Grade">${grades.map((g) => `<button type="button" data-grade="${g}" aria-pressed="${g === grade}">${g === 'K' ? 'K' : 'Gr ' + g}</button>`).join('')}</div>
  <button class="btn ghost small" type="button" onclick="window.print()">Print grade ${esc(grade)}</button></div>
  <div class="note">${fmt(C.nyNotes)}</div>
  <h2>Crosswalk: tools × anchor standards (grades ${esc(band)})</h2>
  <p class="muted">Numbers = lessons in the ${esc(band)} band that use the tool and address that anchor. 1-3 Creating · 4-6 Performing · 7-9 Responding · 10-11 Connecting.</p>
  ${matrix}
  <h2>Grade ${esc(grade)} standards</h2>
  ${anchors}
  <details class="no-print"><summary>Sources</summary><ul>${C.standardsSources.map((s) => `<li>${link(s.url, s.title)}${s.note ? ` — ${esc(s.note)}` : ''}</li>`).join('')}</ul></details>`;
}

function bindStandards() {
  document.querySelectorAll('[data-grade]').forEach((b) => b.addEventListener('click', () => {
    history.replaceState(null, '', '#/standards?grade=' + b.dataset.grade);
    render();
  }));
}

function viewTools() {
  return `<h1>Tools</h1><p class="lead">What each Music Lab tool is good for in class, with its lessons and the standards they reach.</p>
  <div class="grid">${C.tools.map((t) => {
    const n = C.lessons.filter((l) => l.tools.includes(t.id)).length;
    return `<a class="card" href="#/tool/${esc(t.id)}"><div class="top"><h3>${esc(t.name)}</h3><span class="emoji">${esc(t.emoji)}</span></div>
      <p>${fmt(t.summary)}</p><div class="chips">${t.bands.map(bandChip).join('')}${t.skills.map(skillChip).join('')}</div><div class="meta">${n} lesson${n === 1 ? '' : 's'}</div></a>`;
  }).join('')}</div>`;
}

function viewTool(id) {
  const t = tool(id);
  if (!t) return `<h1>Tool not found</h1>`;
  const ls = C.lessons.filter((l) => l.tools.includes(id));
  const sids = [...new Set(ls.flatMap((l) => l.standards))].sort();
  return `<div class="crumbs"><a href="#/tools">Tools</a> › ${esc(t.name)}</div>
  <div class="lesson-head"><div><h1>${esc(t.name)}</h1><div class="chips">${t.bands.map(bandChip).join('')}${t.skills.map(skillChip).join('')}</div></div>
  <div class="actions"><a class="btn" href="${esc(t.url)}" target="_blank" rel="noopener">Open ${esc(t.name)} ↗</a></div></div>
  <p class="lead" style="margin-top:12px">${fmt(t.summary)}</p>
  <div class="cols">
    <div class="panel"><h2>What students do</h2>${list(t.features)}</div>
    <div class="panel"><h2>Teaching tips</h2>${list(t.tips)}${t.data ? `<h3>Saving &amp; privacy</h3><p>${fmt(t.data)}</p>` : ''}</div>
  </div>
  <h2>Lessons</h2><div class="grid">${ls.map(lessonCard).join('')}</div>
  <h2>Standards these lessons reach</h2><div class="chips">${sids.map((s) => `<span class="chip std">${esc(s)}</span>`).join('')}</div>`;
}

function viewSequence(q) {
  const band = q.get('band') || 'K-3';
  const units = C.units.filter((u) => u.band === band);
  return `<h1>Scope &amp; sequence</h1>
  <p class="lead">Units for grades ${esc(band)} in a suggested teaching order, each building on the last. Pace them to fit your own calendar; the “Also in this unit” lists give singing, instrument and listening work to fill out each one.</p>
  <div class="filters no-print"><div class="seg" role="group" aria-label="Grade band">${['K-3', '4-6'].map((b) => `<button type="button" data-seqband="${b}" aria-pressed="${b === band}">Grades ${b}</button>`).join('')}</div>
  <button class="btn ghost small" type="button" onclick="window.print()">Print</button></div>
  ${units.map((u, i) => `<section class="panel unit" style="--c:${C.skills[u.skill]?.color || '#fbbf24'}">
    <div class="lesson-head"><h2 style="margin:0">Unit ${i + 1}: ${esc(u.title)}</h2></div>
    <p style="margin-top:8px">${fmt(u.big)}</p>
    <div class="cols">
      <div><h4>Lessons in order</h4><ol>${u.lessons.map((id) => { const l = lesson(id); return `<li><a href="#/lesson/${esc(id)}">${esc(l.title)}</a> <span class="muted">(Gr ${esc(l.grades)}, ${esc(tool(l.tools[0]).name)})</span></li>`; }).join('')}</ol></div>
      <div><h4>Also in this unit</h4>${list(u.also)}<h4>Culminating task</h4><p>${fmt(u.culminating)}</p></div>
    </div></section>`).join('')}
  <div class="panel"><h2>Grade-by-grade emphasis</h2>${blocks(C.resources.find((r) => r.id === 'grade-emphasis')?.body)}</div>`;
}

function bindSequence() {
  document.querySelectorAll('[data-seqband]').forEach((b) => b.addEventListener('click', () => {
    history.replaceState(null, '', '#/sequence?band=' + b.dataset.seqband);
    render();
  }));
}

function viewResources() {
  const groups = [...new Set(C.resources.map((r) => r.group))];
  return `<h1>Resources</h1><p class="lead">Printables, checklists and background for teaching with the Music Lab.</p>
  ${groups.map((g) => `<h2>${esc(g)}</h2><div class="grid">${C.resources.filter((r) => r.group === g).map((r) => `
    <a class="card" href="#/resource/${esc(r.id)}"><div class="top"><h3>${esc(r.title)}</h3><span class="emoji">${esc(r.icon || '📄')}</span></div><p>${fmt(r.summary)}</p></a>`).join('')}</div>`).join('')}`;
}

function viewResource(id) {
  const r = C.resources.find((x) => x.id === id);
  if (!r) return `<h1>Not found</h1>`;
  return `<div class="crumbs no-print"><a href="#/resources">Resources</a> › ${esc(r.title)}</div>
  <div class="print-only"><strong>Mr. Arthur's Music Lab</strong> · mrarthurmusic.com</div>
  <div class="lesson-head"><h1>${esc(r.title)}</h1><div class="actions no-print"><button class="btn ghost" type="button" onclick="window.print()">Print</button></div></div>
  <p class="lead">${fmt(r.summary)}</p>
  <div class="panel">${blocks(r.body)}</div>`;
}

// ---------- shell + router ----------
const NAV = [['#/', 'Home'], ['#/lessons', 'Lessons'], ['#/sequence', 'Scope & sequence'], ['#/standards', 'Standards map'], ['#/tools', 'Tools'], ['#/resources', 'Resources']];

function parse() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}

function render(keepFocus = false) {
  const { parts, q } = parse();
  const [page, id] = parts;
  let html;
  let title = '';
  switch (page) {
    case 'lessons': html = viewLessons(q); title = 'Lessons'; break;
    case 'lesson': html = viewLesson(id); title = lesson(id)?.title || 'Lesson'; break;
    case 'standards': html = viewStandards(q); title = 'Standards map'; break;
    case 'tools': html = viewTools(); title = 'Tools'; break;
    case 'tool': html = viewTool(id); title = tool(id)?.name || 'Tool'; break;
    case 'sequence': html = viewSequence(q); title = 'Scope & sequence'; break;
    case 'resources': html = viewResources(); title = 'Resources'; break;
    case 'resource': html = viewResource(id); title = C.resources.find((r) => r.id === id)?.title || 'Resource'; break;
    default: html = viewHome();
  }
  const active = '#/' + (page === 'lesson' ? 'lessons' : page === 'tool' ? 'tools' : page === 'resource' ? 'resources' : page || '');
  const focused = keepFocus ? document.activeElement?.name : null;
  app.innerHTML = `
    <div class="topbar no-print"><a class="brand" href="#/">Music Lab <b>Curriculum</b> <span>for educators</span></a>
</div>
    <nav class="nav no-print" aria-label="Curriculum sections">${NAV.map(([href, label]) => `<a href="${href}"${href === active || (href === '#/' && active === '#/') ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('')}</nav>
    <div id="view">${html}</div>
    <p class="footer-note">Built for Mr. Arthur's Music Lab (mrarthurmusic.com) · curriculum version ${esc(C.builtAt)}</p>`;
  document.title = `${title ? title + ' · ' : ''}For Educators · Mr. Arthur's Music Lab`;
  bindLessonFilters();
  bindStandards();
  bindSequence();
  if (focused) {
    const el = document.querySelector(`#lessonFilters [name="${focused}"]`);
    if (el) { el.focus(); if (el.type === 'search') el.setSelectionRange(el.value.length, el.value.length); }
  } else {
    window.scrollTo(0, 0);
  }
}

function start() {
  window.addEventListener('hashchange', () => render());
  render();
  app.focus({ preventScroll: true });
}

load();
