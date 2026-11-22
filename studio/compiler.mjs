// Pure, browser-compatible planning and compilation. Only enumerated decisions reach CSS.
const profiles = {
  program: {
    title: 'Founder Studio', label: 'Founder program', section: 'Program guide',
    intro: 'Turn a company idea into something you can put in front of customers.',
    entries: [
      ['The starting point', 'Describe the customer and the problem in one sentence.'],
      ['Work in progress', 'Bring a prototype, an interview, or an experiment you want to run.'],
      ['Your next milestone', 'Choose one result that would make the next round of work worthwhile.']
    ]
  },
  portfolio: {
    title: 'Studio Folio', label: 'Studio portfolio', section: 'Inside the practice',
    intro: 'Explore the decisions behind the work, from the first study to the finished piece.',
    entries: [
      ['Material studies', 'Follow an idea through variations in surface, colour, and form.'],
      ['Process notes', 'See how a constraint changes the direction of a piece.'],
      ['Project enquiries', 'Prepare a short outline of your idea, intended use, and timeline.']
    ]
  },
  food: {
    title: 'Kitchen Journal', label: 'Kitchen notebook', section: 'At the table',
    intro: 'Keep ingredients, preparation notes, and serving ideas together for the next meal.',
    entries: [
      ['Seasonal ingredients', 'Start with what is in season and note a substitution for each ingredient.'],
      ['Prep list', 'Group the chopping, measuring, and cooking steps in the order you need them.'],
      ['Serving notes', 'Record portions and finishing touches while the dish is fresh in mind.']
    ]
  },
  event: {
    title: 'After Hours', label: 'Event guide', section: 'Plan your visit',
    intro: 'Find your way through the gathering, from the first introduction to the closing conversation.',
    entries: [
      ['Arrive & explore', 'Look through the programme and pick the session you want to join.'],
      ['Meet the room', 'Bring a question to start a conversation between sessions.'],
      ['Take it further', 'Set aside time to exchange notes with the people you meet.']
    ]
  },
  library: {
    title: 'Field Notes', label: 'Reference collection', section: 'Reading room',
    intro: 'Collect the ideas worth returning to and keep a shortlist for your next project.',
    entries: [
      ['A study in scale', 'Compare one oversized headline with a quiet line of supporting type.'],
      ['Edges & margins', 'Look at the spaces between objects before changing their size.'],
      ['Index of details', 'Keep the detail you want to revisit alongside a note about its use.']
    ]
  },
  project: {
    title: 'Project Desk', label: 'Project notebook', section: 'Work list',
    intro: 'Break the work into small decisions and keep the next step close at hand.',
    entries: [
      ['Define the outcome', 'Write down what someone should be able to do when this project is ready.'],
      ['Build a first pass', 'Pick the smallest version of the main workflow and try it end to end.'],
      ['Review the details', 'Walk through the result and record one concrete improvement.']
    ]
  }
};

