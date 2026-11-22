import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('./', import.meta.url));
const script = fileURLToPath(new URL('./review.py', import.meta.url));
const defaultPython = fileURLToPath(new URL('./.venv/bin/python', import.meta.url));
const PERSONAS = ['first-time founder', 'keyboard-first user', 'busy product designer'];

export class ExpectedParrotError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ExpectedParrotError';
    this.status = status;
    this.code = code;
  }
}

const invalid = message => new ExpectedParrotError(400, 'invalid_review', message);

function cleanRequest({ htmlSummary = '', plan = {}, brief, references = [] } = {}) {
  if (typeof brief !== 'string' || !brief.trim() || brief.length > 6000) throw invalid('Provide a design brief of up to 6,000 characters.');
  if (typeof htmlSummary !== 'string' || htmlSummary.length > 120000) throw invalid('Provide a bounded design summary or generated document.');
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw invalid('Provide a design plan object.');
  let planText;
  try { planText = JSON.stringify(plan); } catch { throw invalid('The design plan must be serializable.'); }
  if (typeof planText !== 'string' || planText.length > 16000) throw invalid('The design plan is too large for a small critique.');
  if (!Array.isArray(references) || references.length > 12) throw invalid('Choose at most twelve references.');
  const refs = references.slice(0, 6).map(ref => {
    if (!ref || typeof ref !== 'object') throw invalid('Each reference must be an object.');
    return {
      id: String(ref.id || '').slice(0, 160), title: String(ref.title || '').slice(0, 300),
      observation: String(ref.observation || ref.adaptation || ref.body || '').slice(0, 1600),
      features: Array.isArray(ref.features ?? ref.tags) ? (ref.features ?? ref.tags).slice(0, 12).map(tag => String(tag).slice(0, 80)) : []
    };
  });
  const summary = htmlSummary.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').slice(0, 16000);
  if (!summary.trim() && planText === '{}') throw invalid('Provide design content or a plan to review.');
  return { brief: brief.trim(), htmlSummary: summary, plan: JSON.parse(planText), references: refs };
}

function validateResult(result, model) {
  if (result?.provider !== 'expected-parrot' || result.simulated !== true || !Array.isArray(result.reviews)
    || result.reviews.length !== PERSONAS.length) throw new ExpectedParrotError(502, 'invalid_provider_result', 'Expected Parrot returned an incomplete critique.');
  const seen = new Set();
  const reviews = result.reviews.map(review => {
    if (!PERSONAS.includes(review?.persona) || seen.has(review.persona) || typeof review.critique !== 'string'
      || !review.critique.trim() || review.critique.length > 6000) {
      throw new ExpectedParrotError(502, 'invalid_provider_result', 'Expected Parrot returned an incomplete critique.');
    }
    seen.add(review.persona);
    return { persona: review.persona, critique: review.critique.trim() };
  });
  return {
    provider: 'expected-parrot', simulated: true,
    basis: 'provided design content and plan; not a live human or visual usability test',
    model, reviews, reviewedAt: new Date().toISOString()
  };
}

