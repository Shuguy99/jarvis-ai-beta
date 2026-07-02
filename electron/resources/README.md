# JARVIS Electron Resources

## Icon
Place `icon.ico` (256x256, Windows ICO format) here.

### Generate from PNG:
```bash
# Using ImageMagick:
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Or use electron-icon-builder:
npx electron-icon-builder --input=icon.png --output=.
```

The icon should be a cyan (#00e5ff) circle with "J" letter on dark (#0a0a0a) background, matching the JARVIS HUD aesthetic.