const palettes = { rust: '#a43c26', red: '#af2635', blue: '#184a99', green: '#235a43', purple: '#674184', orange: '#ab4a13', teal: '#166468', pink: '#a93666', black: '#252522' };
const clean = (value, limit) => typeof value === 'string' ? value.slice(0, limit).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim() : '';
const escape = value => clean(value, 512).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const directions = ['editorial', 'index'];
const titleCase = s => s.charAt(0).toUpperCase() + s.slice(1);
function namedTitle(s) {
  return clean(s.replace(/^["“']|["”'.!]$/g, ''), 100);
}

function referenceDecision(ref, plan, brief) {
  const tags = (Array.isArray(ref?.tags) ? ref.tags : []).slice(0, 32).map(t => clean(t, 64).toLowerCase());
  const note = [clean(ref?.title, 120), ...tags, clean(ref?.adaptation, 1000)].join(' ').toLowerCase();
  const id = clean(ref?.id, 256);
  if (!id) return null;
  const overlap = tags.filter(t => t && brief.toLowerCase().includes(t)).length;
  let feature, rationale, priority = 0;
  if (plan.profile === 'program' && plan.kind === 'landing' && /founder|accelerator/.test(note) && /application|eligibility|onboarding/.test(note)) {
    feature = 'eligibility'; rationale = 'Put eligibility and Apply ahead of program details'; priority = 8;
  } else if (plan.kind === 'app' && /search|filter/.test(note)) {
    feature = /search/.test(note) ? 'search' : 'filter';
    rationale = feature === 'search' ? 'Search entry titles and notes in place' : 'Filter the list to a personal shortlist';
  } else if (/navigation|index|contents/.test(note)) {
    feature = 'contents'; rationale = 'Give the collection a compact jump link in the masthead';
  } else if (/hierarchy|typography|headline|poster/.test(note)) {
    feature = 'display'; rationale = 'Set the title as a large display line above a separate logistics band';
  } else if (/onboarding|preview|progressive|disclosure/.test(note)) {
    feature = 'preview'; rationale = 'Open the first entry to show how to explore the collection';
  } else return null;
  return { id, feature, rationale, source: clean(ref.title, 100) || id, score: priority + overlap };
}

function finish(plan) {
  const composition = plan.direction === 'editorial' ? 'A broad opening spread leads into the collection.' : 'A narrow introduction sits beside a ruled index.';
  const applied = plan.decisions.filter(d => !['search','filter'].includes(d.feature) || plan[d.feature]);
  return { ...plan, referenceIds: applied.map(d => d.id),
    mechanism: [composition, ...applied.map(d => d.source + ' — ' + d.rationale + '.')].join(' '),
    suggestion: plan.kind === 'app' && !plan.search ? 'Add search' : 'Switch to the ' + (plan.direction === 'index' ? 'editorial' : 'index') + ' layout' };
}

function revise(previous, brief, direction) {
  const p = { ...previous };
  const request = brief.replace(/^please\s+/i, '').replace(/[.!]$/, '').trim();
  const rename = /^(?:rename (?:it|this|the (?:app|page|site)) to|(?:set|change) (?:the )?(?:title|name)(?: to)?|call it)\s+(.+)$/i.exec(request);
  const layout = /^(?:(?:switch|change|set)(?: the (?:layout|direction))? to |use |make it )?(?:the |an? )?(editorial|index)(?: layout| direction)?$/i.exec(request);
  const color = /^(?:(?:set|change|make|use)(?: the)?(?: accent(?: colou?r)?| colou?r| palette| it)?(?: to)? )?(#[a-f\d]{6}|[a-z]+)(?: accent)?$/i.exec(request)?.[1].toLowerCase();
  const control = /^(add|enable|show|remove|disable|hide) (?:the |a )?(search|filters?)(?: bar)?$/i.exec(request);
  if (rename && namedTitle(rename[1])) p.title = namedTitle(rename[1]);
  else if (layout) p.direction = layout[1].toLowerCase();
  else if (color && (Object.hasOwn(palettes, color) || color.startsWith('#'))) p.accent = palettes[color] ?? color;
  else if (control && p.kind === 'app') p[control[2].toLowerCase().startsWith('filter') ? 'filter' : 'search'] = /^(add|enable|show)$/i.test(control[1]);
  else if (!(direction && (!request || request === previous.brief))) throw new RangeError('Unsupported revision. Try “Set title to Field Notes”, “Make the accent blue”, “Switch to the index layout”' + (p.kind === 'app' ? ', “Add search”, or “Remove filter”.' : '.'));
  if (direction && !layout) p.direction = direction;
  return finish(p);
}

export function planBuild({ brief, refs = [], previous = null, direction } = {}) {
  brief = clean(brief, 2400);
  if (direction != null && !directions.includes(direction)) throw new RangeError('Choose editorial or index.');
  if (previous) return revise(previous, brief, direction);
  if (!brief) throw new TypeError('Describe the page or application to build.');
  const kind = /\b(landing|homepage|home page)\b/i.test(brief) ? 'landing'
    : /\b(app|application|dashboard|tracker|manager|workspace|tool|organizer|catalog|directory)\b/i.test(brief) ? 'app' : 'landing';
  const profile = /\b(founders?|startups?|accelerator)\b/i.test(brief) ? 'program'
    : /\b(event|festival|meetup|concert|conference|after hours|gathering)\b/i.test(brief) ? 'event'
    : /\b(portfolio|photography|ceramics|artist|creative studio|design studio)\b/i.test(brief) ? 'portfolio'
    : /\b(recipe|recipes|food|cooking|kitchen|bakery)\b/i.test(brief) ? 'food'
    : /\b(task|tasks|projects?|tracker|workflow|planning)\b/i.test(brief) ? 'project' : 'library';
  const subject = brief.match(/\bfor (.+?)(?:\s+(?:with|that|using|featuring)\b|[.,;!?]|$)/i)?.[1];
  const explicit = brief.match(/\b(?:named|called|titled)\s+["“]([^"”]+)["”]/i)?.[1]
    ?? brief.match(/\b(?:named|called|titled)\s+(.+?)(?:\s+(?:for|with|that|using)\b|[.,;!?]|$)/i)?.[1];
  const title = namedTitle(explicit || (subject && titleCase(subject.replace(/^(?:an? |the )/i,''))) || profiles[profile].title);
  const p = { brief, title, kind, profile, direction: direction ?? (kind === 'landing' ? 'editorial' : 'index'),
    accent: profile === 'program' ? palettes.green : palettes.rust, search: false, filter: false };
  const ranked = (Array.isArray(refs) ? refs : []).slice(0,128).map(r => referenceDecision(r, p, brief)).filter(Boolean).sort((a,b) => b.score - a.score);
  p.decisions = [];
  for (const d of ranked) {
    if (!p.decisions.some(other => other.id === d.id || other.feature === d.feature)) p.decisions.push(d);
    if (p.decisions.length === 3) break;
  }
  p.search = kind === 'app' && (/\bsearch/i.test(brief) || p.decisions.some(d => d.feature === 'search'));
  p.filter = kind === 'app' && (/\bfilter/i.test(brief) || p.decisions.some(d => d.feature === 'filter'));
  return finish(p);
}

const runtime = `(() => {
  const byId = id => document.getElementById(id);
  const list = byId('entries');
  const query = byId('search');
  const onlySaved = byId('only-saved');
  const status = byId('result');
  function refresh() {
    const term = (query?.value || '').trim().toLowerCase();
    let count = 0;
    for (const row of list.children) {
      const matches = row.querySelector('details').textContent.toLowerCase().includes(term);
      row.hidden = !matches || Boolean(onlySaved?.checked && row.dataset.saved !== 'true');
      if (!row.hidden) count++;
    }
    status.textContent = count ? count + (count === 1 ? ' entry' : ' entries') : 'No matching entries. Try another search or show all entries.';
  }
  if (byId('new-entry')) {
    const input = byId('new-entry');
    const add = () => {
      const name = input.value.trim();
      if (!name) {
        input.setCustomValidity('Give the entry a title.');
        input.reportValidity();
        input.focus();
        return;
      }
      const row = byId('entry-template').content.firstElementChild.cloneNode(true);
      row.querySelector('summary').textContent = name;
      list.prepend(row);
      if (query) query.value = '';
      if (onlySaved) onlySaved.checked = false;
      input.value = '';
      refresh();
      row.querySelector('summary').focus();
    };
    byId('add').addEventListener('click', add);
    input.addEventListener('input', () => input.setCustomValidity(''));
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) add(); });
    query?.addEventListener('input', refresh);
    onlySaved?.addEventListener('change', refresh);
    list.addEventListener('click', e => {
      const button = e.target.closest('button');
      if (!button) return;
      const row = button.closest('li');
      const saved = row.dataset.saved !== 'true';
      row.dataset.saved = String(saved);
      button.setAttribute('aria-pressed', String(saved));
      refresh();
      if (row.hidden) onlySaved.focus();
    });
    refresh();
  }
  const apply = byId('apply');
  if (apply) {
    const panel = byId('application');
    apply.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      apply.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) byId('pitch').focus();
    });
    byId('prepare').addEventListener('click', () => {
      const pitch = byId('pitch');
      if (!pitch.value.trim()) {
        byId('draft').textContent = 'Describe your idea before preparing the draft.';
        pitch.focus();
        return;
      }
      byId('draft').textContent = 'Application draft · ' + pitch.value.trim();
    });
  }
})();`;

// Host this document with <iframe sandbox="allow-scripts" srcdoc="…">.
const policy = "default-src 'none'; base-uri 'none'; form-action 'none'; style-src 'unsafe-inline'; script-src 'sha256-eBNXttFX314RJ0kIN+oGx5i1sDeC3cn3UNW7QNC+P30='";
const style = `
*{box-sizing:border-box}
:root{color-scheme:light;font:16px/1.55 system-ui,sans-serif;color:#22251e;background:#f8f6ee}
body{margin:0;overflow-wrap:anywhere}
main{max-width:76rem;margin:auto;padding:0 clamp(1.1rem,5vw,5rem) 5rem}
header,.band,.tools,.entry,.compose{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
header{min-height:4rem;border-bottom:2px solid;justify-content:space-between;font-weight:650}
header span:before{content:'';display:inline-block;width:.7em;height:.7em;background:var(--accent);margin-right:.65em;transform:rotate(-12deg)}
a{color:inherit;text-underline-offset:.24em}
h1,h2,p{margin:0}
h1{font:normal clamp(3.2rem,8vw,8rem)/.92 Georgia,serif;letter-spacing:-.065em;max-width:14ch}
h2{font:normal clamp(1.7rem,3vw,2.7rem)/1.12 Georgia,serif;letter-spacing:-.04em}
.hero{padding:clamp(2.5rem,7vw,6.5rem) 0 2.5rem}
.hero p{max-width:46ch;font-size:1.15rem;margin:1.4rem 0}
button,input,textarea,summary{font:inherit}
button,.action{min-height:44px;cursor:pointer;border:1px solid currentColor;border-radius:0;padding:.65rem 1rem;font-weight:650;text-decoration:none;display:inline-block}
.action{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
button{background:transparent;color:inherit}
button[aria-pressed=true]{background:#252820;color:white}
:focus-visible{outline:3px solid #224ca8;outline-offset:3px}
.band{border-block:1px solid;padding:1rem 0;justify-content:space-between}
small,header,.band p{font:600 .82rem/1.45 system-ui,sans-serif;letter-spacing:.035em}
ol{list-style:none;padding:0;margin:0;counter-reset:record}
.entry{counter-increment:record;padding:1.1rem 0;border-bottom:1px solid #b2b2a4;flex-wrap:nowrap;align-items:baseline}
.entry:before{content:counter(record,decimal-leading-zero);font:.8rem ui-monospace,monospace;color:#505347}
.entry details{min-width:0;flex:1}
summary{cursor:pointer;padding:.5rem 0;font-weight:650}
.entry p{max-width:52ch;padding:.35rem 0 .65rem}
.tools,.compose{padding:1rem 0;align-items:end}
label{display:grid;gap:.3rem;min-width:0;font-size:.9rem;font-weight:600}
label:has([type=checkbox]){display:flex;align-items:center;min-height:44px}
input:not([type=checkbox]),textarea{min-width:0;width:100%;max-width:32rem;border:1px solid #777b70;background:#fffef9;color:#22251e;padding:.65rem}
textarea{min-height:6rem}
[hidden]{display:none!important}
#result{font-size:.9rem}
#application{max-width:36rem;margin:1.4rem 0}
#application button{margin-top:.6rem}
#application output{display:block;margin-top:.7rem;white-space:pre-line}
.eligibility{border-inline-start:3px solid var(--accent);padding-left:1rem}
.display h1{font-size:clamp(4rem,10vw,9rem)}
.index .page{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);gap:clamp(2rem,5vw,5rem);padding-top:3rem}
.index .hero{padding:0}
.index h1{font:700 clamp(2.6rem,5vw,5rem)/.98 system-ui,sans-serif;letter-spacing:-.06em}
.index .band{border-top:4px solid var(--accent)}
.editorial .hero{position:relative;padding-right:32%}
.imprint{position:absolute;right:3%;top:24%;width:20%;aspect-ratio:1.32;transform:rotate(-8deg);color:var(--accent);pointer-events:none}
.imprint i{position:absolute;inset:0;border:2px solid;border-radius:50%;transform:rotate(-40deg)}
.imprint i:nth-child(2){transform:rotate(20deg)}
.imprint i:nth-child(3){transform:rotate(80deg)}
@media(max-width:380px){.display h1{font-size:clamp(2.4rem,13vw,3rem)}}
@media(max-width:700px){.index .page{display:block;padding-top:2rem}.index .hero{padding-bottom:2rem}.editorial .hero{padding-right:0}.imprint{display:none}.entry{gap:.55rem}.entry button{padding-inline:.65rem}.compose label{width:100%}}
`;

function readableInk(hex) {
  const [r,g,b] = hex.match(/[\da-f]{2}/gi).map(pair => {
    const x = parseInt(pair,16) / 255;
    return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
  });
  return .2126*r + .7152*g + .0722*b > .179 ? '#000' : '#fff';
}

function entry(title, note, app, open) {
  return `<li class="entry"><details${open ? ' open' : ''}><summary>${escape(title)}</summary><p>${escape(note)}</p></details>${app ? '<button type="button" aria-pressed="false">Shortlist</button>' : ''}</li>`;
}

const application = `<button type="button" class="action" id="apply" data-primary aria-controls="application" aria-expanded="false">Apply</button>
<section id="application" hidden><h2>Prepare your application</h2><p>This draft stays in this preview. Copy the text to keep it.</p>
<label for="pitch">What are you building, and for whom?</label><textarea id="pitch" required maxlength="2000"></textarea>
<button type="button" id="prepare">Prepare draft</button><output id="draft" aria-live="polite"></output></section>`;
const composer = `<details><summary class="action" data-primary>Add an entry</summary><div class="compose">
<label>Entry title<input id="new-entry" maxlength="120" autocomplete="off"></label><button type="button" id="add">Add to list</button></div>
<small>Entries and shortlist selections stay in this preview session.</small></details>`;

export function compileArtifact(plan) {
  const { title, kind, direction, accent, profile } = plan;
  if (!directions.includes(direction) || !['app','landing'].includes(kind) ||
      !Object.hasOwn(profiles,profile) || typeof accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(accent) ||
      !clean(title,100)) throw new TypeError('Invalid artifact plan.');
  const content = profiles[profile];
  const has = feature => plan.decisions.some(d => d.feature === feature);
  const app = kind === 'app';
  const eligibility = !app && profile === 'program' && has('eligibility');
  const action = app ? composer : eligibility ? application : `<a data-primary class="action" href="#collection">Explore the ${profile === 'event' ? 'programme' : 'guide'} ↓</a>`;
  const controls = app ? `<div class="tools">${plan.search ? '<label>Search entries<input id="search" type="search"></label>' : ''}${plan.filter ? '<label><input type="checkbox" id="only-saved"> Shortlisted only</label>' : ''}<output id="result" aria-live="polite"></output></div>` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title><style>:root{--accent:${accent};--on-accent:${readableInk(accent)}}${style}</style></head>
<body class="${direction}${has('display') ? ' display' : ''}"><main>
<header><span>${content.label}</span>${has('contents') ? `<a href="#collection">${content.section} ↓</a>` : ''}</header>
<div class="page"><section class="hero"><h1>${escape(title)}</h1>
${direction === 'editorial' ? '<span class="imprint" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}
<p>${content.intro}</p>${eligibility ? '<p class="eligibility"><strong>Who it’s for</strong><br>Founders working on a startup idea or early product.</p>' : ''}${action}</section>
<section id="collection" tabindex="-1" aria-labelledby="section-title"><div class="band"><h2 id="section-title">${content.section}</h2>${app ? '<small>Session notebook</small>' : ''}</div>
${controls}<ol id="entries">${content.entries.map(([name,note],i) => entry(name,note,app,!i && has('preview'))).join('')}</ol>
${app ? `<template id="entry-template">${entry('', 'Added in this session.', true, false)}</template>` : ''}</section></div></main><script>${runtime}</script></body></html>`;
}

export function verifyArtifact(html, plan) {
  const checks = [];
  function check(condition, message) {
    if (!condition) throw new Error('Artifact verification failed — ' + message);
    checks.push(message);
  }
  check(typeof html === 'string' && html === compileArtifact(plan), 'HTML matches the bounded compiler output for this plan');
  check(html.includes('content="' + policy + '"') && html.split('<script>').length === 2 && html.includes('<script>' + runtime + '</script>'), 'Network access blocked by policy and only the fixed local script present');
  check(html.includes('<h1>' + escape(plan.title) + '</h1>') && html.includes('data-primary'), 'Planned title and primary control present');
  check(html.includes('name="viewport"') && html.includes('@media(max-width:700px)'), 'Viewport and narrow-screen layout rules present');
  return checks;
}
