// Chat season builder: turns a natural-language request ("make me a season on
// how the Medici financed popes", "three seasons on Gulf airlines") into
// playable, source-grounded seasons.
//
// 1. Plan: the model reads the conversation and either asks one clarifying
//    question or proposes up to three season specs (subject, angle, period,
//    four turning points).
// 2. Ground: each spec is matched to Wikipedia; the full article (plus up to two
//    related articles) becomes the dossier. Nothing outside the dossier may be
//    cited.
// 3. Write: the model writes the season against the same schema and quality
//    gates as every other BIZSIM season. If a model fails the gates, the next
//    model or key in the fallback chain takes over.
import { completeJson } from './llm.js';
import { writeSeasonParts } from './seasonWriter.js';
import { validateCase } from '../../../shared/validate.js';
import { PILLARS } from '../../../shared/dimensions.js';
import { noEmDash } from '../../../shared/text.js';
import { wikipediaArticle } from '../research/wikiArticle.js';
import { fetchJson } from '../lib/http.js';
import { checkCaseClaims } from '../../../shared/evidenceCheck.js';
import { languageInstruction, cleanLocale, promptLanguage } from '../../../shared/locales.js';

const PILLAR_IDS = Object.keys(PILLARS);

const PLAN_SYSTEM = `You are BIZSIM's season designer. BIZSIM teaches executive judgement through "seasons": each season is 4 chronological episodes of 2 or 3 linked decisions each about one real company, ruler, merchant network, institution or state, grounded in documented history.
You talk with a learner and turn their request into season specifications.
Rules:
- If the request names or clearly implies a subject, choose action "build" straight away. Ask a question (action "ask") only when you genuinely cannot tell what subject they want.
- One request can produce up to 3 seasons (for example "compare the Medici and the Fuggers" gives 2). Never more than 3.
- Each season needs the exact English Wikipedia article title that best covers it, an angle (the business lens), the period, and 4 proposed turning points in chronological order.
- Prefer documented decisions with known outcomes. Set "live": true only if the learner wants the last episode to be a present-day, unresolved decision for a living organisation.
- For religious or scriptural figures, frame the season as the scriptural or traditional narrative and say so in the angle; do not present tradition as verified history.
- Keep "reply" short and friendly: say what you will build, or ask your one question.
- Output one JSON object only.`;

function planSchema(userPrinciples) {
  return `JSON shape:
{
  "action": "ask" | "build",
  "reply": string (1-3 sentences),
  "seasons": [ (only when action is "build"; 1 to 3 items)
    { "subject": string, "wikipedia": string (exact English Wikipedia title), "angle": string, "period": string (e.g. "1397-1494"),
      "episodes": [string, string, string, string] (turning points, chronological), "live": boolean, "difficulty": 1 | 2 | 3,
      "pillar": one of ${PILLAR_IDS.join(', ')}${userPrinciples.length ? ',\n      "userPrinciples": [ids from the learner\'s own principles that fit this season]' : ''} }
  ]
}${userPrinciples.length ? `\nThe learner's own principles (id: name: idea):\n${userPrinciples.map((p) => `${p.id}: ${p.name}: ${p.idea}`).join('\n')}` : ''}`;
}

const SEASON_SYSTEM = `You are BIZSIM's case architect. You write rigorous, neutral executive business seasons for learners.
Rules:
- Use ONLY the facts in the dossier. Clearly separate Verified Fact (must cite a sourceId present in sources, e.g. "S1") from AI Analysis / Hypothetical (must set kind: "analysis" or "hypothetical" and never fabricate a URL or historical citation). Never invent numbers, dates, people or events.
- The season has exactly 4 EPISODES in chronological order, following the requested turning points where the dossier documents them; replace any the dossier does not document with documented ones. Each episode holds 2 or 3 linked decisions and ends with its own outcome and insight.
- In each past episode, exactly one option per decision has "historical": true (what was actually done) and each decision's "outcome" states what happened next, citing source ids.
- Only if the brief says the last episode is live: episode IV is live, with no historical option and no outcome.
- No spoilers in the situation, concept or episode context: do not reveal which option is best or what happened.
- Options are realistic, distinct executive trade-offs, each with clear trade-offs and risks.
- Cite principles ONLY by the ids provided. Never quote books; the ideas are already paraphrased.
- If the subject is scriptural or traditional, say so plainly in the situation context and in "uncertainties".
- Output a single JSON object, no prose.`;

const slugify = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'season';

