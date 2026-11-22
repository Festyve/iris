import type { StudioHealth, ListStudioProjects, GetStudioProject, SaveStudioProject } from 'wasp/server/api';
import type { MiddlewareConfigFn } from 'wasp/server';
import { timingSafeEqual } from 'node:crypto';
import { projectId, validateSnapshot, expectedRevision, isLocalRequest } from './validation.mjs';
export const studioMiddleware: MiddlewareConfigFn = config => config;
function authorize(req: { socket: { remoteAddress?: string }; headers: Record<string, unknown> }) {
  if (!isLocalRequest(req.socket.remoteAddress, req.headers.host, req.headers.origin)) throw Object.assign(Error('This archive accepts local workspace requests only.'), { status: 403 });
  const token = process.env.WASP_STUDIO_TOKEN;
  if (token) {
    const supplied = String(req.headers.authorization || ''), expected = 'Bearer ' + token;
    if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw Object.assign(Error('Archive authorization required.'), { status: 401 });
  }
}
function errorResponse(res: { status: (status: number) => { json: (body: unknown) => unknown } }, error: unknown) {
  const safe = error as { status?: number; message?: string; code?: string };
  if (safe.code === 'P2002') return res.status(409).json({ error: 'The project changed. Reload its revision before saving.' });
  const status = safe.status && [400, 401, 403, 404, 409, 413].includes(safe.status) ? safe.status : 500;
  return res.status(status).json({ error: status === 500 ? 'The Wasp archive could not complete this request.' : safe.message });
}
export const studioHealth: StudioHealth = async (req, res, context) => {
  try { authorize(req); const count = await context.entities.DesignProject.count(); res.json({ provider: 'wasp', status: 'ready', storage: 'sqlite', projects: count }); } catch (error) { errorResponse(res, error); }
};
export const listStudioProjects: ListStudioProjects = async (req, res, context) => {
  try { authorize(req); const projects = await context.entities.DesignProject.findMany({ take: 100, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, revision: true, createdAt: true, updatedAt: true } }); res.json({ provider: 'wasp', projects }); } catch (error) { errorResponse(res, error); }
};
export const getStudioProject: GetStudioProject = async (req, res, context) => {
  try { authorize(req); const record = await context.entities.DesignProject.findUnique({ where: { id: projectId(req.params.id) } }); if (!record) return res.status(404).json({ error: 'Project not found.' }); res.json({ provider: 'wasp', id: record.id, revision: record.revision, updatedAt: record.updatedAt, project: JSON.parse(record.snapshot) }); } catch (error) { errorResponse(res, error); }
};
export const saveStudioProject: SaveStudioProject = async (req, res, context) => {
  try {
    authorize(req);
    const id = projectId(req.params.id), { snapshot, title } = validateSnapshot(req.body?.project), revision = expectedRevision(req.body?.expectedRevision), model = context.entities.DesignProject;
    if (revision === 0) await model.create({ data: { id, title, snapshot } });
    else if (revision !== undefined) {
      const result = await model.updateMany({ where: { id, revision }, data: { title, snapshot, revision: { increment: 1 } } });
      if (result.count !== 1) return res.status(409).json({ error: 'The project changed. Reload its revision before saving.' });
    } else await model.upsert({ where: { id }, create: { id, title, snapshot }, update: { title, snapshot, revision: { increment: 1 } } });
    const saved = await model.findUniqueOrThrow({ where: { id } });
    res.json({ provider: 'wasp', id, revision: saved.revision, updatedAt: saved.updatedAt, project: JSON.parse(saved.snapshot) });
  } catch (error) { errorResponse(res, error); }
};
