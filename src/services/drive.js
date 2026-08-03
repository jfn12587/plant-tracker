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
    const errText = await res.text();
    console.error('Drive upload error:', res.status, errText);
    throw new Error(`Drive upload failed: ${res.status} - ${errText}`);
  }

  const json = await res.json();
  const fileId = json.id;

  // Make the file publicly viewable so thumbnail URLs work
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }
  );

  return fileId;
}

export function getPhotoUrl(fileId) {
  if (!fileId) return null;
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
}
