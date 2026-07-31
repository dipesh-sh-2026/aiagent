## Nexus AI — Centralized Agentic AI Platform

A dark, futuristic web app combining three AI capabilities in one shell: **Research AI**, **Image Generation**, and **Video Creation**.

### Visual Direction
- **Palette**: deep space black `#0a0a0f` background, indigo `#6366f1` and violet `#a855f7` accent gradients, soft white `#f1f5f9` text, glassy panels with subtle border glow
- **Typography**: `Space Grotesk` (display/headings) + `Inter` (body), loaded via `@fontsource`
- **Feel**: animated aurora gradient backdrop, glassmorphic cards with `border-white/10`, subtle grain, glowing focus rings, smooth Framer-like motion via CSS transitions
- All colors as semantic `oklch` tokens in `src/styles.css` — no hardcoded hex in components

### App Structure (routes)
- `/` — Landing hero with three capability cards + CTA into the workspace
- `/research` — Research AI chat (AI Elements: Conversation, Message, PromptInput, Tool, Sources)
- `/image` — Image generation studio (prompt, streaming progressive previews, gallery)
- `/video` — Video creation studio (prompt + aspect ratio + duration → generated MP4 player)
- Persistent left sidebar nav across `/research`, `/image`, `/video`

### Capabilities

**1. Research AI** (`/research`)
- Streaming chat via AI SDK + Lovable AI Gateway (`google/gemini-3-flash-preview`)
- Tool: `web_search` powered by Firecrawl search (user will connect the Firecrawl connector when prompted)
- Renders sources/citations inline; tool calls shown in collapsed accordion
- Server route: `src/routes/api/research.ts` (streamText + tools, `stepCountIs(50)`)

**2. Image Generation** (`/image`)
- Server route `src/routes/api/generate-image.ts` proxies to `/v1/images/generations` with `stream: true`, `partial_images: 1`
- Client uses `eventsource-parser` + `flushSync` to render progressive previews with blur until final frame
- Default `openai/gpt-image-2`, `quality: "low"`; in-session gallery of generated images

**3. Video Creation** (`/video`)
- Server fn `generateVideo` (createServerFn) calls Lovable's video generation (non-streaming, returns asset URL/base64)
- Inputs: prompt, aspect ratio (16:9 / 9:16 / 1:1), duration (5s / 10s)
- Note: server-side video generation in user apps uses the Lovable AI gateway image/video endpoints; if a runtime video endpoint isn't available, surface a clear "coming soon" stub with the UI fully built — preferred behavior is to attempt the call and surface gateway errors gracefully

### Technical Details
- **Stack**: TanStack Start (existing), Tailwind v4, shadcn, AI Elements installed via `bunx ai-elements@latest add conversation message prompt-input shimmer tool`
- **AI Gateway helper**: `src/lib/ai-gateway.server.ts` with `createLovableAiGatewayProvider` per the gateway knowledge file
- **Lovable Cloud**: not required for v1 (no auth, no persistence). Image/video results live in component state; refresh clears them
- **Firecrawl**: linked via `standard_connectors--connect` when wiring Research; `FIRECRAWL_API_KEY` read server-side only
- **SEO**: per-route `head()` with unique titles/descriptions; `public/robots.txt` + `/sitemap.xml` route
- **Brand mark**: generated logo image in `src/assets/` (not a `Sparkles` icon)

### Out of Scope (v1)
- Auth, saved history, billing/usage UI, multi-user collaboration, exporting/sharing links

I'll execute this end-to-end in the next message. The Firecrawl connector prompt will appear during the Research AI step.