function eraOf(year) {
  if (!Number.isFinite(year)) return 'MODERN';
  if (year < 500) return 'ANCIENT';
  if (year < 1500) return 'MEDIEVAL';
  if (year < 1760) return 'EARLY_MODERN';
  if (year < 1914) return 'INDUSTRIAL';
  if (year < 1990) return 'MODERN';
  return 'CONTEMPORARY';
}
function firstYear(text) {
  const s = String(text || '');
  const bc = /(\d{1,4})\s*(BC|BCE)\b/i.exec(s);
  if (bc) return -Number(bc[1]);
  const m = /\b(\d{3,4})\b/.exec(s);
  return m ? Number(m[1]) : NaN;
}

async function searchTitles(q, limit = 4) {
  const u = `https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=${limit}&srnamespace=0&format=json&srsearch=${encodeURIComponent(q)}`;
  const d = await fetchJson(u);
  return (d.query?.search || []).map((h) => h.title);
}

/** Find the main article and up to two related ones for a season spec. */
async function ground(spec) {
  let main = null;
  for (const t of [spec.wikipedia, spec.subject].filter(Boolean)) {
    try {
      main = await wikipediaArticle(t, 28000);
      break;
    } catch {
      /* try the next name */
    }
  }
  if (!main) {
    const hits = await searchTitles(`${spec.subject} ${spec.angle || ''}`.trim(), 3).catch(() => []);
    for (const t of hits) {
      try {
        main = await wikipediaArticle(t, 28000);
        break;
      } catch {
        /* next */
      }
    }
  }
  if (!main) throw new Error(`Could not find a Wikipedia article for "${spec.subject}"`);
  const extra = [];
  const related = await searchTitles(`${spec.subject} ${spec.angle || ''} ${(spec.episodes || []).slice(0, 2).join(' ')}`.slice(0, 200), 5).catch(() => []);
  for (const t of related) {
    if (extra.length >= 2 || t === main.title) continue;
    try {
      extra.push(await wikipediaArticle(t, 9000));
    } catch {
      /* skip */
    }
  }
  const sources = [main, ...extra].map((a, i) => ({ id: `S${i + 1}`, title: `Wikipedia: ${a.title}`, publisher: 'Wikipedia', url: a.url, type: 'Reference', date: a.touched || undefined, text: a.text }));
  return { main, sources };
}

async function writeSeason(spec, onProgress, locale = null) {
  onProgress?.(`Reading Wikipedia for ${spec.subject}`);
  const { main, sources } = await ground(spec);
  onProgress?.(`Writing "${spec.subject}" from ${sources.length} source${sources.length === 1 ? '' : 's'}`);
  const dossier = sources.map((s) => `[${s.id}] ${s.title}\n${s.text}`).join('\n\n');
  const brief = `Season brief
Subject: ${spec.subject}
Business angle: ${spec.angle || 'the key strategic decisions'}
Period: ${spec.period || 'as documented'}
Requested turning points: ${(spec.episodes || []).map((e, i) => `${i + 1}. ${e}`).join(' ')}
Last episode live (present-day, unresolved): ${spec.live ? 'yes' : 'no'}
Difficulty: ${spec.difficulty || 2} of 3

DOSSIER (cite by id):
${dossier}`;

  const company = spec.subject;
  const parts = await writeSeasonParts({
    system: SEASON_SYSTEM + languageInstruction(locale) + (locale && locale !== 'en' ? `\nWrite ALL user-facing prose—including title, summary, dilemmas, evidence, outcomes, and baseRate—strictly in ${promptLanguage(locale)} (${locale}). Do not mix English prose into non-English responses.` : ''),
    brief,
    sourceIds: sources.map((x) => x.id),
    liveLast: Boolean(spec.live),
    isLive: (i, total) => Boolean(spec.live) && i === total - 1,
    onProgress: (t) => onProgress?.(`${spec.subject}: ${t}`),
  });
  const raw = parts.frame;
  const { checkpoints, episodes } = parts;
  const year = firstYear(spec.period) || firstYear(checkpoints[0]?.dateLabel);
  const candidate = {
    title: raw.title,
    tagline: raw.tagline,
    situation: raw.situation,
    concept: raw.concept,
    evidence: raw.evidence,
    analysis: raw.analysis,
    scenarios: spec.live ? raw.scenarios : undefined,
    id: `chat-${slugify(company)}-${Date.now().toString(36)}`,
    company,
    yearLabel: spec.period || checkpoints[0]?.dateLabel || '',
    yearSort: Number.isFinite(year) ? year : new Date().getFullYear(),
    era: spec.live ? 'LATEST' : eraOf(year),
    pillar: PILLAR_IDS.includes(spec.pillar) ? spec.pillar : 'STRATEGY',
    domain: PILLAR_IDS.includes(spec.pillar) ? spec.pillar : 'STRATEGY',
    scale: 'ENTERPRISE',
    difficulty: [1, 2, 3].includes(spec.difficulty) ? spec.difficulty : 2,
    minutes: 20,
    classification: spec.live ? 'LIVE' : 'HISTORICAL',
    source: 'chat',
    contentLocale: locale && locale !== 'en' ? locale : undefined,
    generatedAt: new Date().toISOString(),
    wiki: main.title,
    imageQuery: company,
    sources: sources.map(({ id, title, publisher, url, type, date }) => ({ id, title, publisher, url, type, date })),
    checkpoints,
    episodes,
    outcome: {
      summary: raw.analysis?.summary || '',
      secondOrder: [],
      baseRate: spec.live
        ? 'The final episode is a live, unresolved situation and its assessments are AI-generated analysis. Earlier episodes summarise documented history from the cited Wikipedia articles.'
        : 'Built by AI from the cited Wikipedia articles at your request. Check the sources before relying on any detail.',
      lessons: raw.lessons || [],
    },
  };
  const expectedEpisodes = parts.partial ? parts.episodes.length : 4;
  const { ok, errors, warnings, value } = validateCase(candidate, { requireHistorical: true, episodes: expectedEpisodes });
  if (!ok) throw new Error(`season failed checks: ${errors.slice(0, 3).join('; ')}`);
  value.model = parts.model;
  value.aiGenerated = true;
  if (parts.partial) value.partial = parts.partial;
  value.evidenceChecks = checkCaseClaims(value, Object.fromEntries(sources.map((s) => [s.id, s.text || ''])));
  value.evidenceCheckedAt = new Date().toISOString();
  return { case: value, warnings, userPrinciples: (spec.userPrinciples || []).filter((x) => typeof x === 'string') };
}
/**
 * One turn of the chat builder.
 * @param {{ messages: {role:'user'|'assistant', content:string}[], userPrinciples?: {id,name,idea}[] }} input
 * @param {(event:string, data:object)=>void} emit
 */
