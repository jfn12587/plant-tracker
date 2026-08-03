export async function uploadPhoto(accessToken, file, plantName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${plantName}_${timestamp}.jpg`;

  const metadata = {
    name: fileName,
    mimeType: file.type || 'image/jpeg',
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (!res.ok) {
    throw new Error(`Drive upload failed: ${res.status}`);
  }

  const json = await res.json();
  return json.id;
}

export function getPhotoUrl(fileId) {
  if (!fileId) return null;
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
}