/** Server-only bridge. This launches one fixed script; input never becomes a shell command. */
export function createExpectedParrotReviewer({
  apiKey = process.env.EXPECTED_PARROT_API_KEY,
  pythonPath = process.env.EXPECTED_PARROT_PYTHON || defaultPython,
  model = process.env.EXPECTED_PARROT_MODEL || 'gpt-4o-mini',
  timeoutMs = 90000, spawnImpl = spawn, runtimeExists = existsSync
} = {}) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (typeof pythonPath !== 'string' || !pythonPath || /[\r\n\0]/.test(pythonPath)) throw TypeError('Invalid Python executable.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(model)) throw TypeError('Invalid Expected Parrot model.');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 180000) throw TypeError('Invalid review timeout.');
  const status = () => ({
    provider: 'expected-parrot', configured: !!key, runtimeReady: runtimeExists(pythonPath), model
  });
  async function execute(payload, signal, decode) {
      if (signal && (typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function')) throw invalid('Provide a valid cancellation signal.');
      const serialized = JSON.stringify(payload);
      if (Buffer.byteLength(serialized) > 16384) throw invalid('The review content is too large. Shorten the summary or selected references.');
      if (signal?.aborted) throw new ExpectedParrotError(499, 'cancelled', 'The simulated review was cancelled.');
      if (!key || /[\r\n\0]/.test(key)) throw new ExpectedParrotError(503, 'not_configured', 'Add EXPECTED_PARROT_API_KEY to the server environment to enable simulated review.');
      if (!status().runtimeReady) throw new ExpectedParrotError(503, 'runtime_missing', 'Install the Expected Parrot Python environment using providers/expected-parrot/README.md.');
      return await new Promise((resolve, reject) => {
        let child, timeout, settled = false, stdout = '', stderrLength = 0;
        const finish = (error, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          signal?.removeEventListener('abort', cancel);
          if (error) {
            try { child?.kill('SIGTERM'); } catch {}
            reject(error);
          } else resolve(value);
        };
        const cancel = () => finish(new ExpectedParrotError(499, 'cancelled', 'The simulated review was cancelled.'));
        try {
          child = spawnImpl(pythonPath, [script], {
            cwd: directory, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
            env: {
              PATH: process.env.PATH || '', TMPDIR: process.env.TMPDIR || '/tmp',
              LANG: 'en_US.UTF-8', PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1', PYTHON_DOTENV_DISABLED: '1',
              EXPECTED_PARROT_API_KEY: key, EXPECTED_PARROT_MODEL: model
            }
          });
        } catch {
          finish(new ExpectedParrotError(503, 'runtime_unavailable', 'The Expected Parrot runtime could not start.'));
          return;
        }
        timeout = setTimeout(() => finish(new ExpectedParrotError(504, 'review_timeout', 'Expected Parrot review timed out. Try a shorter brief.')), timeoutMs);
        signal?.addEventListener('abort', cancel, { once: true });
        if (signal?.aborted) { cancel(); return; }
        child.stdout.on('data', chunk => {
          stdout += chunk.toString();
          if (stdout.length > 40000) finish(new ExpectedParrotError(502, 'invalid_provider_result', 'Expected Parrot returned an oversized response.'));
        });
        // Consume but never expose library/provider stderr, which can contain diagnostics or credentials.
        child.stderr.on('data', chunk => {
          stderrLength += chunk.length;
          if (stderrLength > 200000) finish(new ExpectedParrotError(502, 'provider_failed', 'Expected Parrot review failed. Check server-side configuration.'));
        });
        child.on('error', () => finish(new ExpectedParrotError(503, 'runtime_unavailable', 'The Expected Parrot runtime could not start.')));
        child.on('close', code => {
          if (settled) return;
          let result;
          try { result = JSON.parse(stdout); } catch { finish(new ExpectedParrotError(502, 'invalid_provider_result', 'Expected Parrot returned an unreadable critique.')); return; }
          if (code !== 0 || result?.error) {
            const errors = {
              dependency_missing: [503, 'Expected Parrot Python dependencies are missing. Run the documented setup.'],
              not_configured: [503, 'Expected Parrot credentials are missing.'],
              authentication_failed: [502, 'Expected Parrot rejected the server credentials. Check the API key.'],
              quota_exceeded: [429, 'Expected Parrot credits or rate limits prevented this review.'],
              provider_failed: [502, 'Expected Parrot review failed. Check the model, credentials and account credits.']
            };
            const id = Object.hasOwn(errors, result?.error) ? result.error : 'provider_failed';
            finish(new ExpectedParrotError(errors[id][0], id, errors[id][1]));
            return;
          }
          try { finish(null, decode(result)); } catch (error) { finish(error); }
        });
        child.stdin.on('error', () => finish(new ExpectedParrotError(502, 'provider_failed', 'Expected Parrot stopped before receiving the design.')));
        child.stdin.end(serialized);
      });
  }
  return {
    status,
    async review(input={}) {
      return execute(cleanRequest(input),input.signal,result=>validateResult(result,model));
    },
    async draftContent({brief, direction, signal}) {
      if (typeof brief !== 'string' || !brief.trim() || brief.length>1500) throw invalid('Provide a brief of up to 1,500 characters.');
      const payload={operation:'brief-content',brief,direction:String(direction || '').slice(0,80)};
      return execute(payload,signal,result=>{
        const c=result?.content;
        if (!c || !Array.isArray(c.sections) || c.sections.length<2 || c.sections.length>4 ||
            !/^#[0-9a-f]{6}$/i.test(c.accent)) throw invalid('Incomplete content direction.');
        for (const field of [c.title,c.headline,c.primaryAction,...c.sections]) {
          if (typeof field !== 'string' || !field.trim() || field.length>140 || /[<>\x00-\x1f]/.test(field)) throw invalid('Invalid content direction.');
        }
        return {title:c.title.trim(),headline:c.headline.trim(),primaryAction:c.primaryAction.trim(),sections:c.sections.map(s=>s.trim()),accent:c.accent};
      });
    }
  };
}
