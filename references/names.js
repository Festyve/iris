// Brand names for vault builds. Iris never presents a real company: a brief that names one is
// rebuilt for that company's kind of product under an invented name, and an unnamed brief gets a
// plain, believable name for its category instead of a label like "Law firm" or "Dentist".
const BrandNames = (() => {
  // Well-known companies and products, each mapped to the kind of site it would be.
  const real = {
    music: ['spotify', 'apple music', 'soundcloud', 'tidal', 'deezer', 'pandora', 'bandcamp', 'youtube music', 'shazam'],
    shop: ['nike', 'adidas', 'puma', 'zara', 'h&m', 'uniqlo', 'gucci', 'prada', 'louis vuitton', 'chanel', 'hermes', 'hermès', 'supreme', 'patagonia', 'lululemon', 'ikea', 'etsy', 'amazon', 'ebay', 'shopify', 'walmart', 'target', 'glossier', 'sephora', 'allbirds', 'everlane', 'warby parker', 'apple', 'samsung', 'sony', 'dyson', 'gumroad'],
    finance: ['stripe', 'paypal', 'venmo', 'cash app', 'square', 'revolut', 'monzo', 'wise', 'robinhood', 'coinbase', 'binance', 'chase', 'wells fargo', 'bank of america', 'mastercard', 'visa', 'american express', 'amex', 'klarna', 'affirm', 'mercury', 'brex', 'ramp', 'plaid', 'wealthsimple'],
    tech: ['google', 'microsoft', 'meta', 'facebook', 'instagram', 'whatsapp', 'twitter', 'x.com', 'tiktok', 'snapchat', 'linkedin', 'openai', 'chatgpt', 'anthropic', 'claude', 'gemini', 'notion', 'slack', 'figma', 'linear', 'vercel', 'github', 'gitlab', 'atlassian', 'jira', 'trello', 'asana', 'dropbox', 'zoom', 'salesforce', 'hubspot', 'adobe', 'canva', 'raycast', 'arc', 'cursor', 'replit', 'netlify', 'supabase', 'firebase', 'aws', 'oracle', 'ibm', 'intel', 'nvidia', 'tesla', 'spacex', 'discord', 'reddit', 'pinterest', 'dribbble', 'behance', 'framer', 'webflow', 'squarespace', 'wix', 'duolingo', 'grammarly', 'loom', 'calendly', 'airtable', 'miro', 'yahoo', 'bing', 'netflix', 'hulu', 'disney', 'twitch', 'youtube', 'uber', 'lyft', 'doordash'],
    travel: ['airbnb', 'booking.com', 'expedia', 'tripadvisor', 'marriott', 'hilton', 'hyatt', 'delta', 'united airlines', 'emirates', 'ryanair', 'kayak', 'vrbo'],
    food: ['starbucks', 'mcdonalds', "mcdonald's", 'chipotle', 'dominos', "domino's", 'kfc', 'subway', 'blue bottle', 'tim hortons', 'dunkin', 'sweetgreen', 'shake shack', 'pret', 'nespresso'],
    health: ['peloton', 'strava', 'headspace', 'calm', 'equinox', 'whoop', 'oura', 'fitbit', 'nike training'],
    learn: ['coursera', 'udemy', 'khan academy', 'masterclass', 'skillshare', 'harvard', 'stanford', 'mit'],
  };
  const realIndex = Object.entries(real).flatMap(([kind, names]) => names.map(n => [n, kind]))
    .sort((a, b) => b[0].length - a[0].length);
  const escape = s => s.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&');
  // Brands that are also everyday words only count when the brief is essentially just that name.
  const everyday = new Set(['apple', 'target', 'square', 'visa', 'calm', 'delta', 'arc', 'cursor', 'claude', 'gemini', 'pret', 'subway',
    'oracle', 'wise', 'chase', 'meta', 'notion', 'slack', 'linear', 'ramp', 'mercury', 'united airlines', 'amazon', 'supreme', 'zoom',
    'loom', 'miro', 'framer', 'canva', 'puma', 'whoop', 'oura', 'mit', 'pandora', 'tidal', 'discord', 'twitch', 'equinox', 'wix']);
  const realPatterns = realIndex.map(([n, kind]) => [everyday.has(n)
    ? new RegExp('^\\s*(?:(?:recreate|copy|clone|make|build|design|like)\\s+)*(?:a\\s+|an\\s+|the\\s+)?' + escape(n) + '(?:\\s+(?:website|site|homepage|landing page|app|store|clone))?\\s*$', 'i')
    : new RegExp('(?:^|[^a-z0-9])' + escape(n) + '(?:$|[^a-z0-9])', 'i'), kind, n]);
  // Words that steer the matcher toward the right template for each kind of real company.
  const brief = {music: 'music streaming app', shop: 'clothing store', finance: 'payments fintech app',
    tech: 'software platform startup', travel: 'travel and hotel stays', food: 'coffee shop and bakery',
    health: 'fitness and wellness studio', learn: 'online courses school'};

  // Invented names: short, plain and believable, the way small independent brands are named.
  const pools = {
    food: ['Daylight Bakery', 'Corner Loaf', 'Small Batch', 'Saltwater Kitchen', 'Rosemary & Rye', 'Halfmoon Café', 'Oat & Ember', 'Little Harbour'],
    shop: ['Field Goods', 'Northline Supply', 'Common Thread', 'Linen & Loom', 'Haven Store', 'Wildwood Co.', 'Paper Moon', 'Ashgrove'],
    tech: ['Lumen', 'Fieldwork', 'Northstack', 'Brightline', 'Quarry', 'Tandem', 'Openframe', 'Relay'],
    finance: ['Tally', 'Fernbank', 'Copperleaf', 'Steady', 'Harbor Money', 'Ledgerly', 'Keel', 'Plainsum'],
    health: ['Still Water', 'Good Form', 'Morning Practice', 'Kindred Health', 'Fairweather', 'Open Breath', 'Clearday', 'Root & Rise'],
    travel: ['Slow Road', 'Coastline Stays', 'Wayfare', 'Blue Hour', 'Far Field', 'Northbound', 'Harbour House', 'Long Weekend'],
    creative: ['Northwind Studio', 'Field Office', 'Paperplane', 'Common Room', 'Half Light', 'Studio Ardent', 'Open Plan', 'Grey Matter'],
    music: ['Night Signal', 'Side B', 'Low Tide Records', 'Open Air', 'Second Take', 'Slow Burn', 'Long Play', 'Radio Room'],
    learn: ['Fieldnotes Academy', 'Open Book', 'Slow School', 'Common Ground', 'First Light', 'Brightwater', 'Chalk & Co.', 'Learnwell'],
    event: ['Field Day', 'Open House', 'Late Hours', 'Gather', 'Long Table', 'Northern Lights', 'Summer Assembly', 'The Meeting Place'],
    home: ['Hearth & Home', 'Keystone Homes', 'Fairfield', 'Oakbridge', 'Brick & Beam', 'Willow Lane', 'Stonefield', 'Homeward'],
    cause: ['Common Good', 'Open Hands', 'Greenway', 'Rising Tide', 'Neighbourly', 'Field Fund', 'Wellspring', 'Bright Futures'],
    pets: ['Good Dog', 'Paws & Co.', 'Tailwind', 'Happy Hound', 'Whisker & Wag', 'Fetch', 'Little Paws', 'Kindred Pets'],
    sport: ['Iron Hall', 'Full Stride', 'Home Court', 'Open Lane', 'Summit Club', 'Second Wind', 'Baseline', 'Fair Play'],
    service: ['Hartwell & Vale', 'Ashby Lowe', 'Carrow Partners', 'Fenwick & Hale', 'Marlow Advisory', 'Kestrel & Co.', 'Brook Street', 'Thornbury'],
    general: ['Northwind', 'Fieldhouse', 'Clearwater', 'Oakline', 'Brightwell', 'Common Ground', 'Halcyon', 'Westward'],
  };
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  // The real company a brief names, or null.
  function realBrand(note) {
    for (const [re, kind, name] of realPatterns) if (re.test(note)) return {name, kind};
    return null;
  }
  function isReal(name) { const n = String(name || '').trim().toLowerCase(); return realIndex.some(([r]) => r === n); }
  // Replace each real company in a brief with words for its kind of product, so templates still fit.
  function neutralize(note) {
    let out = String(note);
    for (const [re, kind] of realPatterns) out = out.replace(re, m => m.replace(/[^\s].*[^\s]|[^\s]/, brief[kind]));
    return out;
  }
  // A short input that reads like a name (e.g. "Northwind Studio") is the name itself.
  function looksLikeName(note, categoryTest) {
    const text = String(note).trim();
    const words = text.split(/\s+/);
    if (!text || words.length > 3 || /^(a|an|the|my|our|recreate|copy|clone|make|build|design|create|website|site|like|please)\b/i.test(text) || realBrand(text)) return false;
    if (!(categoryTest && categoryTest(text))) return true;
    // A category word still reads as a name when every word is capitalised ("Northwind Studio").
    return words.length >= 2 && words.every(w => /^[A-Z][a-z'’&.-]*$/.test(w) || w === '&');
  }
  function invent(note, kind) {
    const pool = pools[kind] || pools.general;
    return pool[hash(String(note).toLowerCase()) % pool.length];
  }
  // Replace any real company left in a line of copy with a stable invented name.
  const wordPatterns = realIndex.map(([n]) => [new RegExp('(^|[^A-Za-z0-9])(' + escape(n) + ')(?=$|[^A-Za-z0-9])', 'gi'), n]);
  function scrub(text) {
    let out = String(text);
    for (const [re, n] of wordPatterns) {
      if (everyday.has(n) && out.trim().toLowerCase() !== n) continue;
      out = out.replace(re, (m, lead) => lead + invent(n, 'general'));
    }
    return out;
  }
  return {realBrand, isReal, neutralize, looksLikeName, invent, scrub, pools};
})();
if (typeof module !== 'undefined') module.exports = BrandNames;
