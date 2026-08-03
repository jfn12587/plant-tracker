import { useState, useRef } from 'preact/hooks';

export function PhotoCapture({ onUpload }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const resizeImage = (file, maxWidth = 1200) => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob),
          'image/jpeg',
          0.85
        );
      };
      img.src = url;
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const resized = await resizeImage(file);
      await onUpload(resized);
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div class="photo-capture">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        class="photo-input"
        disabled={uploading}
      />
      {uploading && (
        <div class="photo-uploading">
          <span class="spinner" />
          Uploading...
        </div>
      )}
    </div>
  );
}
