# Vehra Dental & Family Clinic

A portfolio sample of a **fictional** dental and family clinic in Phagwara, Punjab. The site is a mobile-first Next.js app with a floating assistant that answers from `content/clinic.json` and collects appointment requests.

**Sample site.** Nothing here is a real clinic, and a request is not a confirmed appointment.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Production checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Brand

Public name, colours, and the type scale live in [`theme/brand.ts`](theme/brand.ts) and the tokens at the top of [`app/globals.css`](app/globals.css). Fonts are self-hosted with `next/font`: Fraunces, Instrument Sans, Mukta (Hindi), and Mukta Mahee (Punjabi).

Hindi and Punjabi UI copy is in [`content/messages.ts`](content/messages.ts). It uses everyday wording and still needs a native-speaker check before anyone treats it as finished translation. The English copy follows the design handoff.

Preview flags, same as the static mockup:

- `?chat=open|book|done|typing|error|offline`
- `&theme=dark` or `&theme=light`
- `&shot=1` skips entrance motion for screenshots

## Knowledge file

Edit [`content/clinic.json`](content/clinic.json) for hours, services, doctors, fees, address, and FAQ answers. The assistant injects that file as its only source of clinic facts. The public name still comes from `theme/brand.ts`.

Keep the English page copy in `content/messages.ts` in step with the JSON when you change a fact both surfaces show.

## Assistant

`LLM_PROVIDER=none` (the default) never calls a model. Questions use a keyword FAQ matcher. Appointment requests use a scripted flow: name, Indian mobile number, date and time inside clinic hours, optional reason, then a confirmation that says **Request received, not yet confirmed**.

With a key set, open questions go to the chosen provider and the knowledge file is sent as context. The API key stays on the server. If the call fails, the matcher answers instead. Booking validation stays on the server either way.

| `LLM_PROVIDER` | Endpoint | Default model |
| --- | --- | --- |
| `none` | no network call | |
| `openai` | `https://api.openai.com/v1/chat/completions` | `gpt-4o-mini` |
| `groq` | `https://api.groq.com/openai/v1/chat/completions` | `llama-3.3-70b-versatile` |
| `openrouter` | `https://openrouter.ai/api/v1/chat/completions` | `openai/gpt-4o-mini` |
| `gemini` | Generative Language API `generateContent` | `gemini-2.0-flash` |

Set `LLM_MODEL` to override the default. Gemini uses the `x-goog-api-key` header. The others use `Authorization: Bearer`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `LLM_PROVIDER` | no | `openai`, `groq`, `gemini`, `openrouter`, or `none` (default) |
| `LLM_API_KEY` | only if a provider is set | Server-side key. Never exposed to the browser |
| `LLM_MODEL` | no | Overrides the provider default |
| `BOOKING_WEBHOOK_URL` | no | Opt-in POST of each saved request. Off when unset |
| `BOOKINGS_STORE_PATH` | no | JSON file path. See storage below |
| `BOOKINGS_VIEW_SECRET` | to open the log | Shared secret for `GET /api/bookings` and `/bookings`. Unset, `change-me`, and values under 16 characters are refused |
| `BOOKING_SESSION_SECRET` | no | HMAC key for the booking session. Falls back to a long view secret, then a process-local key |
| `BOOKING_WEBHOOK_SECRET` | no | When set, webhook posts include `x-vehra-signature: sha256=<hmac>` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | no | Digits for the `wa.me` link. Default `910000000000` |

## Where requests are stored

By default a request is appended to a JSON file and sent nowhere.

- On a normal machine the file is `data/bookings.json` (gitignored).
- On Vercel the default is `/tmp/vehra-bookings.json`. That disk is ephemeral and per-instance: the file disappears when the instance shuts down, and another instance cannot see it. **A webhook is required in production** if the desk needs a durable copy.
- If the primary path cannot be created, the server tries `/tmp/vehra-bookings.json`.

Override the path with `BOOKINGS_STORE_PATH`. A durable copy needs `BOOKING_WEBHOOK_URL`.

View what this server has stored:

```bash
curl -H "x-bookings-secret: $BOOKINGS_VIEW_SECRET" http://127.0.0.1:3000/api/bookings
```

Or open `/bookings` and enter the same secret.

## Google Sheet webhook

Leave `BOOKING_WEBHOOK_URL` empty until you want a sheet. Then:

1. Create a spreadsheet with a sheet named `Bookings`.
2. Extensions → Apps Script, paste the script below, and deploy it as a web app.
3. Execute as yourself, and allow anyone with the link to invoke it.
4. Set `BOOKING_WEBHOOK_URL` to the web app URL (`https://script.google.com/macros/s/.../exec`).

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Bookings")
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet("Bookings");
  const data = JSON.parse(e.postData.contents);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["id", "name", "phone", "date", "time", "reason", "createdAt", "source", "language", "status"]);
  }
  sheet.appendRow([
    data.id, data.name, data.phone, data.date, data.time,
    data.reason, data.createdAt, data.source, data.language, data.status
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

The site still keeps the local JSON copy. If the webhook responds with an error, the request remains in the local log and the assistant says the sheet did not accept it. Set `BOOKING_WEBHOOK_SECRET` so the script can check `x-vehra-signature`.

## Deploy on Vercel

This repo is ready for a free Vercel project. No account was created from here.

1. Push the repository to GitHub.
2. In Vercel, import the project. Framework preset: Next.js.
3. Add the environment variables from `.env.example`. Use a real `BOOKINGS_VIEW_SECRET` of at least 16 characters. Leave `BOOKING_WEBHOOK_URL` empty unless a sheet is ready. On Vercel the webhook is required if bookings must survive a restart.
4. Deploy. `npm run build` is the production build.
5. Expect the JSON log on Vercel to be ephemeral unless the webhook is set.

## Limitations

- Appointment requests are not confirmed, and by default they are not delivered to anyone.
- The on-disk log is not shared across serverless instances and does not survive a restart on Vercel.
- Hindi and Punjabi strings are a draft for a native speaker to correct.
- The map is a schematic drawing, not a live map of a real clinic.
- The assistant will not give medical advice. Emergency messages tell the person to call 112, or 108 for an ambulance, and do not offer the placeholder clinic number.
