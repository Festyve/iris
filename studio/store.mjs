import { get, update } from 'idb-keyval';
import { emptyProject } from './project.mjs';

const key = 'second-cursor:studio:project:v1';
export async function loadProject() {
  return (await get(key)) || emptyProject();
}
export function saveProject(next, serial) {
  return update(key, previous => {
    if ((previous?.serial || 0) !== serial) throw Error('Another studio tab saved changes. Reload this tab to continue.');
    return next;
  });
}
