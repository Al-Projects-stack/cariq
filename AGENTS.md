# CarIQ — Agent Context

## Build commands
- `cd frontend && npm run dev` — dev server
- `cd frontend && npm run build` — production build
- `cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` — backend

## Changes made

### Loading screen (Home.tsx)
- Added a full-screen loading state with cycling SA-flavored messages while models fetch
- Messages cycle with fade-out/fade-in every 2.8s
- Uses `/favicon.svg` with a CSS pulse animation
- Added states: `modelsLoading`, `msgIndex`, `visible`

### Markdown rendering (AnswerPanel.tsx)
- Installed `react-markdown` + `remark-gfm` to render Claude's markdown responses properly
- Replaced manual `.split("\n").map(line => <p>)` with `<ReactMarkdown>`
- Styled component overrides for h1-h3, p, ul, ol, li, strong, hr, code to match dark theme

### index.html
- Replaced em dashes with hyphens in `<title>` and `<meta description>` for cleaner browser tab display

### Favicon
- Fixed loading screen path from `/favicon.ico` to `/favicon.svg` (file is SVG, not ICO)
