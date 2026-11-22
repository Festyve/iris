import {Doc, design} from '../designer.mjs';
import Screens from '../screen-spec.cjs';
import {planBuild} from '../studio/compiler.mjs';

const index = {id:'index', label:'Ruled index', source:'Swiss Grid', feature:'Align section names in a single numbered column with fine horizontal rules.'};
const spread = {id:'spread', label:'Opening spread', source:'Editorial and Luxury', feature:'Lead with a large display headline and group related sections across a spread.'};
const clean = (s, max) => typeof s === 'string' && s.trim().length <= max ? s.trim() : '';
const hex = s => /^#[0-9a-f]{6}$/i.test(s) ? s : '';


function field(note, key) {
  return note.match(new RegExp('\\b(?:'+key+')\\s*(?:is\\b|of\\b|:|=)?\\s*["“]([^"”]+)["”]', 'i'))?.[1]
    || note.match(new RegExp('\\b(?:'+key+')\\s*[:=]\\s*([^.;\\n]+)', 'i'))?.[1]?.trim();
}

function sections(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(v => clean(v, 60)).filter(Boolean))].slice(0,6);
}

const sectionNotes = new Map([
  ['Programme','Choose a session and plan the order of your visit.'],
  ['Observation guide','Choose a target and follow its path from rise to set.'],
  ['Sky conditions','Check cloud cover and moonlight before heading out.'],
  ['Viewing location','Look for an open horizon away from bright lights.'],
  ['Speakers','Explore the people behind the programme.'],
  ['Venue','Find arrival information before you set out.'],
  ['Eligibility','Check who can take part before applying.'],
  ['Applications','Prepare your materials for submission.'],
  ['Selected work','Explore individual projects and the decisions behind them.'],
  ['Practice','Read about the methods and materials behind the work.'],
  ['Enquiries','Start a conversation about a project.']
]);

