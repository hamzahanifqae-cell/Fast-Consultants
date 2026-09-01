import axios from 'axios';

import { api } from '@/lib/api';

type FetchedFile = {
  blob: Blob;
  contentType: string;
  objectUrl: string;
};

async function blobErrorMessage(data: Blob, fallback: string): Promise<string> {
  try {
    const text = await data.text();
    const parsed = JSON.parse(text) as { message?: string; errors?: Record<string, string[]> };
    const firstFieldError = parsed.errors ? Object.values(parsed.errors)[0]?.[0] : undefined;
    return firstFieldError ?? parsed.message ?? fallback;
  } catch {
    return fallback;
  }
}

async function fetchAuthenticatedFile(path: string): Promise<FetchedFile> {
  let response;
  try {
    response = await api.get<Blob>(path, {
      responseType: 'blob',
      headers: { Accept: '*/*' },
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      throw new Error(await blobErrorMessage(error.response.data, 'Could not open this file.'));
    }
    throw error;
  }

  const contentType = (response.headers['content-type'] as string | undefined) ?? 'application/octet-stream';
  if (contentType.includes('application/json')) {
    throw new Error(await blobErrorMessage(response.data, 'Could not open this file.'));
  }

  const blob =
    response.data.type && response.data.type !== contentType
      ? new Blob([response.data], { type: contentType })
      : response.data;

  return {
    blob,
    contentType,
    objectUrl: URL.createObjectURL(blob),
  };
}

function showFilePreview({ blob: _blob, contentType, objectUrl, title }: FetchedFile & { title: string }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'file-preview-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', title);

  const panel = document.createElement('div');
  panel.className = 'file-preview-panel';

  const toolbar = document.createElement('div');
  toolbar.className = 'file-preview-toolbar';

  const heading = document.createElement('strong');
  heading.textContent = title;

  const actions = document.createElement('div');
  actions.className = 'file-preview-actions';

  const download = document.createElement('a');
  download.className = 'ghost-btn';
  download.textContent = 'Download';
  download.href = objectUrl;
  download.download = title;
  download.rel = 'noopener noreferrer';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ghost-btn';
  close.textContent = 'Close';

  actions.append(download, close);
  toolbar.append(heading, actions);

  const body = document.createElement('div');
  body.className = 'file-preview-body';

  const isImage = contentType.startsWith('image/');
  const isPdf = contentType === 'application/pdf' || title.toLowerCase().endsWith('.pdf');

  if (isImage) {
    const image = document.createElement('img');
    image.className = 'file-preview-image';
    image.src = objectUrl;
    image.alt = title;
    body.append(image);
  } else if (isPdf) {
    const frame = document.createElement('iframe');
    frame.className = 'file-preview-frame';
    frame.src = objectUrl;
    frame.title = title;
    body.append(frame);
  } else {
    const message = document.createElement('p');
    message.className = 'muted';
    message.textContent = 'Preview is not available for this file type. Use Download to save it.';
    body.append(message);
  }

  panel.append(toolbar, body);
  backdrop.append(panel);

  const previousOverflow = document.body.style.overflow;

  function cleanup() {
    URL.revokeObjectURL(objectUrl);
    backdrop.remove();
    document.body.style.overflow = previousOverflow;
    window.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      cleanup();
    }
  }

  close.addEventListener('click', cleanup);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      cleanup();
    }
  });
  window.addEventListener('keydown', onKeyDown);

  document.body.style.overflow = 'hidden';
  document.body.append(backdrop);
}

/** Fetch an authenticated file and preview it in-page (avoids popup blockers). */
export async function openAuthenticatedFile(path: string, title = 'Document'): Promise<void> {
  const file = await fetchAuthenticatedFile(path);
  showFilePreview({ ...file, title });
}
