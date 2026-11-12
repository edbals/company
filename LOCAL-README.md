# Company — direct local development

This is the application source retrieved from the existing Company project at `7214b2ce4b8b2eeb99532cf70d8355367bf25eaa`, with direct local changes. It replaces the earlier partial audit snapshots as the working checkout. No paid Lovable build request was used for these changes. This folder has not been pushed back to Lovable or deployed publicly.

## Run

```sh
cd /Users/edbert/Documents/Makeathon/company
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open http://127.0.0.1:5173 for the landing page. The scripted `/demo` was removed; the landing page now explains the product interactively. `/auth` points to the existing connected workspace when local backend configuration is absent.

## Direct changes

- New landing page: large product-led typography, the approved logo, cream/navy/amber palette, code-built phone and outing previews, an explicit problem and Joe/Maya needs section before the features, three interactive explanation steps, a live sharing example, consent/privacy explanation, six agent roles, FAQs, and a separate demo entry.
- No AI-generated photographic assets are imported by the landing page or demo. Demo chapter artwork is built in JSX.
- Fixed the remaining voice test type error. Narration and demo question reading start off; captions remain available. These changes do not constitute an auditioned replacement for the voice Ed rejected.
- Voice selection is explicit and stays consistent across subscription changes. New IDs require matching fixed audio to be regenerated intentionally; the existing audio manifest is preserved.
- Public pages run without copied backend secrets. Local credentials belong in ignored `.env.local`; `.env.example` lists the names. Existing generated clients and database migrations are preserved.

## Checks

`npx tsc --noEmit`, `npm test`, and `npm run build`.

The initial direct run passed typecheck/build and 34 tests; 7 backend integration tests skipped because no backend credentials were exported. Landing tests cover demo separation, interactive steps, family privacy controls, and absence of photography/autoplay.

The browser access host was unavailable in this session, so no desktop/mobile screenshot review is claimed. HTTP/SSR checks verify the page serves successfully. Real microphone/speaker checks and new ElevenLabs voice auditions remain open. Existing fixed audio URLs use Lovable's asset hosting; they have not been downloaded into this checkout. Real ride/delivery integrations remain unconnected as documented in the source brief.
