import { useState, useRef, useEffect, useCallback } from 'preact/hooks';

export function CropOverlay({ file, onConfirm, onCancel }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageSize, setImageSize] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [cropBoxSize, setCropBoxSize] = useState(0);

  const containerRef = useRef(null);
  const dragState = useRef(null);
  const pinchState = useRef(null);

  // Load image and compute initial scale/offset
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Compute crop box size and initial transform once we know viewport + image
  useEffect(() => {
    if (!imageSize) return;

    const vw = window.innerWidth;
    const boxSize = Math.floor(vw * 0.85);
    setCropBoxSize(boxSize);

    // Initial scale: fit so smaller dimension fills the crop box
    const { width, height } = imageSize;
    const fitScale = boxSize / Math.min(width, height);
    setScale(fitScale);
    // Center the image on the crop box
    setOffset({
      x: (boxSize - width * fitScale) / 2,
      y: (boxSize - height * fitScale) / 2,
    });
  }, [imageSize]);

  // Clamp offset so image always covers the crop box
  const clampOffset = useCallback(
    (ox, oy, s) => {
      if (!imageSize) return { x: ox, y: oy };
      const { width, height } = imageSize;
      const scaledW = width * s;
      const scaledH = height * s;

      // image left edge must be <= 0 (relative to crop box)
      // image right edge must be >= cropBoxSize
      const minX = cropBoxSize - scaledW;
      const maxX = 0;
      const minY = cropBoxSize - scaledH;
      const maxY = 0;

      return {
        x: Math.min(maxX, Math.max(minX, ox)),
        y: Math.min(maxY, Math.max(minY, oy)),
      };
    },
    [imageSize, cropBoxSize]
  );

  // Minimum scale: the crop box is fully covered
  const getMinScale = useCallback(() => {
    if (!imageSize) return 1;
    return cropBoxSize / Math.min(imageSize.width, imageSize.height);
  }, [imageSize, cropBoxSize]);

  // --- Touch handlers ---
  const handleTouchStart = (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      dragState.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
      pinchState.current = null;
    } else if (e.touches.length === 2) {
      dragState.current = null;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchState.current = {
        startDist: Math.hypot(dx, dy),
        startScale: scale,
        startOffset: { ...offset },
        midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragState.current) {
      const dx = e.touches[0].clientX - dragState.current.startX;
      const dy = e.touches[0].clientY - dragState.current.startY;
      const newOx = dragState.current.offsetX + dx;
      const newOy = dragState.current.offsetY + dy;
      const clamped = clampOffset(newOx, newOy, scale);
      setOffset(clamped);
    } else if (e.touches.length === 2 && pinchState.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchState.current.startDist;
      const minScale = getMinScale();
      const maxScale = minScale * 5;
      const newScale = Math.min(maxScale, Math.max(minScale, pinchState.current.startScale * ratio));

      // Adjust offset to keep the pinch midpoint stable
      const scaleRatio = newScale / pinchState.current.startScale;
      const newOx =
        pinchState.current.startOffset.x * scaleRatio +
        (1 - scaleRatio) * (cropBoxSize / 2);
      const newOy =
        pinchState.current.startOffset.y * scaleRatio +
        (1 - scaleRatio) * (cropBoxSize / 2);

      const clamped = clampOffset(newOx, newOy, newScale);
      setScale(newScale);
      setOffset(clamped);
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    if (e.touches.length === 0) {
      dragState.current = null;
      pinchState.current = null;
    } else if (e.touches.length === 1) {
      // Went from pinch to single finger - restart drag
      pinchState.current = null;
      dragState.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
    }
  };

  // --- Mouse handlers (desktop testing) ---
  const handleMouseDown = (e) => {
    e.preventDefault();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };

    const handleMouseMove = (ev) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      const newOx = dragState.current.offsetX + dx;
      const newOy = dragState.current.offsetY + dy;
      const clamped = clampOffset(newOx, newOy, scale);
      setOffset(clamped);
    };

    const handleMouseUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Mouse wheel zoom for desktop
  const handleWheel = (e) => {
    e.preventDefault();
    const minScale = getMinScale();
    const maxScale = minScale * 5;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(maxScale, Math.max(minScale, scale * delta));

    // Zoom toward center of crop box
    const scaleRatio = newScale / scale;
    const newOx = offset.x * scaleRatio + (1 - scaleRatio) * (cropBoxSize / 2);
    const newOy = offset.y * scaleRatio + (1 - scaleRatio) * (cropBoxSize / 2);
    const clamped = clampOffset(newOx, newOy, newScale);

    setScale(newScale);
    setOffset(clamped);
  };

  // --- Crop execution ---
  const handleConfirm = () => {
    if (!imageSize) return;

    // The crop box represents a cropBoxSize x cropBoxSize viewport.
    // The image is drawn at (offset.x, offset.y) with given scale.
    // We need the portion of the original image that maps to [0, cropBoxSize] in both axes.
    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    const sSize = cropBoxSize / scale;

    const outputSize = Math.min(Math.round(sSize), 1200);

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, outputSize, outputSize);
      canvas.toBlob(
        (blob) => onConfirm(blob),
        'image/jpeg',
        0.85
      );
    };
    img.src = imageUrl;
  };

  if (!imageUrl || !imageSize) return null;
  if (!cropBoxSize) return <div class="crop-overlay" ref={containerRef} />;

  // Position the crop box vertically: slightly above center
  const containerWidth =
    containerRef.current ? containerRef.current.clientWidth : window.innerWidth;
  const containerHeight =
    containerRef.current ? containerRef.current.clientHeight : window.innerHeight;
  const cropBoxTop = Math.max(16, (containerHeight - cropBoxSize) / 2 - 40);
  const cropBoxLeft = (containerWidth - cropBoxSize) / 2;

  return (
    <div class="crop-overlay" ref={containerRef}>
      {/* SVG mask for dimming outside the crop window */}
      <svg class="crop-mask" width="100%" height="100%">
        <defs>
          <mask id="crop-hole">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={cropBoxLeft}
              y={cropBoxTop}
              width={cropBoxSize}
              height={cropBoxSize}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#crop-hole)"
        />
      </svg>

      {/* Crop window area for touch/mouse interaction */}
      <div
        class="crop-window"
        style={{
          width: `${cropBoxSize}px`,
          height: `${cropBoxSize}px`,
          top: `${cropBoxTop}px`,
          left: `${cropBoxLeft}px`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        <img
          class="crop-image"
          src={imageUrl}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: `${imageSize.width}px`,
            height: `${imageSize.height}px`,
          }}
          draggable={false}
        />
      </div>

      {/* Crop window border */}
      <div
        class="crop-window-border"
        style={{
          width: `${cropBoxSize}px`,
          height: `${cropBoxSize}px`,
          top: `${cropBoxTop}px`,
          left: `${cropBoxLeft}px`,
        }}
      />

      {/* Buttons */}
      <div class="crop-buttons">
        <button class="btn crop-btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button class="btn btn-primary crop-btn-confirm" onClick={handleConfirm}>
          Confirm
        </button>
      </div>
    </div>
  );
}
