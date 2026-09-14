const FILLER_PATTERNS = [
  ['um', /\bum+\b/gi],
  ['uh', /\buh+\b/gi],
  ['you know', /\byou know\b/gi],
  ['basically', /\bbasically\b/gi],
  ['actually', /\bactually\b/gi],
  ['obviously', /\bobviously\b/gi],
  ['kind of', /\bkind of\b/gi],
  ['sort of', /\bsort of\b/gi],
  ['like', /\blike\b/gi],
];

const STOP = new Set(['the','a','an','and','or','but','to','of','in','on','for','with','that','this','it','is','was','were','be','been','are','as','at','by','from','we','i','you','they','our','my','their','then','so']);

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function words(value) {
  return clean(value).match(/[A-Za-z0-9+#.-]+/g) || [];
}

function sentences(value) {
  return String(value ?? '').split(/(?<=[.!?])\s+|\n+/).map(clean).filter(Boolean);
}

function repeatedPhrases(value) {
  const tokens = words(value).map((word) => word.toLowerCase()).filter((word) => !STOP.has(word));
  const counts = new Map();
  for (let size = 3; size <= 5; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const phrase = tokens.slice(index, index + size).join(' ');
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 5)
    .map(([phrase, count]) => ({ phrase, count }));
}

function longPauseCount(segments) {
  if (!Array.isArray(segments) || segments.length < 2) return 0;
  let count = 0;
  for (let index = 1; index < segments.length; index += 1) {
    const previous = Number(segments[index - 1]?.at_ms);
    const current = Number(segments[index]?.at_ms);
    if (Number.isFinite(previous) && Number.isFinite(current) && current - previous >= 2800) count += 1;
  }
  return count;
}

function paceScore(wpm, durationKnown) {
  if (!durationKnown) return 72;
  if (wpm >= 105 && wpm <= 165) return 100;
  if (wpm >= 90 && wpm <= 185) return 86;
  if (wpm >= 75 && wpm <= 205) return 68;
  return 48;
}

function lengthScore(wordCount) {
  if (wordCount >= 90 && wordCount <= 240) return 100;
  if (wordCount >= 60 && wordCount <= 300) return 84;
  if (wordCount >= 35 && wordCount <= 360) return 66;
  return 46;
}

export function analyseInterviewDelivery(raw = {}) {
  const text = clean(raw.text);
  const durationSec = Math.max(0, Number(raw.duration_sec) || 0);
  const durationKnown = durationSec >= 8;
  const wordList = words(text);
  const wordCount = wordList.length;
  const wpm = durationKnown ? Math.round((wordCount / durationSec) * 60) : 0;
  const sentenceList = sentences(text);
  const avgSentenceWords = sentenceList.length ? Math.round((wordCount / sentenceList.length) * 10) / 10 : wordCount;

  const fillerBreakdown = FILLER_PATTERNS.map(([label, pattern]) => {
    const matches = text.match(pattern) || [];
    return { label, count: matches.length };
  }).filter((item) => item.count > 0);
  const fillerCount = fillerBreakdown.reduce((sum, item) => sum + item.count, 0);
  const fillerRate = wordCount ? Math.round((fillerCount / wordCount) * 1000) / 10 : 0;

  const iCount = (text.toLowerCase().match(/\bi\b/g) || []).length;
  const weCount = (text.toLowerCase().match(/\bwe\b/g) || []).length;
  const ownershipRatio = iCount + weCount ? Math.round((iCount / (iCount + weCount)) * 100) : 0;
  const repetitions = repeatedPhrases(text);
  const pauses = longPauseCount(raw.segments);

  const pace = paceScore(wpm, durationKnown);
  const fillers = clamp(100 - fillerRate * 5.5);
  const conciseness = clamp(lengthScore(wordCount) - Math.max(0, avgSentenceWords - 26) * 1.4 - repetitions.length * 4);
  const ownership = clamp(ownershipRatio ? 45 + ownershipRatio * 0.55 : 62);
  const fluency = clamp(100 - pauses * 10 - Math.max(0, fillerCount - 2) * 2.5);
  const score = clamp(pace * 0.25 + fillers * 0.22 + conciseness * 0.23 + ownership * 0.15 + fluency * 0.15);

  const coaching = [];
  if (durationKnown && wpm > 185) coaching.push(`Slow the delivery: ${wpm} WPM is fast for an interview answer.`);
  else if (durationKnown && wpm < 90) coaching.push(`Increase pace slightly: ${wpm} WPM may feel hesitant.`);
  if (fillerCount > 4) coaching.push(`Reduce filler words: ${fillerCount} detected (${fillerRate}% of words).`);
  if (repetitions.length) coaching.push(`Remove repetition, especially “${repetitions[0].phrase}”.`);
  if (avgSentenceWords > 28) coaching.push('Use shorter sentences so key decisions and outcomes are easier to follow.');
  if (iCount + weCount >= 3 && ownershipRatio < 45) coaching.push('Clarify personal ownership: the answer relies more on “we” than “I”.');
  if (pauses >= 3) coaching.push(`Tighten long pauses: ${pauses} pauses of roughly 2.8 seconds or more were detected.`);
  if (!coaching.length) coaching.push('Delivery is controlled; preserve this pace and clarity while strengthening content where needed.');

  return {
    score,
    word_count: wordCount,
    duration_sec: Math.round(durationSec * 10) / 10,
    duration_source: durationKnown ? (raw.source === 'speech' ? 'speech_measured' : 'interaction_measured') : 'unavailable',
    wpm,
    filler_count: fillerCount,
    filler_rate_pct: fillerRate,
    filler_breakdown: fillerBreakdown,
    long_pause_count: pauses,
    avg_sentence_words: avgSentenceWords,
    repetitions,
    ownership: { i_count: iCount, we_count: weCount, i_ratio_pct: ownershipRatio },
    dimensions: {
      pace,
      fillers,
      conciseness,
      ownership,
      fluency,
    },
    coaching,
  };
}

export function combineInterviewReadiness(contentScore, deliveryScore) {
  const content = clamp(Number(contentScore) || 0);
  const delivery = clamp(Number(deliveryScore) || 0);
  return clamp(content * 0.7 + delivery * 0.3);
}

export function buildTargetedRetry(raw = {}) {
  const contentDimensions = Array.isArray(raw.content_dimensions) ? raw.content_dimensions : [];
  const weakestContent = [...contentDimensions]
    .filter((item) => Number.isFinite(Number(item?.score)))
    .sort((a, b) => Number(a.score) - Number(b.score))[0];
  const delivery = raw.delivery || {};
  const deliveryDimensions = delivery.dimensions || {};
  const weakestDelivery = Object.entries(deliveryDimensions)
    .sort((a, b) => Number(a[1]) - Number(b[1]))[0];

  const targets = [];
  if (weakestContent) targets.push(`Content: strengthen ${String(weakestContent.label || weakestContent.key).toLowerCase()}.`);
  if (weakestDelivery) targets.push(`Delivery: improve ${String(weakestDelivery[0]).replace(/_/g, ' ')}.`);
  if (delivery.wpm > 185) targets.push('Pace target: 105–165 WPM.');
  if (delivery.filler_count > 4) targets.push('Filler target: fewer than 4 filler words.');
  if (delivery.ownership?.i_count + delivery.ownership?.we_count >= 3 && delivery.ownership?.i_ratio_pct < 45) targets.push('Ownership target: make your personal decisions explicit.');
  return targets.slice(0, 4);
}

export function buildInterviewSessionReport(turns = []) {
  const valid = (Array.isArray(turns) ? turns : []).filter((turn) => Number.isFinite(Number(turn?.content_score)));
  if (!valid.length) return { turns: 0, content_average: 0, delivery_average: 0, readiness_average: 0, strongest_turn: null, weakest_turn: null };
  const average = (key) => Math.round(valid.reduce((sum, turn) => sum + Number(turn[key] || 0), 0) / valid.length);
  const scored = valid.map((turn, index) => ({ ...turn, index, readiness_score: Number(turn.readiness_score ?? combineInterviewReadiness(turn.content_score, turn.delivery_score)) }));
  const strongest = [...scored].sort((a, b) => b.readiness_score - a.readiness_score)[0];
  const weakest = [...scored].sort((a, b) => a.readiness_score - b.readiness_score)[0];
  return {
    turns: valid.length,
    content_average: average('content_score'),
    delivery_average: average('delivery_score'),
    readiness_average: Math.round(scored.reduce((sum, turn) => sum + turn.readiness_score, 0) / scored.length),
    strongest_turn: { index: strongest.index, question: strongest.question || '', score: strongest.readiness_score },
    weakest_turn: { index: weakest.index, question: weakest.question || '', score: weakest.readiness_score },
  };
}
