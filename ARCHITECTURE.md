# Architecture Decision Record: Un-bundling Basyra Website

## Current Architecture: Self-Unpacking Single-File Bundle

### What the Source Files Are

The website is currently distributed as **self-unpacking single-file bundles**:

- **`Bundled Page.html`** (15MB) and **`Basyra Website (standalone).html`** (37MB) are monolithic HTML files
- **`<script type="__bundler/manifest">`** contains a JSON object with base64-encoded binary assets:
  - 28 woff2 font files
  - 24 images (webp, svg, png, jpg)
  - 2 JavaScript files
- **`<script type="__bundler/template">`** holds the real HTML (~111KB) as a JSON string with UUID asset references
- **Runtime unpacking**: A DOMContentLoaded script decodes each base64 asset → Blob → object URL, then injects them into the template HTML

### Why It's Being Replaced

The current approach has significant drawbacks:

| Issue | Impact |
|-------|--------|
| **37MB single file** | Blocks entire download; difficult to version control |
| **JS-gated render** | Blank page without JavaScript (requires script execution for any content) |
| **Unversionable** | Git chokes on 50MB+ blobs; cannot track partial updates |
| **No source structure** | Impossible to locate assets or make targeted edits |
| **Base64 inflation** | Binary assets inflated ~33% compared to raw files |

### Target Structure

Migrate to a flat static file layout:

```
/
├── index.html
├── assets/
│   ├── images/          (24 image files)
│   └── fonts/           (28 woff2 font files)
├── js/                  (bundled or individual JS)
└── css/                 (external stylesheets if extracted)
```

### Preservation Guarantee

Un-bundling is **behavior-preserving** and **load-faster**:

- ✓ All assets retained (fonts, images, chat widget JS framework)
- ✓ DOM structure identical
- ✓ No JS required for base content rendering
- ✓ **Faster load**: parallel downloads + individual caching
- ✓ **Better compression**: gzip/brotli work on distinct files vs. embedded base64
- ✓ **Versionable**: each asset is a separate git object

### Implementation Notes

1. Extract manifest + template from HTML
2. Base64-decode each manifest entry → disk file
3. Replace UUID references in template with relative paths
4. Strip `integrity` and `crossorigin` attributes (unnecessary for local files)
5. Test in browser; compare bundle size and load time
