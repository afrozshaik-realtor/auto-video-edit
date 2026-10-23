// Google Drive v3. Folders are only ever created or moved, never copied or deleted.

import { getToken, googleFetch, googleFetchRaw, GoogleApiError, qs } from './http';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface DriveFile {
  id: string;
  name: string;
  parents?: string[];
  mimeType?: string;
  size?: string;
  createdTime?: string;
}

/** Everything directly inside a folder (not in the bin). */
export async function listChildren(folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await googleFetch<{ files: DriveFile[]; nextPageToken?: string }>(
      `${API}${qs({
        q: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType,size,createdTime,parents)',
        pageSize: 200,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })}`,
    );
    files.push(...res.files);
    pageToken = res.nextPageToken;
  } while (pageToken);
  return files;
}

/** The subfolder with this name inside a folder, if there is one. */
export async function findChildFolder(parentId: string, name: string): Promise<DriveFile | undefined> {
  return (await listChildren(parentId)).find((f) => f.mimeType === FOLDER_MIME && f.name === name);
}

/** A file's contents. */
export async function downloadFile(id: string): Promise<ArrayBuffer> {
  const res = await googleFetchRaw(`${API}/${encodeURIComponent(id)}${qs({ alt: 'media', supportsAllDrives: true })}`);
  return res.arrayBuffer();
}

/** Upload a file with a resumable session (works for large videos). */
export async function uploadFile(name: string, parentId: string, mimeType: string, data: Blob): Promise<DriveFile> {
  const start = await googleFetchRaw(
    `${UPLOAD_API}${qs({ uploadType: 'resumable', supportsAllDrives: true, fields: 'id,name,parents' })}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mimeType },
      body: JSON.stringify({ name, parents: [parentId], mimeType }),
    },
  );
  const session = start.headers.get('Location');
  if (!session) throw new GoogleApiError('Drive didn’t start the upload.', start.status);
  const res = await fetch(session, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': mimeType },
    body: data,
  });
  if (!res.ok) throw new GoogleApiError(`Drive upload of ${name} failed (${res.status}).`, res.status);
  return (await res.json()) as DriveFile;
}

export function fileUrl(id: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
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
