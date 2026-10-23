// Prompts the team copies into Claude / ChatGPT.
//
// PLACEHOLDERS: the setup, pass, tighten-the-cut and kit director-note prompts
// below are working drafts. Replace each `text` with the exact wording from
// the 5-Pass Reel Edit Kit and set `draft: false`. Keep the setup prompt's
// mention of the B-roll pass, which isn't part of the kit.
//
// Templates can use these variables, filled in per reel:
//   {{business_name}} {{style_rules}} {{reel_title}} {{tags}}

export type PromptKind = 'block' | 'chip';

export interface Prompt {
  id: string;
  label: string;
  /** "block" shows the full text with a Copy prompt button; "chip" is a one-tap copy. */
  kind: PromptKind;
  text: string;
  /** True until the kit's exact text is pasted in. */
  draft: boolean;
}

export interface PromptContext {
  businessName: string;
  styleRules: string;
  reelTitle: string;
  tags: string[];
}

export const prompts: Prompt[] = [
  {
    id: 'setup',
    label: 'Setup prompt',
    kind: 'block',
    draft: true,
    text: `You are my video editor. I've uploaded a raw talking-head clip for a vertical reel for {{business_name}}.
Reel title: {{reel_title}}

We'll edit it in five passes: transcribe, cut-out, captions, motion, sound. Between the cut-out and captions there's also a B-roll pass, where you plan, build and cut in B-roll. Do one pass at a time, show me what you made, and wait for my OK before the next pass. Work in code with the tools in your sandbox. After each pass, save the key files to your outputs folder.

Follow these style rules for every pass:

{{style_rules}}

Start by confirming the clip's length, resolution and frame rate, then wait for "Pass 01".`,
  },
  {
    id: 'pass-01',
    label: 'Pass 01 · Transcribe',
    kind: 'block',
    draft: true,
    text: `Pass 01 — Transcribe.
Transcribe the clip with word-level timestamps and save them as words.json. Show me the transcript as a table (word, start, end) so I can fix misheard words. Flag filler words, long pauses and repeated takes as cut candidates, but don't cut anything yet.`,
  },
  {
    id: 'tighten',
    label: 'Tighten the cut',
    kind: 'block',
    draft: true,
    text: `Tighten the cut: remove the filler words, false starts and pauses longer than 0.3 s you flagged. Keep breaths natural so it doesn't sound robotic. Render a quick preview and update words.json to match the new timing.`,
  },
  {
    id: 'pass-02',
    label: 'Pass 02 · Cut-out',
    kind: 'block',
    draft: true,
    text: `Pass 02 — Cut-out.
Separate me from the background with a video matting model and save the matte. I'll check hair edges: there must be no outline and no holes. Show me three frames (start, middle, end) composited over a solid colour so I can check the edges.`,
  },
  // B-roll (app-authored, not from the kit). Runs after Pass 02 so the cut-out
  // can sit in front of B-roll, and before Pass 03 so captions fit the final cut.
  {
    id: 'broll-plan',
    label: 'B-roll shot list',
    kind: 'block',
    draft: false,
    text: `B-roll — shot list. Don't build anything yet.
This reel is for {{business_name}}. Title: {{reel_title}}. Topics: {{tags}}.

Read words.json and plan B-roll that shows what I'm saying. For each shot give:
1. Trigger word and timecode (the shot starts on that word)
2. Length (2–4 s)
3. What it shows, in one plain sentence
4. Layout: full-screen cutaway, split screen, picture-in-picture, or behind my cut-out
5. Source, one of:
   - BUILD: you make it in code (animated stat or chart, text card, simple illustration, or a mock screen such as an email, form, calculator, map or floor plan)
   - STOCK: I download it free from Pexels or Pixabay. Give me 2–3 exact search terms, portrait orientation
   - OWN: footage I already have (describe what to film or find)

Rules:
- Nothing in the first 1.5 s: the hook stays on my face.
- B-roll is no more than 40% of the reel. Leave at least 1.5 s of my face between shots.
- Prefer BUILD when it explains the point better than stock would.
- No logos, brands or people's faces we don't have rights to.

Show it as a table, then wait. I'll upload the STOCK and OWN clips with their shot numbers in the file names.`,
  },
  {
    id: 'broll-mix',
    label: 'B-roll build and mix',
    kind: 'block',
    draft: false,
    text: `B-roll — build and mix.
Use the approved shot list. I've uploaded the STOCK and OWN clips, numbered by shot.

1. Build every BUILD shot in code at 1080x1920, 30 fps, using our style rules (fonts, brand colours, safe area).
2. Fit each STOCK and OWN clip: crop to 9:16 without stretching, trim to its length, match brightness and colour to my footage. Mute its audio.
3. Cut each shot in on its trigger word with a hard cut or a 4-frame dissolve. My voice keeps playing underneath.
4. For "behind my cut-out" shots, put the B-roll behind me using the Pass 02 matte.
5. For split screen and picture-in-picture, keep my face fully visible and inside the safe area.

Render a preview, list each shot with its in and out timecodes, and save the B-roll files and the new edit to your outputs folder. Then wait for my notes.`,
  },
  {
    id: 'pass-03',
    label: 'Pass 03 · Captions',
    kind: 'block',
    draft: true,
    text: `Pass 03 — Captions.
Using words.json, propose one key word per sentence for the big serif-italic treatment and the support words around it. Max 3 words on screen, never over my face, inside the safe area. List the key words for my approval before you render.`,
  },
  {
    id: 'pass-04',
    label: 'Pass 04 · Motion',
    kind: 'block',
    draft: true,
    text: `Pass 04 — Motion.
Write a scene plan: for each scene give the trigger word, timecode, what appears, where it sits (in front of or behind me) and how it moves. One idea per scene, fired on its word. Wait for me to approve the plan before you build it.`,
  },
  {
    id: 'pass-05',
    label: 'Pass 05 · Sound',
    kind: 'block',
    draft: true,
    text: `Pass 05 — Sound.
Add sound design that follows the style rules: hit on the hook, taps on clicks, whooshes on scene changes, a chime to close. Keep my voice on top. Master to -14 LUFS with peaks under -1 dB and render the full reel at 1080x1920.`,
  },
  // Director notes (one-tap chips on the "Direct" step).
  { id: 'dn-outline', label: 'Outline looks fake', kind: 'chip', draft: true, text: 'The cut-out outline looks fake. Soften the matte edge, remove any halo or white rim, and re-render.' },
  { id: 'dn-face', label: 'Graphic covers face', kind: 'chip', draft: true, text: 'A graphic is covering my face. Move it so it never overlaps my face, keeping it inside the safe area.' },
  { id: 'dn-busy', label: 'Too much on screen', kind: 'chip', draft: true, text: 'There is too much on screen. Cut back to one idea per scene and no more than 3 words at a time.' },
  { id: 'dn-late', label: 'Graphic lands late', kind: 'chip', draft: true, text: 'The graphic lands late. Make it fire exactly on the word "[word]".' },
  { id: 'dn-captions-fast', label: 'Captions too fast', kind: 'chip', draft: true, text: 'The captions are too fast to read. Hold each caption longer and group fewer words per caption.' },
  { id: 'dn-hook', label: 'Hook harder', kind: 'chip', draft: true, text: 'Make the hook hit harder: a bigger key word, a sharper sound hit, and a faster first scene in the first 2 seconds.' },
  { id: 'dn-brand', label: 'Use brand colors', kind: 'chip', draft: true, text: 'Use our brand colors for all graphics and key words: [hex].' },
  { id: 'dn-range', label: 'Only re-render a range', kind: 'chip', draft: true, text: 'Only re-render from [start] to [end]. Keep everything else exactly as it is.' },
  { id: 'dn-broll-match', label: 'B-roll doesn’t match', kind: 'chip', draft: false, text: 'The B-roll at "[word]" doesn’t match what I’m saying. Replace it with a shot that shows [what it should show].' },
  { id: 'dn-broll-much', label: 'Too much B-roll', kind: 'chip', draft: false, text: 'There’s too much B-roll. Cut the weakest shots so I’m on screen more, and keep B-roll under 30% of the reel.' },
  { id: 'dn-broll-hook', label: 'Keep B-roll off the hook', kind: 'chip', draft: false, text: 'Keep all B-roll out of the hook. Stay on my face for the first 2 seconds.' },
  { id: 'dn-broll-swap', label: 'Swap a B-roll shot', kind: 'chip', draft: false, text: 'Swap the B-roll shot at [time] for [new shot]. Keep its timing and everything else the same.' },
  // App-authored prompts (not from the kit).
  {
    id: 'save-outputs',
    label: 'Save files to outputs',
    kind: 'block',
    draft: false,
    text: `Save these to your outputs folder so I can download them: the final MP4 (1080x1920), a cover frame as a PNG, words.json, the matte, the B-roll shots you built, and any project files you'd need to re-render.`,
  },
  {
    id: 'thumbnail',
    label: 'Thumbnail brief',
    kind: 'block',
    draft: false,
    text: `Plan this reel's cover thumbnail. An AI image model will make it from your prompt plus one photo of me.

1. Reference photo: pick the clearest frame of me from the original footage. It must be sharp, with eyes open, looking at the camera, and an expression that matches the hook. Save it without captions or graphics, at full resolution.

2. Image prompt: write a prompt for the image model. It must:
- Say to keep the person from the reference photo exactly: same face, hair, skin tone, glasses and clothing. Don't beautify them or change their age.
- Ask for a vertical 9:16 cover, photographic, bright and crisp, with one clear focal point.
- Put one headline of 2–4 words on it, in quotes and spelled exactly, in a very large bold sans-serif with strong contrast. Make it the reel's main promise or hook. A shorter phrase than the title is fine if it hits harder.
- Use this business's brand colours from the style rules for the headline or accents. If none are given, pick a bold palette that suits {{business_name}}.
- Keep my face and the headline inside the centre 3:4 area (Instagram crops covers to 3:4 on the profile grid), and out of the bottom fifth (where Instagram's buttons sit).
- Use a simple background that relates to the topic ({{reel_title}}; {{tags}}), softly blurred so I stand out.
- Have no other text, logos, brand names, emoji, watermarks or extra people.
Keep the prompt under 900 characters.`,
  },
  {
    id: 'caption',
    label: 'Caption and hashtags',
    kind: 'block',
    draft: false,
    text: `Write an Instagram caption for a reel from {{business_name}}.
Reel title: {{reel_title}}
Topics: {{tags}}

Give me 3 options. Each: a strong first line that works before "more", 2-4 short lines of value, one clear call to action, then 8-12 relevant hashtags (mix of broad and niche, no banned or spammy tags). Plain language, no emoji walls.`,
  },
];

export function getPrompt(id: string): Prompt | undefined {
  return prompts.find((p) => p.id === id);
}

export function renderPrompt(prompt: Prompt, ctx: PromptContext): string {
  return prompt.text
    .replaceAll('{{business_name}}', ctx.businessName)
    .replaceAll('{{style_rules}}', ctx.styleRules.trim())
    .replaceAll('{{reel_title}}', ctx.reelTitle)
    .replaceAll('{{tags}}', ctx.tags.length ? ctx.tags.join(', ') : '(none)');
}
