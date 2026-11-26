// Iris Minimal: the general template for custom briefs that no vault capture or original family fits.
// Every brief gets copy written for its kind of product, one coherent palette and three illustrations
// from a single vault family, and a layout variant chosen from the brief itself, so different prompts
// produce different, calm, editable pages instead of the same three fallback captures.
const MinimalPages = (() => {
  const W = 1440, H = 900, M = 72;
  // Subject kits. Copy is written to read well with any product name and no invented facts.
  const kits = [
    {id:'food', test:/\b(food|restaurant|caf[eé]|coffee|bakery|bistro|kitchen|dining|menu|brunch|bar|wine|cocktail|pizza|burger|sushi|ramen|taco|dessert|chocolate|bagel|deli|catering|chef|meal|recipe|grocer|juice|smoothie|tea)\b/i,
      motifs:['vessel','sun','leaf','cafe'], nav:['Menu','Our story','Visit'], eyebrow:'Open daily',
      heads:['Made fresh, every day.','Good food, close to home.','A table worth coming back to.'],
      sub:'{name} keeps things simple: honest ingredients, a short menu and a warm room to enjoy them in.',
      cta:'See the menu', cta2:'Plan a visit',
      items:[['Seasonal menu','Dishes that change with what’s best this week.'],['Made in house','Prepared each morning in our own kitchen.'],['Stay a while','Comfortable seats, good light and no rush.']],
      offer:'Menu', offerSub:'A short list of things we make well, served all day.',
      story:'Our story', storyHead:'Small kitchen, big care.', storyBody:'{name} started with a simple idea: cook the food we love to eat, and serve it the way we’d want it served. Everything else follows from that.',
      principles:[['Fresh','Prepared daily'],['Local','Sourced nearby'],['Simple','Done properly']]},
    {id:'shop', test:/\b(shop|store|boutique|fashion|clothing|apparel|shoes?|sneakers?|jewel(?:le)?ry|accessor(?:y|ies)|bags?|ecommerce|e-commerce|brand|merch|candles?|skincare|cosmetics?|beauty|fragrance|perfume|furniture|decor|homeware)\b/i,
      motifs:['weave','fold','lens','structure'], nav:['Shop','Collections','About'], eyebrow:'New season',
      heads:['Made to be worn often.','Fewer things, better made.','Everyday pieces, considered.'],
      sub:'{name} designs a small, carefully edited collection built to last well beyond a single season.',
      cta:'Shop the collection', cta2:'Our materials',
      items:[['New arrivals','The latest pieces, released in small runs.'],['Best sellers','The ones people come back for.'],['Free returns','Thirty days to decide at home.']],
      offer:'Collection', offerSub:'Each piece is made in limited quantities with materials we trust.',
      story:'About', storyHead:'Designed with intention.', storyBody:'At {name}, every piece starts with a question: will this still be loved in ten years? If not, we don’t make it.',
      principles:[['Considered','Fewer, better pieces'],['Durable','Built to last'],['Fair','Responsibly made']]},
    {id:'tech', test:/\b(ai|software|saas|app|platform|startup|api|developer|devtools?|cloud|data|analytics|automation|agent|security|crypto|web3|blockchain|tool|tools|dashboard|crm|productivity|workflow|code|coding|infrastructure|robot|robotics|tech|technology|machine learning|ml)\b/i,
      motifs:['wave','transit','lens','dial','meter'], nav:['Product','Customers','Pricing'], eyebrow:'Now available',
      heads:['Do your best work, faster.','The calm way to get things done.','Built for teams that ship.'],
      sub:'{name} brings your work into one clear place, so your team can spend less time managing and more time making.',
      cta:'Get started', cta2:'See how it works',
      items:[['Fast by default','Set up in minutes, not weeks.'],['Works together','Connects with the tools you already use.'],['Secure','Your data stays yours, always.']],
      offer:'Features', offerSub:'Everything you need to move from idea to done, without the clutter.',
      story:'Why us', storyHead:'Less busywork, more progress.', storyBody:'We built {name} because the tools we used got in the way. So we made one that stays out of it, and gets out of your way too.',
      principles:[['Simple','Learn it in a day'],['Reliable','Always on'],['Open','Plays well with others']]},
    {id:'finance', test:/\b(bank|banking|finance|financial|fintech|money|payments?|invest(?:ing|ment)?|budget|budgeting|budgets|savings?|expenses?|loan|mortgage|insurance|accounting|tax|wealth|credit|wallet|trading)\b/i,
      motifs:['structure','dial','lens'], nav:['Accounts','Pricing','Security'], eyebrow:'Money, made clear',
      heads:['Money that makes sense.','Your finances, in one calm place.','Banking without the noise.'],
      sub:'{name} gives you a clear view of where your money is and where it’s going, with no hidden fees.',
      cta:'Open an account', cta2:'Compare plans',
      items:[['Clear pricing','One simple plan, no surprises.'],['Instant insight','See every payment as it happens.'],['Protected','Bank-grade security by default.']],
      offer:'Accounts', offerSub:'Choose the account that fits how you spend, save and plan.',
      story:'About', storyHead:'Built on trust.', storyBody:'{name} exists to make money feel simpler. We explain things plainly, charge fairly and keep your information safe.',
      principles:[['Transparent','No hidden fees'],['Secure','Protected always'],['Human','Real support']]},
    {id:'health', test:/\b(health|wellness|fitness|gym|yoga|pilates|meditation|mindful(?:ness)?|therapy|clinic|doctor|dental|dentist|medical|care|nutrition|physio|spa|sleep|mental)\b/i,
      motifs:['leaf','sun','wave','ridge'], nav:['Classes','Approach','Book'], eyebrow:'Feel better',
      heads:['Feel better, every day.','Care that fits your life.','Make room to breathe.'],
      sub:'{name} offers thoughtful, unhurried care designed around you, whenever you’re ready to begin.',
      cta:'Book a session', cta2:'Our approach',
      items:[['Personal','Plans shaped around your goals.'],['Flexible','Sessions that fit your week.'],['Experienced','Guided by people who care.']],
      offer:'Sessions', offerSub:'Start with what you need today. Change it whenever you like.',
      story:'Our approach', storyHead:'Slow down, start well.', storyBody:'At {name} we believe small, steady habits make the biggest difference. We help you build them, one session at a time.',
      principles:[['Calm','Unhurried care'],['Personal','Made for you'],['Steady','Lasting habits']]},
    {id:'travel', test:/\b(travel|trip|hotel|stay|resort|tour|tours|vacation|holiday|airbnb|cabin|retreat|hostel|flight|adventure|explore|destination|camping|surf)\b/i,
      motifs:['transit','ridge','wave','bird'], nav:['Stays','Experiences','Plan'], eyebrow:'Somewhere new',
      heads:['Go somewhere slower.','A few days away.','Stay a little longer.'],
      sub:'{name} helps you find quiet places, good company and the time to enjoy both.',
      cta:'Plan a trip', cta2:'Browse places',
      items:[['Hand-picked','Places we’d stay ourselves.'],['Easy booking','Plans confirmed in minutes.'],['Local guides','People who know the way.']],
      offer:'Experiences', offerSub:'A short list of trips, stays and days out worth the journey.',
      story:'About', storyHead:'Travel, unhurried.', storyBody:'{name} is for people who’d rather see one place well than ten places quickly. We plan around that.',
      principles:[['Slow','Time to linger'],['Local','Rooted in place'],['Easy','Simple to plan']]},
    {id:'creative', test:/\b(portfolio|designer|design studio|studio|agency|artist|art|illustration|illustrator|photographer|photography|architect(?:ure)?|creative|branding|gallery|exhibition|freelance|resume|cv|personal site|personal website)\b/i,
      motifs:['fold','structure','lens','weave'], nav:['Work','About','Contact'], eyebrow:'Selected work',
      heads:['Quiet work, made with care.','Ideas, given form.','Design that does the talking.'],
      sub:'{name} is an independent practice making thoughtful work for people and brands who value craft.',
      cta:'View work', cta2:'Get in touch',
      items:[['Identity','Visual systems built to last.'],['Digital','Websites and products people enjoy.'],['Print','Objects you can hold onto.']],
      offer:'Work', offerSub:'A small selection of recent projects, from first sketch to final piece.',
      story:'About', storyHead:'Craft over noise.', storyBody:'{name} works closely with a few clients at a time, so every project gets the attention it deserves.',
      principles:[['Considered','Every detail'],['Collaborative','Made together'],['Lasting','Built to endure']]},
    {id:'music', test:/\b(music|band|album|artist|musician|dj|radio|podcast|concert|label|record|records|vinyl|song|songs|audio|sound|studio session|playlist|festival)\b/i,
      motifs:['disc','wave','meter'], nav:['Listen','Shows','About'], eyebrow:'Out now',
      heads:['Music for the long evening.','Turn it up, slow it down.','Sound worth staying for.'],
      sub:'{name} makes music for late drives, quiet rooms and the moments in between.',
      cta:'Listen now', cta2:'See shows',
      items:[['New release','The latest record, out everywhere.'],['Live dates','Catch it in a room near you.'],['Mailing list','First to hear what’s next.']],
      offer:'Releases', offerSub:'Records, sessions and live recordings, all in one place.',
      story:'About', storyHead:'Made to be heard together.', storyBody:'{name} started in a small room with borrowed gear and a lot of patience. The sound grew from there.',
      principles:[['Analog','Warm and close'],['Live','Made to be played'],['Independent','On our terms']]},
    {id:'learn', test:/\b(course|courses|school|class|classes|learn|learning|education|tutor|tutoring|academy|workshop|bootcamp|university|college|lessons?|teaching|students?|training)\b/i,
      motifs:['fold','structure','lens'], nav:['Courses','How it works','Enrol'], eyebrow:'Enrolment open',
      heads:['Learn something worth keeping.','Small classes, real progress.','Start learning, at your pace.'],
      sub:'{name} offers focused courses taught by people who love their subject and know how to share it.',
      cta:'Browse courses', cta2:'How it works',
      items:[['Expert-led','Taught by practising professionals.'],['Flexible','Learn on your own schedule.'],['Practical','Projects you can actually use.']],
      offer:'Courses', offerSub:'Choose a course, start this week, and learn at a pace that suits you.',
      story:'How it works', storyHead:'Learning that sticks.', storyBody:'{name} keeps classes small and practical, so every lesson ends with something you can do that you couldn’t before.',
      principles:[['Focused','One skill at a time'],['Practical','Learn by doing'],['Supported','Help when you need it']]},
    {id:'event', test:/\b(event|events|conference|summit|meetup|hackathon|wedding|party|gala|festival|launch|webinar|expo|ceremony|show|tickets?)\b/i,
      motifs:['structure','projector','fold'], nav:['Programme','Speakers','Tickets'], eyebrow:'Save the date',
      heads:['A day worth gathering for.','Meet the people who make it happen.','Come for the talks, stay for the people.'],
      sub:'{name} brings together curious people for a day of ideas, conversation and good company.',
      cta:'Get tickets', cta2:'See the programme',
      items:[['Talks','Short sessions from people doing the work.'],['Workshops','Hands-on time in small groups.'],['Gathering','Plenty of room to meet and talk.']],
      offer:'Programme', offerSub:'A full day of sessions, with time set aside to actually talk to each other.',
      story:'About', storyHead:'Built for good conversation.', storyBody:'{name} is a small gathering by design: big enough to meet someone new, small enough to remember them.',
      principles:[['Curated','Every session chosen'],['Intimate','Room to talk'],['Open','Everyone welcome']]},
    {id:'home', test:/\b(real estate|realtor|property|properties|apartment|apartments|homes?|house|interior|interiors|renovation|construction|builder|landscaping|garden|gardening|plumber|cleaning|moving|rental|rentals)\b/i,
      motifs:['structure','leaf','fold'], nav:['Homes','Services','Contact'], eyebrow:'Find your place',
      heads:['Spaces made for living.','A home that feels like yours.','Good places, well looked after.'],
      sub:'{name} helps you find, shape and care for the places where life actually happens.',
      cta:'Explore homes', cta2:'Talk to us',
      items:[['Curated listings','Places we’ve visited ourselves.'],['Expert guidance','Clear advice at every step.'],['Ongoing care','Support long after the keys.']],
      offer:'Services', offerSub:'From the first viewing to the last box unpacked, we’re with you.',
      story:'About', storyHead:'Home, done properly.', storyBody:'{name} believes a good home starts with listening. We take the time to understand how you live first.',
      principles:[['Careful','Every detail'],['Honest','Clear advice'],['Local','We know the area']]},
    {id:'cause', test:/\b(nonprofit|non-profit|charity|foundation|community|volunteer|volunteering|donate|donation|climate|sustainab(?:le|ility)|environment|ngo|campaign|cause|mission|church|association|club)\b/i,
      motifs:['leaf','sun','bird','ridge'], nav:['Our work','Get involved','Donate'], eyebrow:'Join us',
      heads:['Small actions, real change.','Together, we go further.','Care that reaches further.'],
      sub:'{name} brings people together to make a lasting difference, starting close to home.',
      cta:'Get involved', cta2:'See our impact',
      items:[['Volunteer','Give an hour, make a difference.'],['Donate','Every gift goes straight to the work.'],['Spread the word','Help more people find us.']],
      offer:'Our work', offerSub:'The projects we run, the people they reach and how you can help.',
      story:'Our mission', storyHead:'Change starts locally.', storyBody:'{name} began with neighbours helping neighbours. It still works that way, just with a few more of us.',
      principles:[['Local','Rooted nearby'],['Open','Everyone welcome'],['Accountable','Every gift tracked']]},
    {id:'pets', test:/\b(pets?|dogs?|cats?|puppy|puppies|kitten|vet|veterinary|grooming|pet food|animal|animals|shelter|adopt|adoption)\b/i,
      motifs:['leaf','bird','sun'], nav:['Services','Our team','Book'], eyebrow:'For happy pets',
      heads:['Care they’ll love, too.','Good days for good companions.','Happy pets, easy owners.'],
      sub:'{name} takes care of the animals in your life with patience, kindness and plenty of attention.',
      cta:'Book a visit', cta2:'Meet the team',
      items:[['Gentle care','Calm, unhurried visits.'],['Trusted team','People who adore animals.'],['Easy booking','Find a time in seconds.']],
      offer:'Services', offerSub:'Everything your companion needs, all under one roof.',
      story:'About', storyHead:'Animals first, always.', storyBody:'{name} was started by people who couldn’t imagine a day without animals. That care shows in everything we do.',
      principles:[['Kind','Gentle handling'],['Expert','Trained team'],['Trusted','Loved locally']]},
    {id:'sport', test:/\b(sports?|team|league|football|soccer|basketball|tennis|golf|running|cycling|climbing|swim|swimming|hockey|baseball|club|athletes?|coach|coaching|training)\b/i,
      motifs:['court','ridge','dial','disc'], nav:['Programs','Schedule','Join'], eyebrow:'Season starts soon',
      heads:['Play hard, play together.','Show up. Get better.','Built for the next game.'],
      sub:'{name} is for players at every level who want to train well, play often and enjoy every minute.',
      cta:'Join now', cta2:'See the schedule',
      items:[['All levels','Beginners to seasoned players.'],['Great coaches','Experienced and encouraging.'],['Real community','Teammates who show up.']],
      offer:'Programs', offerSub:'Pick a program, find your level and get on the field this week.',
      story:'About', storyHead:'More than a game.', storyBody:'{name} is built around a simple belief: playing together makes everyone better, on and off the field.',
      principles:[['Effort','Show up'],['Teamwork','Play together'],['Growth','Get better']]},
    {id:'service', test:/\b(consult(?:ing|ancy|ant)?|law|lawyer|legal|firm|services?|business|marketing|advisory|recruit(?:ing|ment)?|staffing|logistics|agency|partner|partners)\b/i,
      motifs:['structure','dial','lens','fold'], nav:['Services','Approach','Contact'], eyebrow:'Trusted partners',
      heads:['Clear thinking for complex work.','Advice you can act on.','Partners for the long run.'],
      sub:'{name} works alongside you to solve the problems that matter most, with clarity and care.',
      cta:'Book a call', cta2:'Our approach',
      items:[['Strategy','Find the right direction.'],['Delivery','See it through, properly.'],['Support','On hand when it counts.']],
      offer:'Services', offerSub:'A focused set of services, each delivered by senior people from start to finish.',
      story:'Approach', storyHead:'Straight answers, real results.', storyBody:'{name} keeps teams small and senior, so you always work with the people doing the thinking.',
      principles:[['Clear','Plain language'],['Senior','Experienced team'],['Focused','Results first']]}
  ];
  const general = {id:'general', motifs:null, nav:['Overview','About','Contact'], eyebrow:'Welcome',
    heads:['Thoughtfully made.','Simple, by design.','A better place to begin.'],
    sub:'{name} is built around a simple idea: do a few things, and do them really well.',
    cta:'Get started', cta2:'Learn more',
    items:[['Considered','Every detail chosen with care.'],['Simple','Easy to start, easy to love.'],['Reliable','Here when you need it.']],
    offer:'What we do', offerSub:'Everything we offer, explained simply, so you can choose with confidence.',
    story:'About', storyHead:'Made with intention.', storyBody:'{name} started with a question: what would this look like if it were simple? Everything we do follows from the answer.',
    principles:[['Clarity','Easy to understand'],['Care','Made thoughtfully'],['Trust','Built to last']]};

  const hash = s => { let h = 2166136261; for (const c of String(s).toLowerCase()) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const fill = (s, name) => s.replace(/\{name\}/g, name);
  const words = note => (String(note).normalize('NFKD').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);

  function kitFor(note) {
    // Choose the kit whose keywords appear most often, so "a coffee subscription app" reads as food first.
    let best = general, score = 0;
    const ordered = kits.filter(k => k.id !== 'tech' && k.id !== 'service').concat(kits.filter(k => k.id === 'tech' || k.id === 'service'));
    for (const k of ordered) { const n = (String(note).match(new RegExp(k.test.source, 'gi')) || []).length; if (n > score) { score = n; best = k; } }
    return best;
  }
  function familyFor(note, kit, families) {
    const terms = new Set(words(note));
    const ranked = families.map(f => ({f, rank: f.tags.split(' ').filter(t => terms.has(t)).length * 10 + (kit.motifs && kit.motifs.includes(f.motif) ? 3 : 0)}));
    const top = Math.max(...ranked.map(r => r.rank));
    const pool = ranked.filter(r => r.rank === top).map(r => r.f);
    return pool[hash(note) % pool.length];
  }
  function match(note) {
    const kit = kitFor(note), f = familyFor(note, kit, OriginalPages.families), seed = hash(note);
    return {id: f.id, f, kit, seed, minimal: true, named: false, exact: false, fallback: false, site: {title: 'Iris Minimal'}};
  }

  function page(f, kit, role, name, parent, seed) {
    const nodes = [];
    const ink = f.ink, paper = f.paper, swatch = f.accent;
    // Accent text must stay readable: pale accents (lime, sand) are blended toward the ink until they reach 3.5:1.
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const lum = h => { const c = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
    const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
    let accent = swatch;
    for (let t = .15; contrast(accent, paper) < 3.5 && t <= 1; t += .15) accent = mix(swatch, ink, t);
    const rect = (label, x, y, w, h, fillColor, extra = {}) => nodes.push({type: 'shape', name: label, x, y, w, h, ...(fillColor ? {fill: fillColor} : {}), ...extra});
    const art = (i, x, y, w, h, r = 18) => rect(f.items[i % 3] + ' artwork', x, y, w, h, paper, {art: f.id + '/v3/' + (i % 3), r});
    function text(value, x, y, w, size, weight = 400, color = ink, extra = {}) {
      const fit = Math.max(8, Math.min(size, w / Math.max(1, Doc.measure(value, 1, weight))));
      nodes.push({type: 'text', name: value.slice(0, 60), text: value, x, y, w, h: Math.ceil(fit * 1.25), size: Math.round(fit * 10) / 10, weight, color, lh: 1.1, wrap: false, ...extra});
      return fit;
    }
    // Wrap copy into lines of fixed width. Headlines shrink until they fit the allowed number of lines.
    function block(value, x, y, w, size, weight, maxLines, lh, color = ink, extra = {}) {
      let s = size, lines = Doc.wrap(value, s, weight, w);
      while (lines.length > maxLines && s > 14) { s -= 2; lines = Doc.wrap(value, s, weight, w); }
      lines.slice(0, maxLines).forEach((line, i) => text(line, x, y + i * s * lh, w, s, weight, color, extra));
      return Math.round(Math.min(lines.length, maxLines) * s * lh);
    }
    const muted = {opacity: .66};
    function button(label, x, y, filled = true, w) {
      const bw = w || Math.ceil(Doc.measure(label, 16, 600)) + 56;
      if (filled) rect(label + ' button', x, y, bw, 52, ink, {r: 26});
      else rect(label + ' button', x, y, bw, 52, null, {r: 26, stroke: ink, sw: 1});
      text(label, x, y + 16, bw, 16, 600, filled ? paper : ink, {align: 'center'});
      return bw;
    }
    function eyebrow(value, x, y, center = false) {
      if (center) { text(value, x, y, W - 2 * x, 14, 600, accent, {align: 'center'}); return; }
      rect('Accent dot', x, y + 5, 8, 8, swatch, {shape: 'ellipse'});
      text(value, x + 18, y, 400, 14, 600, accent);
    }
    // Navigation and footer frame every page the same way.
    text(name, M, 42, 320, 20, 700);
    const links = kit.nav.map(l => fill(l, name));
    const navCta = [kit.cta, kit.cta2].sort((a, b) => Doc.measure(a, 16, 600) - Doc.measure(b, 16, 600))[0];
    const navW = Math.ceil(Doc.measure(navCta, 16, 600)) + 48;
    button(navCta, W - M - navW, 30, false, navW);
    let lx = W - M - navW - 40;
    for (let i = links.length - 1; i >= 0; i--) { const lw = Math.ceil(Doc.measure(links[i], 15, 500)); lx -= lw; text(links[i], lx, 46, lw + 4, 15, 500); lx -= 36; }
    rect('Footer rule', M, 832, W - 2 * M, 1, ink, {opacity: .14});
    text(name, M, 852, 400, 14, 600);
    text('© 2026 ' + name, W - M - 300, 852, 300, 14, 400, ink, {align: 'right', ...muted});

    const v = seed % 3;
    if (role === 'Home') {
      const head = kit.heads[seed % kit.heads.length], sub = fill(kit.sub, name);
      if (v === 0) { // Split: copy left, artwork right, three notes below.
        eyebrow(kit.eyebrow, M, 188);
        const hh = block(head, M, 222, 600, 76, 600, 3, 1.04);
        const sh = block(sub, M, 222 + hh + 28, 520, 19, 400, 3, 1.5, ink, muted);
        const by = 222 + hh + 28 + sh + 36;
        const bw = button(kit.cta, M, by);
        text(kit.cta2 + '  →', M + bw + 28, by + 16, 260, 16, 600);
        art(0, 744, 112, 624, 600, 22);
        kit.items.forEach(([t, d], i) => { const x = M + i * 432; text(String(i + 1).padStart(2, '0'), x, 744, 40, 13, 600, accent); text(t, x + 40, 742, 360, 17, 600); text(d, x + 40, 772, 360, 15, 400, ink, muted); });
      } else if (v === 1) { // Centered: statement headline above a band of three images.
        eyebrow(kit.eyebrow, M, 126, true);
        const hh = block(head, 170, 160, W - 340, 80, 600, 2, 1.04, ink, {align: 'center'});
        const sh = block(sub, 360, 160 + hh + 22, W - 720, 19, 400, 2, 1.5, ink, {align: 'center', ...muted});
        const by = 160 + hh + 22 + sh + 30, bw = Math.ceil(Doc.measure(kit.cta, 16, 600)) + 56, cw = Math.ceil(Doc.measure(kit.cta2, 16, 600)) + 56;
        const bx = Math.round((W - bw - cw - 16) / 2);
        button(kit.cta, bx, by); button(kit.cta2, bx + bw + 16, by, false);
        const top = Math.max(by + 84, 500);
        [0, 1, 2].forEach(i => art(i, M + i * 444, top, 408, 800 - top, 18));
      } else { // Editorial: oversized headline, then a wide image beside the details.
        const hh = block(head, M, 116, W - 2 * M, 104, 600, 2, 1.0);
        const y = 116 + hh + 36;
        rect('Divider', M, y, W - 2 * M, 1, ink, {opacity: .14});
        eyebrow(kit.eyebrow, M, y + 32);
        const sh = block(sub, M, y + 66, 440, 18, 400, 4, 1.55, ink, muted);
        const by = y + 66 + sh + 28;
        button(kit.cta, M, by);
        const room = Math.floor((800 - (by + 84)) / 62);
        kit.items.slice(0, Math.max(0, room)).forEach(([t, d], i) => {
          const ry = 800 - Math.min(3, room) * 62 + i * 62;
          rect('Divider', M, ry, 440, 1, ink, {opacity: .14});
          text(String(i + 1).padStart(2, '0'), M, ry + 18, 40, 13, 600, accent);
          text(t, M + 40, ry + 16, 160, 16, 600);
          text(d, M + 200, ry + 18, 240, 14, 400, ink, muted);
        });
        art(0, 584, y + 32, W - M - 584, 800 - y - 32, 18);
      }
    } else if (role === 'Offer') {
      const title = fill(kit.offer, name);
      eyebrow(name, M, 132);
      block(title, M, 162, 700, 60, 600, 2, 1.05);
      block(fill(kit.offerSub, name), 872, 172, 496, 18, 400, 3, 1.55, ink, muted);
      if (v !== 2) { // Cards.
        kit.items.forEach(([t, d], i) => {
          const x = M + i * 444;
          art(i, x, 300, 408, 340, 16);
          text(t, x, 664, 408, 24, 600);
          block(d, x, 702, 380, 16, 400, 2, 1.5, ink, muted);
          text('Learn more  →', x, 760, 200, 15, 600, accent);
        });
      } else { // Index rows with thumbnails.
        kit.items.forEach(([t, d], i) => {
          const y = 290 + i * 172;
          rect('Divider', M, y, W - 2 * M, 1, ink, {opacity: .14});
          text(String(i + 1).padStart(2, '0'), M, y + 30, 60, 15, 600, accent);
          text(t, 160, y + 24, 620, 40, 600);
          text(d, 160, y + 82, 620, 17, 400, ink, muted);
          art(i, 1148, y + 20, 220, 132, 12);
        });
      }
    } else if (role === 'Story') {
      art(1, M, 112, 600, 688, 22);
      eyebrow(fill(kit.story, name), 744, 150);
      const hh = block(fill(kit.storyHead, name), 744, 184, 624, 60, 600, 3, 1.05);
      block(fill(kit.storyBody, name), 744, 184 + hh + 28, 560, 18, 400, 5, 1.6, ink, muted);
      kit.principles.forEach(([t, d], i) => {
        const x = 744 + i * 212;
        rect('Divider', x, 640, 188, 1, ink, {opacity: .2});
        text(String(i + 1).padStart(2, '0'), x, 662, 40, 13, 600, accent);
        text(t, x, 688, 188, 22, 600);
        text(d, x, 724, 188, 15, 400, ink, muted);
      });
    } else { // Contact
      eyebrow('Contact', M, 168);
      block('Let’s talk.', M, 200, 600, 96, 600, 1, 1.0);
      block('Questions, ideas or just a hello. Send a note and someone from ' + name + ' will reply within a day.', M, 334, 520, 18, 400, 3, 1.6, ink, muted);
      const mail = 'hello@' + (name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'studio') + '.com';
      text(mail, M, 462, 600, 30, 500, accent);
      rect('Email underline', M, 506, Math.min(600, Math.ceil(Doc.measure(mail, 30, 500))), 2, swatch);
      art(2, M, 580, 520, 220, 16);
      rect('Form panel', 744, 112, 624, 688, ink, {r: 22, opacity: .05});
      [['Name', 56], ['Email', 56], ['Message', 234]].reduce((y, [label, h]) => {
        text(label, 792, y, 300, 14, 600);
        rect(label + ' field', 792, y + 28, 528, h, null, {r: 12, stroke: ink, sw: 1, opacity: .35});
        return y + 28 + h + 28;
      }, 168);
      button('Send message', 792, 690, true, 528);
    }
    nodes.forEach((n, i) => { n.parent = parent; n.id = parent + '-m' + i; });
    return {screen: {id: parent, name: name + ' · ' + (role === 'Offer' ? fill(kit.offer, name) : role === 'Story' ? fill(kit.story, name) : role), w: W, h: H, fill: paper, layout: 'stack', vaultSource: f.id}, nodes};
  }

  const roles = ['Home', 'Offer', 'Story', 'Contact'];
  // An unnamed brief like "an online course platform for designers" becomes "Online course platform".
  function shortName(note, name) {
    if (/\b(?:called|named)\b|["“]/i.test(note)) return name;
    let n = name.replace(/\s+(?:for|with|that|which|where|who|to|in|on|about)\s.*$/i, '').trim() || name;
    if (n.length > 28) n = n.slice(0, 28).replace(/\s+\S*$/, '');
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  function build(note, m, fullName, captureOnly) {
    const {f, kit, seed} = m, name = shortName(note, fullName);
    const extra = seed % 2 ? 'Contact' : 'Story';
    const selected = captureOnly ? ['Home'] : ['Home', 'Offer', extra];
    const pages = selected.map((role, i) => page(f, kit, role, name, ['web', 'collection', 'detail'][i], seed));
    return {name, reference: {id: f.id, title: 'Iris Minimal', url: '', vaultOnly: true, original: true, minimal: true, kit: kit.id, seed,
      sources: [], setups: pages.map(p => ({screen: p.screen.id, source: f.id}))}, screens: pages.map(p => p.screen), nodes: pages.flatMap(p => p.nodes)};
  }
  return {kits, general, match, build, page, roles, kitFor};
})();
if (typeof module !== 'undefined') module.exports = MinimalPages;
