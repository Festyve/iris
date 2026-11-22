import { timingSafeEqual } from 'node:crypto';
import { snapshot } from './repo-evidence.mjs';

export function authorized(header, token) {
  if (!token || token.length < 32 || typeof header !== 'string') return false;
  const expected = Buffer.from('Bearer ' + token), supplied = Buffer.from(header);
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}

const stop = new Set('what which that this with from does can how the our your and for where second cursor repository repo iris festyve'.split(' '));
function words(text) {
  return new Set((text.toLowerCase().match(/[a-z]{3,}/g) || []).filter(word => !stop.has(word)));
}

export function answerQuestion(body) {
  if (typeof body?.question !== 'string' || !body.question.trim() || body.question.length > 1000)
    throw new TypeError('Provide a question between 1 and 1000 characters.');
  const question = body.question.trim();
  const result = {repo:snapshot.repo, commit:snapshot.commit, citations:[]};
  const namedRepos = question.match(/(?:[\w.-]+\/)+[\w.-]+/g) || [];
  const allowed = new Set(['festyve/iris','festyve/elevenlabsycstartuphackathon','github.com/festyve/iris']);
  if ((body.repo && !allowed.has(String(body.repo).toLowerCase())) || namedRepos.some(name => !allowed.has(name.toLowerCase())) ||
      /\b(other repo|outside|stock price|weather|password|secret|push|delete)\b/i.test(question))
    return {...result,status:'out_of_scope',answer:'I can read the approved Second Cursor project snapshot only.'};
  const tokens = words(question);
  const ranks = snapshot.rows.map(row => ({row,score:[...words(row.keywords)].filter(word => tokens.has(word)).length}))
    .sort((a,b) => b.score-a.score);
  const top = ranks[0];
  if (!top.score || top.score === ranks[1].score)
    return {...result,status:'clarification',answer:'Which part of Second Cursor do you mean: starting the studio, importing references, checking previews, running tests, or rebuilding the Figma plugin?'};
  const {path,line,excerpt} = top.row;
  return {...result,status:'answered',answer:excerpt,citations:[{path,line,commit:snapshot.commit}]};
}
