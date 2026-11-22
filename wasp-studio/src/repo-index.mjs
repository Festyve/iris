// Only these public files and sections are eligible for citation.
const sections = [
  ['README.md', /^npm start$/, 'command launch run start studio locally'],
  ['README.md', /archive API runs on port/, 'archive server browser port database'],
  ['README.md', /After editing sources, run/, 'figma plugin rebuild generated javascript'],
  ['README.md', /Drop Markdown notes/, 'reference vault import markdown screenshots folder'],
  ['README.md', /renders it in isolated frames/, 'preview verification screen widths failed cancelled'],
  ['package.json', /^\s*"test":/, 'test command unit tests suite'],
  ['docs/INTEGRATIONS.md', /^\| Model generation /, 'daily model output token tokens limit budget allowance gemini claude critique'],
  ['docs/INTEGRATIONS.md', /^\| ElevenLabs \| 12 /, 'daily voice transcription speech session limits'],
  ['docs/INTEGRATIONS.md', /^\| TraceRoot \| Trace /, 'tracing traceroot telemetry span verification'],
  ['docs/INTEGRATIONS.md', /^\| Fiber AI \|/, 'fiber company research lookup'],
  ['docs/INTEGRATIONS.md', /^\| Expected Parrot \|/, 'expected parrot evaluation simulated personas']
];
export const paths = [...new Set(sections.map(([path])=>path))];
export function indexSources(commit, files) {
  const rows=[];
  for(const [path,pattern,keywords] of sections) {
    const lines=files[path].split(/\r?\n/);
    const i=lines.findIndex(line=>pattern.test(line));
    if(i>=0) rows.push({path,line:i+1,keywords,excerpt:lines[i].trim()});
  }
  if(!rows.some(r=>r.excerpt==='npm start') || !rows.some(r=>r.keywords.includes('token tokens')))
    throw Error('Required sections missing');
  return {repo:'Festyve/iris',commit,rows};
}
