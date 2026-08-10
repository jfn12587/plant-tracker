#!/bin/bash
git add -A && git commit -m "Fix crop overlay, handle thumbnail rate limits

Crop:
- Fix CropOverlay not rendering (circular ref between container and cropBoxSize)
- Use window.innerWidth directly instead of requiring container ref

Thumbnails:
- Add loading=lazy to stagger image requests as user scrolls
- Add onerror handler to hide broken thumbnails on 429s
- Use smaller sz=w200 for dashboard thumbnails" && git push
