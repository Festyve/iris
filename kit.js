/* Local design planner. Turns any brief into a full product board:
   five phone screens, a web dashboard and a marketing page, in one palette. */
const Kit = (() => {
  const hues = {
    violet: {accent: '#6E56F8', accent2: '#FF8A5B', grad: ['#6E56F8', '#B26BFF'], on: '#FFFFFF'},
    coral: {accent: '#FF5A4E', accent2: '#FFB938', grad: ['#FF4E50', '#FF9A5A'], on: '#FFFFFF'},
    ocean: {accent: '#2D6BFF', accent2: '#16C3DF', grad: ['#2D6BFF', '#5AB4FF'], on: '#FFFFFF'},
    lime: {accent: '#C5F23A', accent2: '#8C6CFF', grad: ['#B8F02E', '#4FE0A4'], on: '#0C0C11'},
    sun: {accent: '#EA7212', accent2: '#E8445A', grad: ['#FF9F1C', '#FF6B3D'], on: '#FFFFFF'},
    emerald: {accent: '#0E9F6E', accent2: '#FFAA33', grad: ['#0E9F6E', '#34CFA0'], on: '#FFFFFF'},
    rose: {accent: '#E13F7A', accent2: '#8B5CF6', grad: ['#F2508A', '#FF92AE'], on: '#FFFFFF'}
  };
  const bases = {
    light: {bg: '#F5F5F8', surface: '#FFFFFF', surface2: '#F2F2F6', ink: '#15151E', muted: '#6E6E82', faint: '#E7E7EE', nav: '#15151E', line2: '#C9C9D6'},
    dark: {bg: '#0C0C11', surface: '#17171F', surface2: '#1F1F29', ink: '#F4F4F8', muted: '#9A9AAE', faint: '#2A2A36', nav: '#23232E', line2: '#4A4A5C'}
  };
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();

  function theme(hue, mode) {
    const h = hues[hue], b = bases[mode], light = mode === 'light';
    const good = light ? '#11A05A' : '#3DDC84';
    return Object.assign({}, b, {
      mode, hue, accent: h.accent, accent2: h.accent2, on: h.on,
      grad: {from: h.grad[0], to: h.grad[1], dir: 'd'},
      soft: light ? mix(h.accent, '#FFFFFF', .87) : mix(h.accent, b.surface, .8),
      soft2: light ? mix(h.accent2, '#FFFFFF', .85) : mix(h.accent2, b.surface, .8),
      good, goodSoft: light ? mix(good, '#FFFFFF', .86) : mix(good, b.surface, .82),
      bad: light ? '#E5484D' : '#FF6B6B'
    });
  }

  const packs = {
    finance: {kw: /financ|budget|money|bank|spend|expense|wallet|invest|saving|payment|fintech|crypto|ledger/i, hue: 'violet', mode: 'light', name: 'Penny',
      hero: ['Know where', 'every dollar goes'], heroSub: ['Smart budgets that adapt to', 'the way you actually spend.'], cta: 'Get started', chip: '+4.2%',
      user: 'Ava Chen', handle: '@avachen', balLabel: 'Total balance', bal: '$12,480.20', delta: '+4.2% this month',
      actions: [['Send', 'plus'], ['Request', 'dot'], ['Top up', 'bars'], ['Cards', 'card']],
      listTitle: 'Recent activity', items: [['Blue Bottle Coffee', 'Today · Food', '-$6.40'], ['Salary', 'Yesterday · Income', '+$3,200'], ['Fresh Market', 'Mon · Groceries', '-$64.18']],
      detail: {kicker: 'Budget', title: 'Groceries', meta: 'Resets in 12 days', big: '$342', bigSub: 'of $500 spent this month', pct: .68, tiles: [['Avg / week', '$85.50'], ['Top store', 'Fresh Co.']], desc: ['You’re 18% under your usual pace.', 'Keep it up to save $64 this month.'], cta: 'Adjust budget'},
      stats: {title: 'Insights', segs: ['Week', 'Month', 'Year'], value: '$2,140', sub: 'Spent in October · 8% less than September', tip: '$312', list: 'Top categories', cats: [['Food & drink', 38], ['Transport', 22], ['Shopping', 18], ['Bills', 14]]},
      settings: ['Notifications', 'Linked accounts', 'Security', 'Appearance', 'Help & support'], pstats: [['24', 'Goals'], ['$4.2k', 'Saved'], ['12', 'Day streak']],
      web: {nav: ['Overview', 'Budgets', 'Accounts', 'Reports', 'Settings'], title: 'Overview', kpis: [['Net worth', '$84,210', '+2.4%'], ['Saved', '$1,320', '+12%'], ['Invested', '$22,400', '+5.6%'], ['Credit score', '782', '+14']], chart: 'Cash flow', side: 'Spending mix', rowsTitle: 'Latest transactions', cols: ['Merchant', 'Category', 'Date', 'Amount'], rows: [['Blue Bottle', 'Food', 'Oct 24', '-$6.40'], ['Salary', 'Income', 'Oct 23', '+$3,200']]},
      land: {nav: ['Product', 'Pricing', 'Stories', 'Help'], kicker: 'New · Shared budgets', title: ['Money, minus', 'the mess.'], sub: ['One calm, clear plan for every card and account,', 'so you always know exactly what’s left.'], cta: 'Start for free', cta2: 'See how it works', proof: '12,000+ households', proofSub: 'Rated 4.9 out of 5', features: [['Auto-budgets', 'Plans that adapt to real life.'], ['Shared goals', 'Save together with anyone.'], ['Bank-grade', 'Encrypted, private, always.']]}},
    fitness: {kw: /fitness|\brun|workout|gym|training|exercise|sport|cycling|athlet|marathon|coach/i, hue: 'coral', mode: 'dark', name: 'Stride',
      hero: ['Every run,', 'coached by you.'], heroSub: ['Adaptive plans that learn your pace', 'and grow with every mile.'], cta: 'Start running', chip: '+12%',
      user: 'Jordan Lee', handle: '@jordanruns', balLabel: 'This week', bal: '32.4 km', delta: '+12% vs last week',
      actions: [['Run', 'wave'], ['Plans', 'grid'], ['Stats', 'bars'], ['Gear', 'dot']],
      listTitle: 'Recent runs', items: [['Morning tempo', 'Today · 6:12 /km', '8.2 km'], ['River loop', 'Tue · 5:58 /km', '10.0 km'], ['Easy recovery', 'Sun · 6:40 /km', '5.1 km']],
      detail: {kicker: 'Workout', title: 'Sunset Tempo', meta: 'Today · 45 min · Riverside', big: '8.2 km', bigSub: 'Goal 10 km · 82% complete', pct: .82, tiles: [['Avg pace', '6:12 /km'], ['Heart rate', '152 bpm']], desc: ['Hold a comfortable-hard pace for 20 min,', 'then cool down with an easy 2 km.'], cta: 'Start workout'},
      stats: {title: 'Progress', segs: ['Week', 'Month', 'Year'], value: '128 km', sub: 'Run in October · 14 km more than September', tip: '22 km', list: 'Training mix', cats: [['Easy runs', 42], ['Tempo', 24], ['Long runs', 20], ['Intervals', 14]]},
      settings: ['Notifications', 'Connected watch', 'Audio coaching', 'Units & pace', 'Privacy'], pstats: [['86', 'Runs'], ['642', 'Kilometres'], ['21', 'Day streak']],
      web: {nav: ['Dashboard', 'Plans', 'Athletes', 'Races', 'Settings'], title: 'Training dashboard', kpis: [['Distance', '128 km', '+14%'], ['Avg pace', '6:04', '-0:08'], ['Elevation', '1,920 m', '+6%'], ['Recovery', '86%', '+3%']], chart: 'Weekly volume', side: 'Training mix', rowsTitle: 'Upcoming sessions', cols: ['Session', 'Type', 'Date', 'Distance'], rows: [['Sunset tempo', 'Tempo', 'Oct 24', '8 km'], ['Long Sunday', 'Endurance', 'Oct 26', '18 km']]},
      land: {nav: ['Coaching', 'Plans', 'Community', 'Pricing'], kicker: 'New · Race-day mode', title: ['Run further.', 'Feel better.'], sub: ['Stride builds a plan around your pace and your week,', 'then adapts it after every single run.'], cta: 'Start free trial', cta2: 'Explore plans', proof: '250,000+ runners', proofSub: 'Training in 120 countries', features: [['Adaptive plans', 'Every run tunes the next.'], ['Live coaching', 'Pacing cues in your ear.'], ['Recovery', 'Know when to push.']]}},
    travel: {kw: /travel|trip|flight|hotel|vacation|holiday|tour|journey|transit|metro|train|\bbus\b|commut|booking|itinerar/i, hue: 'ocean', mode: 'light', name: 'Wander',
      hero: ['Plan less.', 'Wander more.'], heroSub: ['Flights, stays and day plans', 'gathered in one calm itinerary.'], cta: 'Plan a trip', chip: '4 nights',
      user: 'Sam Rivera', handle: '@samwanders', balLabel: 'Next trip · Kyoto', bal: '12 days', delta: 'Departs Nov 3 · SFO to KIX',
      actions: [['Flights', 'wave'], ['Stays', 'grid'], ['Maps', 'pin'], ['Wallet', 'card']],
      listTitle: 'Itinerary', items: [['Fushimi Inari', 'Day 1 · 7:30 AM', 'Hike'], ['Nishiki Market', 'Day 1 · 12:00 PM', 'Food'], ['Arashiyama', 'Day 2 · 8:00 AM', 'Walk']],
      detail: {kicker: 'Stay', title: 'Riverside Ryokan', meta: 'Nov 3 – 7 · 4 nights · Arashiyama', big: '$1,240', bigSub: 'Total · free cancellation until Oct 30', pct: .55, tiles: [['Check-in', '3:00 PM'], ['Rating', '4.9 · 812']], desc: ['A quiet riverside inn reached by boat,', 'minutes from the bamboo grove.'], cta: 'Reserve stay'},
      stats: {title: 'Travel log', segs: ['2024', '2025', 'All'], value: '14 cities', sub: 'Visited this year across 6 countries', tip: '3 trips', list: 'Where you went', cats: [['Japan', 36], ['Portugal', 26], ['Mexico', 20], ['Iceland', 18]]},
      settings: ['Notifications', 'Travel documents', 'Payment methods', 'Offline maps', 'Help'], pstats: [['14', 'Cities'], ['38k', 'Miles'], ['6', 'Countries']],
      web: {nav: ['Trips', 'Explore', 'Bookings', 'Wallet', 'Settings'], title: 'Upcoming trips', kpis: [['Trips planned', '4', '+1'], ['Nights booked', '23', '+6'], ['Saved', '$860', '+18%'], ['Points', '42,800', '+3.2k']], chart: 'Spending by month', side: 'Budget split', rowsTitle: 'Bookings', cols: ['Booking', 'Type', 'Date', 'Price'], rows: [['SFO to KIX', 'Flight', 'Nov 3', '$842'], ['Riverside Ryokan', 'Stay', 'Nov 3', '$1,240']]},
      land: {nav: ['Explore', 'Guides', 'Pricing', 'Help'], kicker: 'New · Group trips', title: ['Plan less.', 'Wander more.'], sub: ['Wander turns bookings, maps and recommendations', 'into one beautiful itinerary you can share.'], cta: 'Plan a trip', cta2: 'Browse guides', proof: '1.2M trips planned', proofSub: 'By travellers in 140 countries', features: [['Smart itinerary', 'Bookings sorted for you.'], ['Offline maps', 'Never lost, even off-grid.'], ['Shared plans', 'Plan together, live.']]}},
    music: {kw: /music|song|playlist|audio|podcast|album|listen|radio|\bdj\b|band|concert/i, hue: 'lime', mode: 'dark', name: 'Echo',
      hero: ['Music that', 'moves with you.'], heroSub: ['Mixes tuned to your day, your mood', 'and the moment you are in.'], cta: 'Start listening', chip: 'Now live',
      user: 'Riley Park', handle: '@rileyp', balLabel: 'Now playing', bal: 'Midnight Drive', delta: 'Nova Lights · 2:14 / 3:48',
      actions: [['Mixes', 'wave'], ['Radio', 'ring'], ['Library', 'grid'], ['Live', 'dot']],
      listTitle: 'Jump back in', items: [['Golden Hour', 'Mira Sol · Single', '3:12'], ['Static Bloom', 'The Parallels', '4:05'], ['Low Tide', 'Kaia · Shorelines', '2:58']],
      detail: {kicker: 'Album', title: 'Afterglow', meta: 'Nova Lights · 2025 · 11 songs', big: '48 min', bigSub: 'Played 23 times this month', pct: .4, tiles: [['Top track', 'Low Tide'], ['Genre', 'Synth pop']], desc: ['Warm synths and late-night drums,', 'recorded live over one weekend.'], cta: 'Play album'},
      stats: {title: 'Listening', segs: ['Week', 'Month', 'Year'], value: '62 hours', sub: 'Listened in October · your top month yet', tip: '7.4 h', list: 'Top genres', cats: [['Synth pop', 34], ['Indie', 26], ['Lo-fi', 22], ['Jazz', 18]]},
      settings: ['Notifications', 'Audio quality', 'Downloads', 'Connected devices', 'Privacy'], pstats: [['1,284', 'Songs'], ['62h', 'This month'], ['48', 'Playlists']],
      web: {nav: ['Home', 'Discover', 'Library', 'Artists', 'Settings'], title: 'Artist studio', kpis: [['Listeners', '182k', '+9.4%'], ['Streams', '2.4M', '+12%'], ['Saves', '48.2k', '+6%'], ['Followers', '31.9k', '+4.1%']], chart: 'Streams over time', side: 'Top genres', rowsTitle: 'Top tracks', cols: ['Track', 'Album', 'Released', 'Streams'], rows: [['Midnight Drive', 'Afterglow', 'Sep 12', '812k'], ['Golden Hour', 'Single', 'Aug 2', '604k']]},
      land: {nav: ['Discover', 'Artists', 'Pricing', 'Help'], kicker: 'New · Live mixes', title: ['Sound that', 'follows you.'], sub: ['Echo learns what you love and builds a soundtrack', 'for every part of your day, automatically.'], cta: 'Try Echo free', cta2: 'Hear a mix', proof: '8M listeners', proofSub: 'Streaming in 90 countries', features: [['Daily mixes', 'Fresh picks every morning.'], ['Lossless audio', 'Studio quality, anywhere.'], ['Live sessions', 'Front row from the sofa.']]}},
    food: {kw: /food|meal|recipe|restaurant|cook|kitchen|grocer|deliver|cafe|coffee|\beat|dinner|lunch|bakery|pizza/i, hue: 'sun', mode: 'light', name: 'Ladle',
      hero: ['Fresh dinners,', 'zero guesswork.'], heroSub: ['Chef-built recipes, every ingredient', 'measured and delivered to your door.'], cta: 'Choose meals', chip: '30 min',
      user: 'Maya Ortiz', handle: '@mayacooks', balLabel: 'Next delivery', bal: 'Thursday', delta: '3 meals · arrives 4 – 6 PM',
      actions: [['Menu', 'grid'], ['Recipes', 'card'], ['Pantry', 'bars'], ['Offers', 'dot']],
      listTitle: 'This week’s menu', items: [['Miso salmon bowl', '25 min · 540 kcal', '$11.99'], ['Charred corn tacos', '20 min · 480 kcal', '$9.49'], ['Lemon orzo', '30 min · 610 kcal', '$10.99']],
      detail: {kicker: 'Recipe', title: 'Miso Salmon Bowl', meta: '25 min · Easy · Serves 2', big: '540', bigSub: 'Calories per serving · 38 g protein', pct: .6, tiles: [['Prep time', '10 min'], ['Difficulty', 'Easy']], desc: ['Glazed salmon over sushi rice with crisp', 'cucumber, edamame and toasted sesame.'], cta: 'Add to box'},
      stats: {title: 'Nutrition', segs: ['Day', 'Week', 'Month'], value: '1,860 kcal', sub: 'Daily average · right on target', tip: '2,040', list: 'Macros', cats: [['Carbs', 42], ['Protein', 28], ['Fat', 22], ['Fibre', 8]]},
      settings: ['Notifications', 'Delivery address', 'Dietary needs', 'Payment', 'Help'], pstats: [['46', 'Meals'], ['18', 'Recipes'], ['4.9', 'Avg rating']],
      web: {nav: ['Orders', 'Menu', 'Kitchens', 'Customers', 'Settings'], title: 'Kitchen overview', kpis: [['Orders today', '1,284', '+8.2%'], ['Revenue', '$18,940', '+11%'], ['Avg prep', '14 min', '-2 min'], ['Rating', '4.86', '+0.04']], chart: 'Orders this week', side: 'Popular dishes', rowsTitle: 'Live orders', cols: ['Order', 'Dish', 'Time', 'Total'], rows: [['#4821', 'Miso salmon', '6:42 PM', '$24.50'], ['#4822', 'Corn tacos', '6:44 PM', '$18.00']]},
      land: {nav: ['Menu', 'How it works', 'Pricing', 'Gifts'], kicker: 'New · Family plans', title: ['Dinner,', 'sorted.'], sub: ['Chef-built recipes and perfectly portioned ingredients,', 'delivered on your schedule. Cook in 30 minutes.'], cta: 'See the menu', cta2: 'How it works', proof: '3M meals delivered', proofSub: 'Fresh from 40 local farms', features: [['Chef recipes', 'A new menu every week.'], ['Zero waste', 'Exactly what you need.'], ['Flexible plans', 'Skip or pause anytime.']]}},
    tasks: {kw: /task|todo|to-do|project|kanban|sprint|team|productiv|planner|workflow|calendar|notes|crm/i, hue: 'emerald', mode: 'light', name: 'Orbit',
      hero: ['Your work,', 'finally in orbit.'], heroSub: ['Plans, tasks and teammates in one', 'calm space that keeps you moving.'], cta: 'Create workspace', chip: '3 done',
      user: 'Alex Kim', handle: '@alexk', balLabel: 'Today', bal: '7 tasks', delta: '3 done · 2 due before noon',
      actions: [['New task', 'plus'], ['Projects', 'grid'], ['Calendar', 'card'], ['Reports', 'bars']],
      listTitle: 'Up next', items: [['Review launch plan', 'Product · 10:00 AM', 'High'], ['Design sync', 'Team · 11:30 AM', 'Meet'], ['Write release notes', 'Docs · 2:00 PM', 'Med']],
      detail: {kicker: 'Project', title: 'Website Relaunch', meta: 'Due Nov 14 · 6 members', big: '68%', bigSub: 'Complete · 24 of 35 tasks done', pct: .68, tiles: [['Milestone', 'Beta'], ['Days left', '12']], desc: ['Ship the new marketing site with', 'refreshed pricing and case studies.'], cta: 'Open board'},
      stats: {title: 'Velocity', segs: ['Sprint', 'Month', 'Quarter'], value: '142 tasks', sub: 'Completed this month · 18% faster', tip: '19', list: 'By team', cats: [['Product', 34], ['Design', 28], ['Engineering', 24], ['Marketing', 14]]},
      settings: ['Notifications', 'Workspace', 'Integrations', 'Shortcuts', 'Help'], pstats: [['142', 'Completed'], ['9', 'Projects'], ['15', 'Day streak']],
      web: {nav: ['Home', 'My tasks', 'Projects', 'Inbox', 'Settings'], title: 'Product sprint', kpis: [['Open tasks', '38', '-6'], ['Completed', '142', '+18%'], ['On track', '92%', '+4%'], ['Cycle time', '2.4 d', '-0.3 d']], chart: 'Burndown', side: 'Workload', rowsTitle: 'Due this week', cols: ['Task', 'Project', 'Due', 'Owner'], rows: [['Launch checklist', 'Website', 'Nov 12', 'Alex'], ['Pricing page', 'Website', 'Nov 13', 'Priya']]},
      land: {nav: ['Product', 'Templates', 'Pricing', 'Customers'], kicker: 'New · AI summaries', title: ['Work that', 'flows.'], sub: ['Orbit brings plans, tasks and conversations together', 'so your team always knows what matters next.'], cta: 'Start for free', cta2: 'Book a demo', proof: '40,000+ teams', proofSub: 'From startups to enterprises', features: [['Boards & lists', 'See work your way.'], ['Automations', 'Busywork, handled.'], ['Insights', 'Know where time goes.']]}},
    wellness: {kw: /meditat|sleep|calm|mindful|wellness|wellbeing|yoga|breath|therapy|mood|journal|mental/i, hue: 'rose', mode: 'light', name: 'Hush',
      hero: ['Breathe in.', 'Sleep deeper.'], heroSub: ['Guided sessions and soundscapes', 'that help you unwind in minutes.'], cta: 'Begin a session', chip: '+38 min',
      user: 'Noor Haddad', handle: '@noorbreathes', balLabel: 'Mindful minutes', bal: '214 min', delta: '+38 min this week',
      actions: [['Breathe', 'ring'], ['Sleep', 'dot'], ['Focus', 'wave'], ['Journal', 'card']],
      listTitle: 'For tonight', items: [['Ocean wind-down', 'Sleep story', '20 min'], ['Body scan', 'Guided · Relax', '12 min'], ['Box breathing', 'Breathwork', '5 min']],
      detail: {kicker: 'Session', title: 'Evening Reset', meta: 'Guided · Noor · 15 min', big: '15 min', bigSub: 'Day 6 of your 10-day calm series', pct: .6, tiles: [['Focus', 'Unwinding'], ['Played', '2.1k today']], desc: ['Release the day with slow breathing', 'and a gentle full-body scan.'], cta: 'Play session'},
      stats: {title: 'Your calm', segs: ['Week', 'Month', 'Year'], value: '7h 42m', sub: 'Average sleep · 26 min more than last month', tip: '8h 10m', list: 'Sessions', cats: [['Sleep', 40], ['Breathing', 25], ['Focus', 20], ['Movement', 15]]},
      settings: ['Reminders', 'Sleep schedule', 'Health sync', 'Downloads', 'Help'], pstats: [['21', 'Day streak'], ['214', 'Minutes'], ['48', 'Sessions']],
      web: {nav: ['Today', 'Library', 'Programs', 'Members', 'Settings'], title: 'Studio overview', kpis: [['Members', '24,180', '+5.2%'], ['Minutes', '1.8M', '+12%'], ['Retention', '78%', '+2%'], ['Avg session', '14 min', '+1 min']], chart: 'Minutes listened', side: 'Popular programs', rowsTitle: 'New sessions', cols: ['Session', 'Category', 'Published', 'Plays'], rows: [['Evening reset', 'Sleep', 'Oct 20', '21.4k'], ['Desk stretch', 'Movement', 'Oct 18', '9.8k']]},
      land: {nav: ['Sessions', 'Sleep', 'Teams', 'Pricing'], kicker: 'New · Sleep stories', title: ['Calm,', 'on demand.'], sub: ['Short guided sessions and soundscapes that help you', 'focus by day and fall asleep faster at night.'], cta: 'Try Hush free', cta2: 'Hear a sample', proof: '5M mindful minutes', proofSub: 'Every single week', features: [['Sleep stories', 'Drift off in minutes.'], ['Breathwork', 'Reset in one minute.'], ['Daily streaks', 'Tiny habits that stick.']]}}
  };

  function generic(name) {
    return {hue: 'violet', mode: 'light', name,
      hero: ['Meet ' + name + '.', 'Built for your flow.'], heroSub: ['Everything you need in one calm,', 'beautifully simple space.'], cta: 'Get started', chip: '+12%',
      user: 'Taylor Brooks', handle: '@taylor', balLabel: 'This week', bal: '1,284', delta: '+12% since last week',
      actions: [['Create', 'plus'], ['Browse', 'grid'], ['Saved', 'dot'], ['Stats', 'bars']],
      listTitle: 'Recent', items: [['Weekly review', 'Today · 9:00 AM', 'New'], ['Team update', 'Yesterday · Post', '3 min'], ['Starter guide', 'Mon · Guide', '5 min']],
      detail: {kicker: 'Featured', title: name + ' Essentials', meta: 'Updated today · 6 min read', big: '92%', bigSub: 'Of people finish this in a week', pct: .72, tiles: [['Steps', '8'], ['Level', 'Beginner']], desc: ['A quick tour of everything you can do,', 'with tips from the people who built it.'], cta: 'Continue'},
      stats: {title: 'Insights', segs: ['Week', 'Month', 'Year'], value: '1,284', sub: 'Actions this month · 12% more than last', tip: '164', list: 'Breakdown', cats: [['Created', 38], ['Shared', 26], ['Saved', 20], ['Archived', 16]]},
      settings: ['Notifications', 'Account', 'Privacy', 'Appearance', 'Help & support'], pstats: [['128', 'Items'], ['24', 'Shared'], ['9', 'Day streak']],
      web: {nav: ['Home', 'Explore', 'Library', 'Team', 'Settings'], title: 'Overview', kpis: [['Active users', '12,480', '+8.4%'], ['Sessions', '48.2k', '+12%'], ['Conversion', '4.6%', '+0.4%'], ['Revenue', '$32.1k', '+9%']], chart: 'Activity', side: 'Top sources', rowsTitle: 'Recent activity', cols: ['Name', 'Type', 'Date', 'Status'], rows: [['Weekly review', 'Report', 'Oct 24', 'Done'], ['Team update', 'Post', 'Oct 23', 'Live']]},
      land: {nav: ['Product', 'Pricing', 'Customers', 'Help'], kicker: 'New · Version 2.0', title: ['Meet ' + name + '.', 'Simply better.'], sub: ['The simplest way to get it done, designed for', 'people who care about the details.'], cta: 'Get started', cta2: 'Watch the demo', proof: '20,000+ people', proofSub: 'Use it every single day', features: [['Fast by default', 'Everything in one click.'], ['Works everywhere', 'Phone, tablet and web.'], ['Private', 'Your data stays yours.']]}};
  }

  const stop = new Set('a an the app apps application ui ux screen screens design designs mobile web website site for with and of to my our that which simple modern beautiful clean minimal minimalist dark light mode new platform tool dashboard called named me make build create i want need some please using in on like style based about'.split(' '));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function productName(brief) {
    const quoted = brief.match(/["“]([^"“”\n]{1,24})["”]/);
    if (quoted) return quoted[1].trim();
    const called = brief.match(/\b(?:called|named)\s+([A-Za-z][\w-]{1,18})/i);
    if (called) return cap(called[1]);
    return null;
  }

  function pick(brief) {
    const text = brief || '';
    let key = Object.keys(packs).find(k => packs[k].kw.test(text));
    const named = productName(text);
    let pack;
    if (key) pack = Object.assign({}, packs[key]);
    else {
      const word = (text.toLowerCase().match(/[a-z]{3,}/g) || []).find(w => !stop.has(w));
      pack = generic((named || (word ? cap(word) : 'Nova')).slice(0, 14));
      key = 'generic';
    }
    let hue = pack.hue, mode = pack.mode;
    const colours = [[/purple|violet|lavender/i, 'violet'], [/\bred\b|coral|crimson/i, 'coral'], [/blue|ocean|navy|cyan/i, 'ocean'], [/lime|neon|electric/i, 'lime'], [/orange|yellow|gold|amber/i, 'sun'], [/green|emerald|mint|teal/i, 'emerald'], [/pink|rose|magenta/i, 'rose']];
    for (const [re, h] of colours) if (re.test(text)) { hue = h; break; }
    if (/\bdark|night|black|midnight/i.test(text)) mode = 'dark';
    else if (/\blight\b|white|bright|airy/i.test(text)) mode = 'light';
    if (hue === 'lime' && mode === 'light') hue = 'emerald';
    if (named && key !== 'generic') {
      const old = pack.name, swap = s => typeof s === 'string' ? s.split(old).join(named) : s;
      pack.name = named.slice(0, 14);
      pack.land = Object.assign({}, pack.land, {sub: pack.land.sub.map(swap)});
    }
    return {pack, theme: theme(hue, mode), domain: key};
  }

  /* ---------- drawing helpers ---------- */
  const est = (text, size, weight) => Math.ceil(Math.max(...String(text).split('\n').map(l => l.length)) * size * (weight >= 600 ? .58 : .54));
  function builder(name, width, height, background) {
    const layers = [];
    const push = o => (layers.push(o), o);
    const extra = (o, keys) => { const out = {}; for (const k of keys) if (o[k] !== undefined) out[k] = o[k]; return out; };
    const b = {
      screen: () => ({name, width, height, background, layers}),
      rect: (n, x, y, w, h, fill, o = {}) => push(Object.assign({kind: 'rect', name: n, x, y, w, h, fill}, extra(o, ['r', 'stroke', 'sw', 'shadow', 'opacity']))),
      oval: (n, x, y, w, h, fill, o = {}) => push(Object.assign({kind: 'ellipse', name: n, x, y, w, h, fill}, extra(o, ['stroke', 'sw', 'shadow', 'opacity']))),
      text: (n, text, x, y, size, fill, o = {}) => {
        const weight = o.weight || 400, lh = o.lh || 1.3, lines = String(text).split('\n').length;
        return push(Object.assign({kind: 'text', name: n, text, x, y, w: o.w || est(text, size, weight), h: Math.ceil(lines * size * lh), size, fill, weight, align: o.align || 'left', lh}, extra(o, ['opacity'])));
      },
      center: (n, text, cx, y, size, fill, o = {}) => { const w = o.w || est(text, size, o.weight || 400) + 8; return b.text(n, text, cx - w / 2, y, size, fill, Object.assign({}, o, {w, align: 'center'})); },
      right: (n, text, right, y, size, fill, o = {}) => { const w = o.w || est(text, size, o.weight || 400) + 4; return b.text(n, text, right - w, y, size, fill, Object.assign({}, o, {w, align: 'right'})); },
      line: (n, x, y, w, h, points, stroke, sw = 2.5) => push({kind: 'line', name: n, x, y, w, h, points, stroke, sw, fill: null})
    };
    return b;
  }

  function glyph(b, kind, cx, cy, s, color, label = 'Icon') {
    const n = label + ' glyph';
    switch (kind) {
      case 'plus': b.rect(n, cx - s / 2, cy - 1.25, s, 2.5, color, {r: 1.25}); b.rect(n, cx - 1.25, cy - s / 2, 2.5, s, color, {r: 1.25}); break;
      case 'ring': b.oval(n, cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2, null, {stroke: color, sw: 2.2}); break;
      case 'bars': [.45, .75, 1].forEach((k, i) => b.rect(n, cx - s / 2 + i * s * .38, cy + s / 2 - s * k, s * .24, s * k, color, {r: 1.5})); break;
      case 'grid': [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([i, j]) => b.rect(n, cx - s / 2 + i * s * .56, cy - s / 2 + j * s * .56, s * .44, s * .44, color, {r: 2})); break;
      case 'card': b.rect(n, cx - s / 2, cy - s * .36, s, s * .72, null, {r: 3, stroke: color, sw: 2}); b.rect(n, cx - s / 2, cy - s * .12, s, 2.4, color); break;
      case 'wave': b.line(n, cx - s / 2, cy - s * .32, s, s * .64, [[0, .6], [.25, 0], [.5, .85], [.75, .15], [1, .55]], color, 2.2); break;
      case 'pin': b.oval(n, cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2, null, {stroke: color, sw: 2.2}); b.oval(n, cx - s * .16, cy - s * .16, s * .32, s * .32, color); break;
      default: b.oval(n, cx - s * .32, cy - s * .32, s * .64, s * .64, color);
    }
  }
  function status(b, color) {
    b.text('Time', '9:41', 30, 15, 15, color, {weight: 600});
    [5, 7.5, 10].forEach((h, i) => b.rect('Signal', 292 + i * 5.5, 29 - h, 3.5, h, color, {r: 1}));
    b.rect('Battery', 318, 18.5, 25, 12.5, null, {r: 4, stroke: color, sw: 1.2, opacity: .45});
    b.rect('Battery level', 320.5, 21, 17, 7.5, color, {r: 2});
    b.rect('Battery cap', 344.5, 22.5, 1.8, 4.5, color, {r: 1, opacity: .45});
  }
  const indicator = (b, color) => b.rect('Home indicator', 128, 830, 134, 5, color, {r: 2.5});
  const initials = name => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const trend = [[0, .72], [.12, .58], [.24, .64], [.37, .42], [.5, .5], [.62, .3], [.75, .38], [.88, .16], [1, .08]];
  const bars12 = [38, 52, 44, 61, 48, 72, 66, 58, 80, 74, 92, 86];
  const curveA = [[0, .78], [.1, .7], [.2, .74], [.3, .56], [.4, .6], [.5, .42], [.6, .48], [.7, .3], [.8, .36], [.9, .16], [1, .1]];
  const curveB = [[0, .86], [.1, .82], [.2, .8], [.3, .72], [.4, .76], [.5, .64], [.6, .66], [.7, .58], [.8, .6], [.9, .5], [1, .46]];
  const icons = ['dot', 'bars', 'grid', 'card', 'ring', 'wave', 'plus', 'pin'];

  /* ---------- screens ---------- */
  function onboarding(P, T) {
    const b = builder(P.name + ' · Welcome', 390, 844, T.bg), sheet = T.mode === 'light' ? T.surface : T.bg;
    b.rect('Hero', 0, 0, 390, 540, T.grad);
    b.oval('Hero glow', -90, 40, 300, 300, '#FFFFFF', {opacity: .13});
    b.oval('Hero glow', 220, 250, 260, 260, '#FFFFFF', {opacity: .1});
    status(b, T.on);
    b.rect('Preview card', 58, 156, 274, 176, T.surface, {r: 26, shadow: true});
    b.rect('Preview icon', 80, 178, 40, 40, T.soft, {r: 12}); glyph(b, P.actions[0][1], 100, 198, 16, T.accent, 'Preview');
    b.text('Preview label', P.balLabel, 132, 178, 12.5, T.muted, {weight: 500});
    b.text('Preview value', P.bal, 132, 195, 19, T.ink, {weight: 700});
    bars12.slice(4, 11).forEach((v, i) => { const h = v * .62; b.rect('Preview bar', 80 + i * 34, 312 - h, 18, h, i === 5 ? T.accent : T.soft, {r: 5}); });
    b.rect('Delta chip', 216, 116, 136, 40, T.surface, {r: 20, shadow: true});
    b.oval('Delta dot', 232, 130, 12, 12, T.good);
    b.text('Delta chip label', P.chip, 252, 127, 13, T.ink, {weight: 600});
    b.rect('Sheet', 0, 500, 390, 400, sheet, {r: 34});
    b.rect('Page dot', 24, 532, 26, 8, T.accent, {r: 4});
    b.oval('Page dot', 56, 532, 8, 8, T.faint); b.oval('Page dot', 70, 532, 8, 8, T.faint);
    b.text('Headline', P.hero.join('\n'), 24, 558, 32, T.ink, {weight: 700, lh: 1.15});
    b.text('Subhead', P.heroSub.join('\n'), 24, 644, 16, T.muted, {lh: 1.45});
    b.rect('Primary button', 24, 722, 342, 58, T.accent, {r: 18});
    b.center('Primary button label', P.cta, 195, 740.6, 16, T.on, {weight: 600, w: 300});
    b.center('Sign in link', 'I already have an account', 195, 796, 14, T.muted, {weight: 500, w: 300});
    indicator(b, T.ink);
    return b.screen();
  }

  function home(P, T) {
    const b = builder(P.name + ' · Home', 390, 844, T.bg), light = T.mode === 'light';
    status(b, T.ink);
    b.oval('Avatar', 24, 62, 46, 46, {from: T.accent2, to: T.accent, dir: 'd'});
    b.center('Avatar initials', initials(P.user), 47, 74.6, 16, '#FFFFFF', {weight: 700, w: 46});
    b.text('Greeting', 'Good morning', 84, 64, 13, T.muted, {weight: 500});
    b.text('User name', P.user, 84, 82, 18, T.ink, {weight: 700});
    b.rect('Notifications', 322, 62, 44, 44, T.surface, light ? {r: 22, stroke: T.faint, sw: 1} : {r: 22});
    glyph(b, 'ring', 344, 84, 16, T.ink, 'Notifications');
    b.oval('Unread badge', 352, 68, 10, 10, T.accent2);
    b.rect('Balance card', 24, 126, 342, 200, T.grad, {r: 28, shadow: true});
    b.oval('Card glow', 246, 140, 104, 104, '#FFFFFF', {opacity: .12});
    b.oval('Card glow', 188, 214, 96, 96, '#FFFFFF', {opacity: .08});
    b.text('Balance label', P.balLabel, 48, 150, 14, T.on, {weight: 500, opacity: .82});
    b.text('Balance', P.bal, 48, 172, 34, T.on, {weight: 700, lh: 1.2});
    const dw = est(P.delta, 12, 600) + 24;
    b.rect('Delta pill', 48, 222, dw, 28, '#FFFFFF', {r: 14, opacity: .2});
    b.text('Delta', P.delta, 60, 228.2, 12, T.on, {weight: 600});
    b.line('Balance trend', 48, 264, 294, 44, trend, T.on, 2.5);
    P.actions.forEach(([label, kind], k) => {
      const x = 24 + k * 90;
      b.rect(label + ' action', x, 350, 72, 72, T.surface, light ? {r: 22, stroke: T.faint, sw: 1} : {r: 22});
      glyph(b, kind, x + 36, 386, 20, T.accent, label);
      b.center(label + ' label', label, x + 36, 430, 12.5, T.muted, {weight: 500, w: 84});
    });
    b.text('Section title', P.listTitle, 24, 470, 18, T.ink, {weight: 700});
    b.right('See all', 'See all', 366, 473, 14, T.accent, {weight: 600, w: 80});
    b.rect('List card', 24, 506, 342, 222, T.surface, {r: 24, shadow: light});
    P.items.slice(0, 3).forEach(([title, meta, value], i) => {
      const y = 516 + i * 70;
      b.rect(title + ' icon', 40, y + 12, 44, 44, i % 2 ? T.soft2 : T.soft, {r: 14});
      glyph(b, icons[(i + 1) % icons.length], 62, y + 34, 16, i % 2 ? T.accent2 : T.accent, title);
      b.text(title, title, 98, y + 14, 15, T.ink, {weight: 600});
      b.text(title + ' meta', meta, 98, y + 36, 12.5, T.muted);
      b.right(title + ' value', value, 350, y + 24, 15, value.startsWith('+') ? T.good : T.ink, {weight: 600, w: 90});
      if (i < 2) b.rect('Divider', 98, y + 69, 252, 1, T.faint);
    });
    b.rect('Tab bar', 58, 750, 274, 62, T.nav, {r: 31, shadow: true});
    b.rect('Active tab', 66, 758, 96, 46, T.accent, {r: 23});
    glyph(b, 'grid', 90, 781, 15, T.on, 'Home tab');
    b.text('Home tab label', 'Home', 104, 772.5, 13, T.on, {weight: 600});
    const dim = mix('#FFFFFF', T.nav, .45);
    ['bars', 'ring', 'dot'].forEach((k, i) => glyph(b, k, 202 + i * 50, 781, 17, dim, ['Stats', 'Search', 'Profile'][i] + ' tab'));
    indicator(b, T.ink);
    return b.screen();
  }

  function detail(P, T) {
    const D = P.detail, light = T.mode === 'light';
    const b = builder(P.name + ' · ' + D.kicker, 390, 844, light ? T.surface : T.bg);
    b.rect('Cover', 0, 0, 390, 380, T.grad);
    b.oval('Cover shape', 170, -70, 300, 300, '#FFFFFF', {opacity: .12});
    b.oval('Cover shape', -70, 170, 230, 230, T.accent2, {opacity: .35});
    b.oval('Cover shape', 250, 196, 120, 120, '#FFFFFF', {opacity: .16});
    status(b, T.on);
    b.rect('Back button', 24, 58, 44, 44, '#FFFFFF', {r: 22, opacity: .22});
    b.center('Back arrow', '‹', 46, 61, 26, T.on, {weight: 500, w: 44});
    b.rect('Save button', 322, 58, 44, 44, '#FFFFFF', {r: 22, opacity: .22});
    glyph(b, 'dot', 344, 80, 14, T.on, 'Save');
    const kicker = D.kicker.toUpperCase(), kw = est(kicker, 11.5, 700) + 24;
    b.rect('Kicker', 24, 270, kw, 28, '#FFFFFF', {r: 14, opacity: .24});
    b.text('Kicker label', kicker, 36, 276.5, 11.5, T.on, {weight: 700});
    b.text('Title', D.title, 24, 306, 30, T.on, {weight: 700, lh: 1.2});
    b.rect('Sheet', 0, 360, 390, 540, light ? T.surface : T.bg, {r: 32});
    b.text('Meta', D.meta, 24, 392, 14, T.muted, {weight: 500});
    b.text('Big number', D.big, 24, 418, 44, T.ink, {weight: 700, lh: 1.15});
    b.text('Big number label', D.bigSub, 24, 472, 14.5, T.muted);
    b.rect('Progress track', 24, 508, 342, 10, T.faint, {r: 5});
    b.rect('Progress', 24, 508, Math.round(342 * D.pct), 10, T.accent, {r: 5});
    D.tiles.forEach(([label, value], k) => {
      const x = 24 + k * 179;
      b.rect(label + ' tile', x, 544, 163, 92, light ? T.bg : T.surface, {r: 20});
      b.text(label, label, x + 18, 564, 12.5, T.muted, {weight: 500});
      b.text(label + ' value', value, x + 18, 586, 19, T.ink, {weight: 700});
    });
    b.text('Description', D.desc.join('\n'), 24, 662, 15, T.muted, {lh: 1.5});
    b.rect('Primary button', 24, 740, 342, 58, T.accent, {r: 18, shadow: light});
    b.center('Primary button label', D.cta, 195, 758.6, 16, T.on, {weight: 600, w: 300});
    indicator(b, T.ink);
    return b.screen();
  }

  function insights(P, T) {
    const S = P.stats, light = T.mode === 'light';
    const b = builder(P.name + ' · ' + S.title, 390, 844, T.bg);
    status(b, T.ink);
    b.text('Title', S.title, 24, 62, 30, T.ink, {weight: 700, lh: 1.2});
    b.rect('Filter button', 322, 60, 44, 44, T.surface, light ? {r: 22, stroke: T.faint, sw: 1} : {r: 22});
    glyph(b, 'grid', 344, 82, 14, T.ink, 'Filter');
    b.rect('Segmented control', 24, 116, 342, 44, light ? '#EBEBF1' : T.surface, {r: 14});
    const seg = 334 / 3;
    b.rect('Selected segment', 28 + seg, 120, seg, 36, light ? T.surface : T.surface2, {r: 11, shadow: light});
    S.segs.forEach((s, k) => b.center(s + ' segment', s, 28 + seg * (k + .5), 128.9, 14, k === 1 ? T.ink : T.muted, {weight: k === 1 ? 600 : 500, w: 100}));
    b.text('Total', S.value, 24, 182, 34, T.ink, {weight: 700, lh: 1.2});
    b.text('Total label', S.sub, 24, 228, 14, T.muted);
    b.rect('Chart card', 24, 264, 342, 238, T.surface, {r: 24, shadow: light});
    b.text('Chart caption', 'Last 12 months', 44, 284, 13, T.muted, {weight: 500});
    const max = Math.max(...bars12);
    bars12.forEach((v, i) => {
      const h = v / max * 128, x = 46 + i * 25;
      b.rect('Bar ' + (i + 1), x, 462 - h, 14, h, i === 10 ? T.accent : T.soft, {r: 5});
      b.center('Month', 'JFMAMJJASOND'[i], x + 7, 470, 11, i === 10 ? T.ink : T.muted, {weight: 500, w: 16});
    });
    b.rect('Tooltip', 269, 300, 68, 26, light ? T.ink : T.surface2, {r: 9});
    b.center('Tooltip value', S.tip, 303, 305.4, 12, light ? '#FFFFFF' : T.ink, {weight: 600, w: 64});
    b.text('Section title', S.list, 24, 526, 18, T.ink, {weight: 700});
    const top = Math.max(...S.cats.map(c => c[1]));
    S.cats.forEach(([cat, pct], i) => {
      const y = 562 + i * 64, col = i % 2 ? T.accent2 : T.accent;
      b.rect(cat + ' icon', 24, y, 44, 44, i % 2 ? T.soft2 : T.soft, {r: 14});
      glyph(b, icons[(i + 2) % icons.length], 46, y + 22, 16, col, cat);
      b.text(cat, cat, 82, y + 3, 15, T.ink, {weight: 600});
      b.rect(cat + ' track', 82, y + 30, 214, 6, T.faint, {r: 3});
      b.rect(cat + ' fill', 82, y + 30, Math.round(214 * pct / top), 6, col, {r: 3});
      b.right(cat + ' share', pct + '%', 366, y + 12, 15, T.ink, {weight: 600, w: 56});
    });
    indicator(b, T.ink);
    return b.screen();
  }

  function profile(P, T) {
    const light = T.mode === 'light', b = builder(P.name + ' · Profile', 390, 844, T.bg);
    b.rect('Header', 0, 0, 390, 256, T.grad);
    b.oval('Header glow', -60, -80, 240, 240, '#FFFFFF', {opacity: .12});
    b.oval('Header glow', 262, 116, 200, 200, '#FFFFFF', {opacity: .1});
    status(b, T.on);
    b.text('Header title', 'Profile', 24, 64, 20, T.on, {weight: 700});
    b.rect('Settings button', 322, 56, 44, 44, '#FFFFFF', {r: 22, opacity: .22});
    glyph(b, 'grid', 344, 78, 14, T.on, 'Settings');
    b.oval('Avatar ring', 143, 178, 104, 104, T.bg);
    b.oval('Avatar', 149, 184, 92, 92, {from: T.accent2, to: T.accent, dir: 'd'});
    b.center('Avatar initials', initials(P.user), 195, 210.5, 30, '#FFFFFF', {weight: 700, w: 92});
    b.oval('Status ring', 219, 254, 22, 22, T.bg);
    b.oval('Online', 223, 258, 14, 14, T.good);
    b.center('Name', P.user, 195, 294, 22, T.ink, {weight: 700, w: 300});
    b.center('Handle', P.handle, 195, 324, 14, T.muted, {weight: 500, w: 300});
    b.rect('Stats card', 24, 362, 342, 88, T.surface, {r: 22, shadow: light});
    P.pstats.forEach(([v, label], k) => {
      const cx = 81 + k * 114;
      b.center(label + ' value', v, cx, 378, 20, T.ink, {weight: 700, w: 104});
      b.center(label, label, cx, 408, 12.5, T.muted, {weight: 500, w: 104});
      if (k < 2) b.rect('Divider', 138 + k * 114, 380, 1, 52, T.faint);
    });
    b.rect('Settings card', 24, 472, 342, 300, T.surface, {r: 22, shadow: light});
    P.settings.forEach((s, i) => {
      const y = 472 + i * 60;
      b.rect(s + ' icon', 40, y + 12, 36, 36, i % 2 ? T.soft2 : T.soft, {r: 11});
      glyph(b, icons[(i + 4) % icons.length], 58, y + 30, 14, i % 2 ? T.accent2 : T.accent, s);
      b.text(s, s, 90, y + 20, 15, T.ink, {weight: 500});
      if (i === 0) { b.rect('Toggle', 308, y + 18, 42, 24, T.accent, {r: 12}); b.oval('Toggle knob', 328, y + 21, 18, 18, '#FFFFFF'); }
      else b.right('Chevron', '›', 352, y + 15.7, 22, T.muted, {w: 16});
      if (i < 4) b.rect('Divider', 90, y + 59.5, 260, 1, T.faint);
    });
    b.center('Sign out', 'Sign out', 195, 792, 15, T.bad, {weight: 600, w: 200});
    indicator(b, T.ink);
    return b.screen();
  }

  function dashboard(P, T) {
    const W = P.web, light = T.mode === 'light', b = builder(P.name + ' · Dashboard', 1280, 800, T.bg);
    b.rect('Sidebar', 0, 0, 248, 800, T.surface);
    b.rect('Sidebar border', 247, 0, 1, 800, T.faint);
    b.rect('Logo', 28, 28, 36, 36, T.grad, {r: 11}); glyph(b, 'dot', 46, 46, 16, T.on, 'Logo');
    b.text('Product name', P.name, 76, 35, 18, T.ink, {weight: 700});
    W.nav.forEach((label, i) => {
      const y = 100 + i * 48;
      if (!i) b.rect('Active nav', 16, y, 216, 40, T.soft, {r: 12});
      glyph(b, icons[i % icons.length], 40, y + 20, 15, i ? T.muted : T.accent, label);
      b.text(label + ' nav', label, 62, y + 10.6, 14.5, i ? T.muted : (light ? T.accent : T.ink), {weight: i ? 500 : 600});
    });
    b.rect('Upgrade card', 16, 620, 216, 160, T.grad, {r: 20});
    b.oval('Upgrade glow', 150, 640, 70, 70, '#FFFFFF', {opacity: .14});
    b.text('Upgrade title', 'Go Pro', 36, 642, 17, T.on, {weight: 700});
    b.text('Upgrade copy', 'Unlock reports, exports\nand unlimited history.', 36, 670, 12.5, T.on, {lh: 1.45, opacity: .85});
    b.rect('Upgrade button', 36, 726, 112, 36, '#FFFFFF', {r: 11});
    b.center('Upgrade label', 'Upgrade', 92, 735.2, 13, '#15151E', {weight: 700, w: 100});
    b.text('Page title', W.title, 288, 34, 26, T.ink, {weight: 700, lh: 1.2});
    b.text('Date', 'Thursday, October 24', 288, 70, 14, T.muted);
    b.rect('Search', 720, 34, 300, 44, T.surface, {r: 14, stroke: T.faint, sw: 1});
    glyph(b, 'ring', 746, 56, 14, T.muted, 'Search');
    b.text('Search placeholder', 'Search anything…', 766, 47, 14, T.muted);
    b.rect('Notifications', 1036, 34, 44, 44, T.surface, {r: 14, stroke: T.faint, sw: 1});
    glyph(b, 'ring', 1058, 56, 15, T.ink, 'Notifications');
    b.oval('Unread badge', 1066, 42, 9, 9, T.accent2);
    b.oval('Avatar', 1094, 34, 44, 44, {from: T.accent2, to: T.accent, dir: 'd'});
    b.center('Avatar initials', initials(P.user), 1116, 46.2, 15, '#FFFFFF', {weight: 700, w: 44});
    b.text('User name', P.user, 1150, 37, 14, T.ink, {weight: 600});
    b.text('User role', 'Admin', 1150, 57, 12.5, T.muted);
    W.kpis.forEach(([label, value, delta], k) => {
      const x = 288 + k * 243;
      b.rect(label + ' card', x, 112, 223, 132, T.surface, {r: 20, shadow: light});
      b.rect(label + ' icon', x + 20, 132, 38, 38, k % 2 ? T.soft2 : T.soft, {r: 12});
      glyph(b, icons[(k + 1) % icons.length], x + 39, 151, 16, k % 2 ? T.accent2 : T.accent, label);
      const dw = est(delta, 12, 600) + 20;
      b.rect(label + ' delta', x + 203 - dw, 138, dw, 26, T.goodSoft, {r: 13});
      b.text(label + ' delta label', delta, x + 213 - dw, 143.2, 12, T.good, {weight: 600});
      b.text(label, label, x + 20, 186, 13, T.muted, {weight: 500});
      b.text(label + ' value', value, x + 20, 206, 24, T.ink, {weight: 700, lh: 1.2});
    });
    b.rect('Chart card', 288, 268, 620, 316, T.surface, {r: 20, shadow: light});
    b.text('Chart title', W.chart, 312, 290, 17, T.ink, {weight: 700});
    b.oval('Legend', 712, 297, 10, 10, T.accent); b.text('Legend label', 'This year', 728, 292.5, 13, T.muted, {weight: 500});
    b.oval('Legend', 808, 297, 10, 10, T.line2); b.text('Legend label', 'Last year', 824, 292.5, 13, T.muted, {weight: 500});
    [350, 400, 450, 500].forEach(y => b.rect('Grid line', 312, y, 572, 1, T.faint));
    b.line('Last year', 312, 334, 572, 186, curveB, T.line2, 2.5);
    b.line('This year', 312, 334, 572, 186, curveA, T.accent, 3);
    ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].forEach((m, i) => b.center(m, m, 332 + i * 106, 540, 12, T.muted, {weight: 500, w: 40}));
    b.rect('Breakdown card', 928, 268, 312, 316, T.surface, {r: 20, shadow: light});
    b.text('Breakdown title', W.side, 952, 290, 17, T.ink, {weight: 700});
    const cats = P.stats.cats, sum = cats.reduce((n, c) => n + c[1], 0), cols = [T.accent, T.accent2, mix(T.accent, T.ink, .35), T.line2];
    let x = 952;
    cats.forEach(([cat, v], i) => { const w = Math.max(8, 264 * v / sum - 4); b.rect(cat + ' segment', x, 334, w, 14, cols[i], {r: 5}); x += w + 4; });
    cats.forEach(([cat, v], i) => {
      const y = 378 + i * 50;
      b.oval(cat + ' dot', 952, y + 4.5, 10, 10, cols[i]);
      b.text(cat + ' name', cat, 972, y, 14, T.ink, {weight: 500});
      b.right(cat + ' share', Math.round(v / sum * 100) + '%', 1216, y, 14, T.ink, {weight: 600, w: 50});
      if (i < 3) b.rect('Divider', 952, y + 33, 264, 1, T.faint);
    });
    b.rect('Table card', 288, 604, 952, 176, T.surface, {r: 20, shadow: light});
    b.text('Table title', W.rowsTitle, 312, 624, 17, T.ink, {weight: 700});
    b.right('View all', 'View all', 1216, 626, 13.5, light ? T.accent : T.ink, {weight: 600, w: 80});
    const cx = [312, 620, 860];
    W.cols.forEach((c, i) => i < 3 ? b.text(c + ' column', c.toUpperCase(), cx[i], 664, 11.5, T.muted, {weight: 600}) : b.right(c + ' column', c.toUpperCase(), 1216, 664, 11.5, T.muted, {weight: 600, w: 100}));
    b.rect('Header divider', 312, 688, 904, 1, T.faint);
    W.rows.forEach((row, j) => {
      const y = 700 + j * 40, col = j ? T.accent2 : T.accent;
      b.oval(row[0] + ' avatar', 312, y + 2, 26, 26, j ? T.soft2 : T.soft);
      b.center(row[0] + ' initial', row[0].replace(/[^A-Za-z0-9]/g, '')[0] || '#', 325, y + 7.2, 12, light ? col : T.ink, {weight: 700, w: 26});
      b.text(row[0], row[0], 350, y + 5.9, 14, T.ink, {weight: 600});
      const cw = est(row[1], 12, 600) + 20;
      b.rect(row[1] + ' tag', 620, y + 3, cw, 24, j ? T.soft2 : T.soft, {r: 12});
      b.text(row[1] + ' tag label', row[1], 630, y + 7.2, 12, light ? col : T.ink, {weight: 600});
      b.text(row[0] + ' date', row[2], 860, y + 5.9, 14, T.muted);
      b.right(row[0] + ' amount', row[3], 1216, y + 5.9, 14, row[3].startsWith('+') ? T.good : T.ink, {weight: 600, w: 100});
      if (!j) b.rect('Divider', 312, y + 36, 904, 1, T.faint);
    });
    return b.screen();
  }

  function landing(P, T) {
    const L = P.land, light = T.mode === 'light', bg = light ? T.surface : T.bg;
    const b = builder(P.name + ' · Landing', 1280, 800, bg);
    b.oval('Glow', 720, -220, 720, 720, T.soft);
    b.oval('Glow', 1000, 320, 460, 460, T.soft2, {opacity: .8});
    b.rect('Logo', 64, 32, 34, 34, T.grad, {r: 10}); glyph(b, 'dot', 81, 49, 14, T.on, 'Logo');
    b.text('Product name', P.name, 108, 38, 18, T.ink, {weight: 700});
    L.nav.forEach((n, i) => b.text(n + ' link', n, 470 + i * 112, 41, 14.5, T.muted, {weight: 500}));
    b.text('Sign in', 'Sign in', 1030, 41, 14.5, T.ink, {weight: 600});
    b.rect('Nav button', 1104, 30, 112, 40, T.ink, {r: 12});
    b.center('Nav button label', 'Get started', 1160, 40.6, 13.5, light ? '#FFFFFF' : '#0C0C11', {weight: 600, w: 104});
    const kw = est(L.kicker, 13, 600) + 44;
    b.rect('Kicker', 64, 148, kw, 34, T.soft, {r: 17});
    b.oval('Kicker dot', 80, 161, 8, 8, T.accent);
    b.text('Kicker label', L.kicker, 96, 156.5, 13, light ? T.accent : T.ink, {weight: 600});
    b.text('Headline', L.title.join('\n'), 64, 204, 64, T.ink, {weight: 800, lh: 1.05});
    b.text('Subhead', L.sub.join('\n'), 64, 362, 18, T.muted, {lh: 1.5});
    const cw = est(L.cta, 16, 600) + 56, c2 = est(L.cta2, 16, 600) + 56;
    b.rect('Primary CTA', 64, 452, cw, 58, T.accent, {r: 16, shadow: true});
    b.center('Primary CTA label', L.cta, 64 + cw / 2, 470.6, 16, T.on, {weight: 600, w: cw - 16});
    b.rect('Secondary CTA', 78 + cw, 452, c2, 58, T.surface, {r: 16, stroke: T.faint, sw: 1.5});
    b.center('Secondary CTA label', L.cta2, 78 + cw + c2 / 2, 470.6, 16, T.ink, {weight: 600, w: c2 - 16});
    [T.accent, T.accent2, mix(T.accent, T.ink, .35), mix(T.accent2, '#FFFFFF', .3)].forEach((c, k) => b.oval('Customer avatar', 64 + k * 26, 552, 38, 38, c, {stroke: bg, sw: 3}));
    b.text('Social proof', L.proof, 190, 552, 15, T.ink, {weight: 700});
    b.text('Social proof detail', L.proofSub, 190, 573, 13, T.muted);
    const body = light ? '#15151E' : '#2A2A34';
    b.rect('Phone', 820, 96, 280, 560, body, {r: 46, shadow: true});
    b.rect('Phone screen', 832, 108, 256, 536, T.bg, {r: 36});
    b.rect('Phone notch', 920, 118, 80, 22, body, {r: 11});
    b.rect('Mini card', 848, 158, 224, 132, T.grad, {r: 22});
    b.text('Mini label', P.balLabel, 866, 176, 11, T.on, {weight: 500, opacity: .85});
    b.text('Mini value', P.bal, 866, 192, 22, T.on, {weight: 700});
    b.line('Mini trend', 866, 238, 188, 34, trend, T.on, 2);
    [96, 120, 80].forEach((w, k) => {
      const y = 306 + k * 62;
      b.rect('Mini row', 848, y, 224, 50, T.surface, {r: 14});
      b.rect('Mini icon', 858, y + 9, 32, 32, k % 2 ? T.soft2 : T.soft, {r: 10});
      b.rect('Skeleton', 900, y + 14, w, 8, T.line2, {r: 4});
      b.rect('Skeleton', 900, y + 29, [64, 52, 72][k], 7, T.faint, {r: 3.5});
    });
    b.rect('Mini chart', 848, 498, 224, 76, T.surface, {r: 14});
    [24, 36, 28, 44, 32, 40].forEach((h, k) => b.rect('Mini bar', 866 + k * 33, 562 - h, 18, h, k === 3 ? T.accent : T.soft, {r: 4}));
    b.rect('Mini button', 848, 588, 224, 40, T.accent, {r: 14});
    b.rect('Floating card', 690, 470, 214, 92, T.surface, {r: 22, shadow: true});
    b.rect('Floating icon', 708, 490, 52, 52, T.soft2, {r: 16});
    glyph(b, 'bars', 734, 516, 20, T.accent2, 'Floating');
    b.text('Floating label', P.web.kpis[1][0], 772, 494, 12.5, T.muted, {weight: 500});
    b.text('Floating value', P.web.kpis[1][1], 772, 512, 20, T.ink, {weight: 700});
    b.rect('Floating chip', 1040, 200, 190, 70, T.surface, {r: 20, shadow: true});
    b.oval('Chip dot', 1058, 221, 28, 28, T.goodSoft);
    b.oval('Chip dot inner', 1066, 229, 12, 12, T.good);
    b.text('Chip label', P.chip, 1098, 214, 15, T.ink, {weight: 700});
    b.text('Chip detail', 'this week', 1098, 236, 12.5, T.muted);
    L.features.forEach(([title, desc], k) => {
      const x = 64 + k * 392;
      b.rect(title + ' card', x, 668, 368, 100, light ? '#F6F6FA' : T.surface, {r: 22});
      b.rect(title + ' icon', x + 24, 692, 52, 52, k % 2 ? T.soft2 : T.soft, {r: 16});
      glyph(b, ['wave', 'grid', 'ring'][k], x + 50, 718, 20, k % 2 ? T.accent2 : T.accent, title);
      b.text(title, title, x + 92, 696, 17, T.ink, {weight: 700});
      b.text(title + ' copy', desc, x + 92, 722, 14, T.muted);
    });
    return b.screen();
  }

  function build(brief) {
    const {pack, theme: T, domain} = pick(brief);
    const screens = [onboarding, home, detail, insights, profile, dashboard, landing].map(f => f(pack, T));
    return {name: pack.name, domain, theme: {mode: T.mode, hue: T.hue, accent: T.accent}, screens};
  }

  const samples = [
    'A budgeting app called "Penny"',
    'Running coach app, dark mode',
    'Travel planner for trips to Japan',
    'Late-night music player in neon lime',
    'Meal kit delivery app called "Ladle"',
    'Team task manager in emerald green',
    'Sleep and meditation app in rose pink'
  ];
  function nativeBoard(note) {
    const board=build(note);
    board.screens=board.screens.filter(screen=>screen.width<700);
    return board;
  }
  return {build,nativeBoard, pick, samples, hues: Object.keys(hues)};
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Kit;
