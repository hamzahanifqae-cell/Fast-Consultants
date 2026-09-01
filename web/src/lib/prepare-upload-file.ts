/** Max bytes after compression, stay under default PHP upload_max_filesize (2M). */
const TARGET_MAX_BYTES = 1_800_000;

/**
 * Shrink large images so PHP accepts them. Non-images are returned unchanged.
 */
export async function prepareUploadFile(file: File): Promise<File> {
  if (file.size <= TARGET_MAX_BYTES) {
    return file;
  }

  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new Error(
      `This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Use a file under 2 MB, or a JPG/PNG photo (photos are auto-compressed).`,
    );
  }

  const bitmap = await createImageBitmap(file);
  try {
    let width = bitmap.width;
    let height = bitmap.height;
    const maxEdge = 2000;
    if (width > maxEdge || height > maxEdge) {
      const scale = maxEdge / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    let quality = 0.82;
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not prepare image for upload.');
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', quality);
      });

      if (blob && blob.size <= TARGET_MAX_BYTES) {
        break;
      }

      quality = Math.max(0.45, quality - 0.1);
      if (!blob || blob.size > TARGET_MAX_BYTES) {
        width = Math.round(width * 0.85);
        height = Math.round(height * 0.85);
      }
    }

    if (!blob) {
      throw new Error('Could not compress this image. Try a smaller file.');
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'document';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
