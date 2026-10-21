// Google Drive v3. Folders are only ever created or moved, never copied or deleted.

import { googleFetch, qs } from './http';

const API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface DriveFile {
  id: string;
  name: string;
  parents?: string[];
}

export async function createFolder(name: string, parentId?: string): Promise<DriveFile> {
  return googleFetch<DriveFile>(`${API}${qs({ supportsAllDrives: true, fields: 'id,name,parents' })}`, {
    method: 'POST',
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : undefined }),
  });
}

export async function getFile(id: string): Promise<DriveFile> {
  return googleFetch<DriveFile>(`${API}/${encodeURIComponent(id)}${qs({ supportsAllDrives: true, fields: 'id,name,parents' })}`);
}

/** Move a file or folder (with everything inside it) to a new parent folder. */
export async function moveTo(id: string, newParentId: string): Promise<DriveFile> {
  const { parents = [] } = await getFile(id);
  const remove = parents.filter((p) => p !== newParentId);
  if (remove.length === 0 && parents.includes(newParentId)) return { id, name: '', parents };
  return googleFetch<DriveFile>(
    `${API}/${encodeURIComponent(id)}${qs({
      supportsAllDrives: true,
      addParents: newParentId,
      removeParents: remove.join(',') || undefined,
      fields: 'id,name,parents',
    })}`,
    { method: 'PATCH', body: '{}' },
  );
}

export function folderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
}

export function sheetUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`;
}
