// Retrieval is shared by the local studio and the model-backed designer.
const ReferenceMatch = (() => {
  const topics = {
    'adelfaure':'ascii dither terminal pixel art typewriter personal web illustration',
    animata:'motion animation component library developer toolkit',
    'apple-liquid-glass':'article news press magazine editorial glass luxury publishing',
    emilkowal:'designer writer portfolio minimal resume cv biography writing',
    godly:'inspiration directory gallery discovery photography architecture art museum',
    grainient:'gradient background color wallpaper neon glow',
    gumroad:'creator marketplace shop store sell artist crafts shopping ecommerce books',
    horizonx:'component library coding ui resources developer',
    metalforge:'gallery filters collection catalog lobby games gaming arcade tournaments cards poker casino holdem betting blackjack',
    paco:'journal typography essays minimal dark writer blog',
    poolsuite:'retro music radio summer beach resort vacation travel leisure hotel',
    rauno:'portfolio exhibition design studio creative artist swiss grid',
    raycast:'command shortcuts keyboard search productivity software',
    scrollshaders:'shader motion cinematic effects film video visual',
    scrolltide:'scroll animation ocean water agency motion',
    snapblocks:'blocks scrolling landing page web components',
    stripe:'finance payments bank banking budget fintech money billing investing accounting',
    'teenage-engineering':'electronics synth audio equipment hardware instrument industrial',
    'ui-chords':'sound instrument drum machine tactile mixer controls music',
    uiarc:'agent artificial intelligence react interface saas platform',
    vercel:'developer deploy cloud hosting infrastructure engineering code api',
    'winamp-ui-sdk':'player audio desktop vintage y2k playlist mp3 retro'
  };
  const tokens = text => (String(text).normalize('NFKD').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
  const ignored = new Set(tokens('a an the i me my we want need you please make build create recreate design website web site page landing homepage home for of about to from in with is and it called inspired by like'));
  const terms = s => tokens(s).filter(w=>!ignored.has(w)).map(w=>w.length>4 && w.endsWith('s') ? w.slice(0,-1) : w);
  const score = (query, text) => { const words=new Set(terms(text)); return query.reduce((n,w)=>n+Number(words.has(w)),0); };
  const poker = s => /\b(poker|hold[ ’'-]?em|blackjack|casino|card room)\b/i.test(s);
  const galleryAliases={
    siteinspire:['Site Inspire'],httpster:[],cofolios:[],
    'viewport-ui':['ViewportUI','viewport-ui.design'],designspells:['Design Spells']
  };
  function select(note, media, keys) {
    const query = [...new Set(terms(note))], normalized = ' '+tokens(note).join(' ')+' ';
    const sites = media.filter(m=>m.path.startsWith('assets/sites/') && keys.includes(m.path.slice(13,-4)));
    const relatedTerms = poker(note) ? [...query,'game','pixel'] : query;
    const images = media.filter(m=>!m.path.startsWith('assets/sites/')).map(m=>({m,
      score:score(relatedTerms,m.title)*8+score(relatedTerms,m.tags)*3}));
    const bestImage = [...images].sort((a,b)=>b.score-a.score)[0];
    const ranked = sites.map(s=>{
      const id = s.path.slice(13,-4);
      const named = [id,s.title,...(galleryAliases[id] || []),s.url && s.url.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'')].filter(Boolean)
        .some(alias=>normalized.includes(' '+tokens(alias).join(' ')+' '));
      const visualFit = bestImage?.score > 0 ? Math.min(3,score(terms(bestImage.m.tags),s.tags)) : 0;
      const weight = visualFit + (named ? 100 : 0) + score(query,topics[id] || '')*6 + score(query,s.tags)*2 + (poker(note) && id==='metalforge' ? 16 : 0);
      return {id,site:s,named,weight};
    }).filter(r=>!Object.hasOwn(galleryAliases,r.id) || r.named).sort((a,b)=>b.weight-a.weight || a.id.localeCompare(b.id));
    const match = ranked[0]?.weight ? ranked[0] : ranked.find(r=>r.id==='rauno') || ranked[0];
    if (!match) return null;
    const rankedImages = images.map(({m,score:relevance})=>({m,
      score:relevance+Math.min(2,score(terms(match.site.tags),m.tags))}))
      .sort((a,b)=>b.score-a.score || a.m.path.localeCompare(b.m.path));
    const inspiration = rankedImages.find(r=>r.score>0)?.m;
    const aliasWords = new Set([...tokens(match.id),...tokens((galleryAliases[match.id]||[]).join(' ')),...tokens(match.site.title),...tokens(match.site.url || ''), ...tokens('please can you me exactly the original screen screenshot homepage home page website web site make build design clone copy recreate reproduce rebuild show of from vault template capture as is')]);
    const exact = match.named && tokens(note).every(w=>aliasWords.has(w));
    return {...match, exact, inspiration, fallback:!match.weight};
  }
  function website(note) {
    return /\b(web\s?site|web\s?page|landing|homepage|site|browser|web\s?app|ecommerce|e-commerce|online store|web application)\b/i.test(note) || !/\b(mobile|phone|ios|android|app|watchos|tablet|native)\b/i.test(note);
  }
  return {select, website, poker};
})();
if (typeof module !== 'undefined') module.exports = ReferenceMatch;
