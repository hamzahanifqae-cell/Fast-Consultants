import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { API_URL } from '@/lib/api';

export async function downloadAndOpenReceiptFile(
  path: string,
  fileName: string,
  token: string,
): Promise<void> {
  if (!FileSystem.cacheDirectory) {
    throw new Error('File cache is not available on this device.');
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const target = `${FileSystem.cacheDirectory}${Date.now()}-${safeName}`;

  const result = await FileSystem.downloadAsync(`${API_URL}${path}`, target, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(result.uri, {
    dialogTitle: fileName,
  });
}