export async function chatTurn({ messages, userPrinciples = [], locale = null }, emit = () => {}) {
  const lang = cleanLocale(locale);
  const convo = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!convo.length || convo[convo.length - 1].role !== 'user') throw new Error('Say what season you would like.');
  const own = (Array.isArray(userPrinciples) ? userPrinciples : []).slice(0, 60).map((p) => ({ id: String(p.id).slice(0, 60), name: String(p.name || '').slice(0, 100), idea: String(p.idea || '').slice(0, 300) }));

  emit('status', { text: 'Understanding your request' });
  const plan = await completeJson({
    system: PLAN_SYSTEM + (lang && lang !== 'en' ? `\nLANGUAGE: The learner's interface is in ${promptLanguage(lang)}. Write "reply", "angle" and the proposed turning points in that language. Keep "subject" and "wikipedia" as the exact English Wikipedia title.` : ''),
    user: `Conversation so far:\n${convo.map((m) => `${m.role === 'user' ? 'Learner' : 'BIZSIM'}: ${m.content}`).join('\n')}\n\n${planSchema(own)}`,
    maxTokens: 2000,
    validate: (v) => {
      if (v.action !== 'ask' && v.action !== 'build') throw new Error('plan has no action');
      if (v.action === 'build' && !(Array.isArray(v.seasons) && v.seasons.length && v.seasons.every((s) => s && s.subject))) throw new Error('plan has no seasons');
      return v;
    },
  });
  const reply = noEmDash(String(plan.reply || '').trim());
  if (plan.action === 'ask') {
    emit('reply', { text: reply || 'Which company, person or institution should the season be about?' });
    return;
  }
  const specs = plan.seasons.slice(0, 3);
  emit('reply', { text: reply || `Building ${specs.length} season${specs.length === 1 ? '' : 's'}.`, plan: specs.map((s) => ({ subject: s.subject, angle: s.angle, period: s.period, episodes: s.episodes })) });

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const tag = specs.length > 1 ? `Season ${i + 1} of ${specs.length}: ` : '';
    try {
      const result = await writeSeason(spec, (text) => emit('status', { text: `${tag}${text}` }), lang);
      emit('season', result);
    } catch (e) {
      emit('season-error', { subject: spec.subject, message: e.message });
    }
  }
}