export function planBrief(note, style) {
  if (typeof note !== 'string' || !note.trim() || note.length > 1500) throw Object.assign(Error('Enter a brief of up to 1500 characters.'), {status:400});
  const base = planBuild({brief:note});
  const app = base.kind === 'app';
  const audience = clean(note.match(/\bfor\s+(.+?)(?=\s+(?:to|with|named|called|who|that|featuring|including)\b|[.,;!\n]|$)/i)?.[1],80);
  const openingName = note.match(/^(?:(?:build|create|design|make)\s+)?["“]?([A-Z][\w -]{0,48}?)["”]?,\s+(?:an?|the)\s/i)?.[1];
  const title = field(note,'title|name') || openingName || (/\b(?:named|called|titled)\s/i.test(note) ? base.title : '');
  const explicitSections = sections((field(note,'sections?') || note.match(/\b(?:including|with sections for|with sections on|include|with)\s+([^.;\n]+)/i)?.[1] || '').split(/,\s*(?:and\s+)?|\s+and\s+/i));
  const primaryAction = field(note,'primary action|cta|button') || note.match(/\b(?:to|can)\s+((?:book|apply|join|reserve|track|add|create|schedule|save|browse|order|register|review)\b[^.,;!\n]*?)(?=\s+(?:and|with|including)\b|[.,;!\n]|$)/i)?.[1];
  const explicit = {title:clean(title,60),headline:clean(field(note,'headline'),120),primaryAction:clean(primaryAction,60),sections:explicitSections,accent:note.match(/#[0-9a-f]{6}\b/i)?.[0]};
  const styleName = style?.id || style?.name || style || '';
  const recommended = /atelier/i.test(styleName) ? 'spread' : app || /grid|ledger/i.test(styleName) ? 'index' : 'spread';
  const directions = [spread,index].map(({id,label,feature}) => ({id,label,reason:feature}));
  const visual = /observator|astronom|telescope|planetarium|stargaz/i.test(note) ? 'trajectory'
    : base.profile === 'event' ? 'programme' : app ? 'tracker' : 'guide';
  return {kind:base.kind,visual,title:explicit.title || base.title,audience,explicit,directions,recommended,
    references:[spread,index].map(({id,source,feature}) => ({direction:id,source,feature})),
    defaults: visual === 'trajectory' ? ['Observation guide','Sky conditions','Viewing location'] : app ? ['Inbox','In progress','Completed'] : ({
      event:['Programme','Speakers','Venue'], portfolio:['Selected work','Practice','Enquiries'],
      program:['Eligibility','Programme','Applications'],food:['Menu','Ingredients','Visit']
    }[base.profile] || ['Overview','Details','Contact'])};
}

function addFigure({add,text,parent,plan,labels,indexed,width,accent}) {
  const titles = {trajectory:'Illustrative sky track', programme:'Sample programme', tracker:'Sample activity', guide:'Reading guide'};
  const night = plan.visual === 'trajectory';
  const figure = add('figure','frame',parent,{name:titles[plan.visual],w:'fill',pad:20,gap:16,fill:night?'#182439':'#E5E9DD'});
  text('figure-title',figure,titles[plan.visual],19,700,night?'#FFFFFF':'#223A2F');
  if (night) {
    const plotWidth = width-40;
    const plot = add('sky','frame',figure,{name:'Sky above the horizon',layout:'stack',w:'fill',h:142});
    const points = indexed ? [[0,.86],[.23,.56],[.52,.25],[.75,.15],[1,.12]]
      : [[0,.92],[.2,.5],[.43,.22],[.65,.16],[.81,.23],[1,.44]];
    add('track','line',plot,{name:'Apparent path',x:8,y:5,w:plotWidth-16,h:122,points,stroke:'#A4DCE1',sw:2});
    points.forEach(([x,y],i)=>add('position-'+i,'shape',plot,{name:'Observation position '+(i+1),shape:'ellipse',
      x:4+x*(plotWidth-16),y:1+y*122,w:8,h:8,fill:'#FFE5AB'}));
    add('horizon','shape',plot,{name:'Horizon',x:0,y:138,w:plotWidth,h:1,fill:'#8594AE'});
    text('legend',figure,'Horizon  /  apparent motion across the sky',13,500,'#D0DCE5');
    return;
  }
  if (plan.visual === 'tracker') {
    text('legend',figure,'Earlier → Later     ·     Filled = activity',13,500);
    labels.slice(0,3).forEach((label,i)=>{
      const row = add('series-'+i,'frame',figure,{name:label,layout:'row',gap:8,w:'fill'});
      text('series-label-'+i,row,label,14,600);
      const pattern = ['10111','01101','10010'][i];
      [...pattern].forEach((v,j)=>add('cell-'+i+'-'+j,'shape',row,{name:label+' · '+(v==='1'?'Activity':'No activity'),
        w:14,h:14,fill:v==='1'?'#305748':'#E5E9DD',stroke:'#687D6E',sw:1}));
    });
    return;
  }
  const programme = plan.visual === 'programme';
  if (programme && !indexed) {
    const slots = add('slots','frame',figure,{name:'Programme sequence',layout:'row',align:'end',gap:6,w:'fill'});
    ['Arrival','Main session','Closing'].forEach((label,i)=>{
      const slot = add('slot-'+i,'frame',slots,{name:label,w:'fill',gap:8});
      text('slot-time-'+i,slot,['09:00','09:30','11:00'][i],width<400?17:25,600);
      add('slot-block-'+i,'shape',slot,{name:label+' session block',w:'fill',h:[28,70,44][i],fill:accent});
      text('slot-label-'+i,slot,label,13,600);
    });
    return;
  }
  const phases = programme ? ['Doors open','Main session','Closing conversation'] : labels.slice(0,3);
  phases.forEach((label,i)=>{
    const row = add('phase-'+i,'frame',figure,{name:label,layout:'row',w:'fill',gap:12});
    add('cue-'+i,'shape',row,{name:programme?'Session block':'Section tab',w:programme?[16,40,28][i]:8,h:programme?24:16,fill:accent});
    if (programme) add('time-'+i,'text',row,{text:['09:00','09:30','11:00'][i],size:14,weight:600});
    text('phase-label-'+i,row,label,16,600);
  });
}

function local(plan, direction, content) {
  const e = plan.explicit;
  const name = e.title || clean(content?.title,60) || plan.title;
  const app = plan.kind === 'app';
  const headline = e.headline || clean(content?.headline,120) || (app ? name + ' workspace' : name);
  const action = e.primaryAction || clean(content?.primaryAction,60) || (app ? 'Add entry' : 'Explore ' + name);
  const accent = e.accent || hex(content?.accent) || (app ? '#275D54' : '#8D352B');
  const items = e.sections.length ? e.sections : sections(content?.sections);
  const labels = items.length ? items : plan.defaults;
  const screens = [], nodes = [];
  for (const [id,w] of [['desktop',1200],['mobile',390]]) {
    const indexed = direction === 'index', mobile = w < 700;
    screens.push({id,name:name+' · '+id,w,h:mobile?1050:900,fill:'#FAF8F2',pad:mobile?24:56,gap:mobile?18:26});
    function add(key,type,parent,props) {
      const node = {id:id+'-'+key,type,parent,...props};
      nodes.push(node);
      return node.id;
    }
    const text = (key,parent,value,size,weight,color='#252823') => add(key,'text',parent,{text:value,size,weight,color,w:'fill'});
    text('masthead',id,plan.audience ? name+'  /  For '+plan.audience : name,16,600);
    add('rule','shape',id,{w:'fill',h:2,fill:accent});
    const split = !mobile && !indexed;
    const hero = add('hero','frame',id,{layout:split?'row':'column',align:'start',w:'fill',gap:26});
    const intro = add('intro','frame',hero,{w:'fill',gap:18});
    text('headline',intro,headline,mobile?36:indexed?48:74,700);
    if (app) {
      const field = add('entry','frame',intro,{pad:14,fill:'#FFFFFF',stroke:'#939B92',sw:1});
      text('entry-label',field,'Search '+name,16,400);
    }
    const button = add('action','frame',intro,{w:mobile?'fill':260,fill:'#252823',pad:14});
    text('action-label',button,action,16,600,'#FFFFFF');
    const body = add('body','frame',id,{layout:indexed && !mobile?'row':'column',align:'start',gap:26,w:'fill'});
    const figureWidth = mobile ? w-48 : (w-112-26)/2;
    addFigure({add,text,parent:indexed?body:hero,plan,labels,indexed,width:figureWidth,accent});
    const list = add('sections','frame',body,{w:'fill',layout:indexed || mobile?'column':'grid',cols:3,gap:indexed?6:16});
    labels.forEach((label,i) => {
      const row = add('section-'+i,'frame',list,{layout:indexed?'row':'column',pad:10,gap:10,w:'fill'});
      add('marker-'+i,'text',row,{text:String(i+1).padStart(2,'0'),size:13,weight:600,color:'#51554F'});
      text('label-'+i,row,label,mobile?18:22,600);
      if (!indexed && !app && sectionNotes.has(label)) {
        text('detail-'+i,row,sectionNotes.get(label),16,400,'#51554F');
      }
      if(indexed) add('divider-'+i,'shape',list,{w:'fill',h:1,fill:'#C6C8BD'});
    });
  }
  const doc = Doc.clean({name,screens,nodes});
  const measured = Doc.compile(doc);
  for (const screen of doc.screens) {
    const layers = measured.screens.find(s=>s.id===screen.id).layers;
    screen.h = Math.max(screen.w < 700 ? 780 : 680,Math.ceil(Math.max(...layers.map(l=>l.y+l.h)))+40);
  }
  Screens.checkBoard(Doc.compile(doc));
  return {doc,summary:'Composed '+name+' for desktop and mobile using '+plan.references.find(r=>r.direction===direction).source+'.'};
}

export async function composeBrief({note,profile,direction,ask,content}) {
  const plan = planBrief(note,profile);
  const selected = direction?.id || direction || plan.recommended;
  const ref = plan.references.find(r=>r.direction===selected);
  if (!ref) throw new RangeError('Choose a direction from planBrief.');
  if (content == null && typeof ask === 'function') {
    try {
      const result = await design(note,ask,{text:'Create original editable desktop and mobile layouts. Use native text and auto-layout frames. Include a content-specific '+plan.visual+' diagram built from editable primitives. Label illustrative data as samples. Omit reference artwork, images, logos and traced shapes. Adapt this feature from '+ref.source+': '+ref.feature});
      Screens.checkBoard(Doc.compile(result.doc));
      if (result.doc.nodes.length && ![...result.doc.nodes,...result.doc.screens].some(n=>n.art || n.points || n.path || n.src || n.vaultSource || n.type==='image' || n.layout==='stack')) return result;
    } catch {
      // A failed provider or malformed response still leaves a locally buildable brief.
    }
  }
  return local(plan,selected,content);
}
