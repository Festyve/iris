import { useEffect, useState } from 'react';
import { api } from 'wasp/client/api';
import './Main.css';
type ArchiveProject = { id: string; title: string; revision: number; updatedAt: string };
export function MainPage() {
  const [projects, setProjects] = useState<ArchiveProject[]>([]);
  const [message, setMessage] = useState('Loading the local archive…');
  useEffect(() => {
    api.get('/studio-api/projects').json<{ projects: ArchiveProject[] }>()
      .then(result => { setProjects(result.projects); setMessage(result.projects.length ? '' : 'No projects saved yet. Save a design record from Second Cursor.'); })
      .catch(() => setMessage('The archive is unavailable. Check its database and server.'));
  }, []);
  return <main className="archive"><span className="eyebrow">Second Cursor / Wasp archive</span>
    <h1>Decisions worth keeping.</h1><p>Saved project records, reference decisions and version manifests from your design studio.</p>
    <a href="http://127.0.0.1:5173/studio/">Return to the design studio ↗</a>
    {message && <p role="status">{message}</p>}
    <ul>{projects.map(project => <li key={project.id}><strong>{project.title}</strong><span>Revision {project.revision} · {new Date(project.updatedAt).toLocaleString()}</span><code>{project.id}</code></li>)}</ul>
  </main>;
}
