import { useState, useRef } from 'preact/hooks';
import { CropOverlay } from './CropOverlay.jsx';

export function PhotoCapture({ onUpload }) {
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
  };

  const handleCropConfirm = async (blob) => {
    setCropFile(null);
    setUploading(true);
    try {
      await onUpload(blob);
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleCropCancel = () => {
    setCropFile(null);
    if (inputRef.current) inputRef.current.value = '';
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
      {cropFile && (
        <CropOverlay
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
