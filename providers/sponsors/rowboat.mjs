import { createOperation, mcpCall, parseMcp, publicUrl, SponsorError, text, withMcp } from './common.mjs';

function projectPath(projectId) {
  const id = text(projectId, 'projectId', 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new SponsorError('projectId must use letters, numbers, underscores or hyphens.', { code: 'invalid_input', status: 400 });
  return `second-cursor/${id}/decisions.md`;
}

export function createRowboat({ env, mcpFactory, timeoutMs }) {
  const op = createOperation('rowboat', ['ROWBOAT_MCP_URL', 'ROWBOAT_MCP_TOKEN', 'ROWBOAT_SPACE_ID'], env);
  async function session(signal, callback) {
    const url = publicUrl(env.ROWBOAT_MCP_URL, 'ROWBOAT_MCP_URL');
    if (!url.pathname.endsWith('/mcp')) throw new SponsorError('ROWBOAT_MCP_URL must end in /mcp.', { code: 'invalid_input', status: 400 });
    return withMcp({ factory: mcpFactory, url: url.href, headers: { Authorization: `Bearer ${env.ROWBOAT_MCP_TOKEN}` }, signal, timeoutMs }, async (client, combined) => {
      const call = async (name, args) => parseMcp(await mcpCall(client, name, args, { signal: combined, timeoutMs }), 'Rowboat');
      const listing = await call('list_spaces', {});
      const space = listing.spaces?.find(item => item.id === env.ROWBOAT_SPACE_ID);
      if (!space) throw new SponsorError('Configured Rowboat space is not accessible to this member.', { code: 'authorization', status: 403 });
      return callback(call, space);
    });
  }
  return {
    status: op.status,
    readMemory({ projectId, signal } = {}) {
      const path = projectPath(projectId);
      return op.run('read_asset', () => session(signal, async (call, space) => {
        const asset = space.assets?.find(item => item.path === path);
        if (!asset) return { projectId, path, content: '', exists: false };
        const result = await call('read_asset', { spaceId: space.id, assetId: asset.id });
        return { projectId, path, assetId: asset.id, content: result.content, version: result.version, exists: true };
      }));
    },
    saveDecision({ projectId, title, decision, referenceIds = [], revision = 1, signal } = {}) {
      const path = projectPath(projectId);
      const heading = text(title, 'decision title', 180);
      const body = text(decision, 'decision', 6000);
      if (!Array.isArray(referenceIds) || referenceIds.length > 30 || referenceIds.some(id => typeof id !== 'string' || id.length > 150)) throw new SponsorError('referenceIds must contain at most 30 short IDs.', { code: 'invalid_input', status: 400 });
      if (!Number.isSafeInteger(revision) || revision < 1) throw new SponsorError('revision must be a positive integer.', { code: 'invalid_input', status: 400 });
      const entry = `\n## Revision ${revision}: ${heading.replace(/\n/g, ' ')}\n\n${body}\n\nReferences: ${referenceIds.join(', ') || 'none'}\n`;
      return op.run('save_decision', () => session(signal, async (call, space) => {
        const asset = space.assets?.find(item => item.path === path);
        const reason = 'Preserve the approved Second Cursor design decision and reference provenance.';
        if (!asset) {
          const created = await call('create_asset', { spaceId: space.id, path, newContent: `# Second Cursor design decisions\n${entry}`, reason });
          if (!created.asset?.id) throw new SponsorError('Rowboat did not confirm creation of the decision file.');
          return { projectId, path, assetId: created.asset.id, version: created.asset.version, saved: true };
        }
        const current = await call('read_asset', { spaceId: space.id, assetId: asset.id });
        if (typeof current.content !== 'string' || !Number.isSafeInteger(current.version)) throw new SponsorError('Rowboat returned an invalid current file version.');
        if (current.content.length + entry.length > 100_000) throw new SponsorError('Decision memory reached the configured size limit.', { code: 'memory_limit', status: 413 });
        const result = await call('propose_change', { spaceId: space.id, assetId: asset.id, baseVersion: current.version, newContent: current.content + entry, reason });
        if (result.outcome === 'conflict') throw new SponsorError('Rowboat decision file changed concurrently. Reload before saving again.', { code: 'conflict', status: 409 });
        if (!['applied', 'merged'].includes(result.outcome)) throw new SponsorError('Rowboat did not confirm the decision was saved.');
        return { projectId, path, assetId: asset.id, version: result.version, saved: true, outcome: result.outcome };
      }));
    }
  };
}
