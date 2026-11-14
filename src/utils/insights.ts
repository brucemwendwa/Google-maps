export function buildLocalGuidePrompt(cityState: string): string {
  return `You are a local tour guide for ${cityState}. Give me exactly 3 short, highly engaging, and unusual or surprising fun facts about this place. Keep each fact under 2 sentences. Format the response as a clean HTML unordered list (<ul>) so I can inject it directly.`;
}

export function sanitizeInsightsHtml(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  // Strip optional markdown code fences returned by LLMs
  let cleaned = rawText
    .replace(/```html\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Extract <ul>...</ul> block if surrounded by commentary
  const ulMatch = cleaned.match(/<ul\b[^>]*>[\s\S]*?<\/ul>/i);
  if (ulMatch) {
    cleaned = ulMatch[0];
  }

  // Remove dangerous tags and their contents
  cleaned = cleaned.replace(/<(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\/\1>/gi, '');
  cleaned = cleaned.replace(/<(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '');

  // Remove inline event handlers and javascript: protocols
  cleaned = cleaned.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  cleaned = cleaned.replace(/javascript\s*:/gi, '');

  // Strip all attributes on allowed tags and drop any disallowed tags while preserving inner text
  const allowedTags = new Set(['ul', 'li', 'strong', 'b', 'em', 'i', 'p', 'br']);
  cleaned = cleaned.replace(/<\/?([a-z0-9-]+)(\s[^>]*)?>/gi, (fullMatch, tagName: string) => {
    const lower = tagName.toLowerCase();
    if (!allowedTags.has(lower)) {
      return '';
    }
    if (fullMatch.startsWith('</')) {
      return `</${lower}>`;
    }
    if (lower === 'br') {
      return '<br />';
    }
    return `<${lower}>`;
  });

  cleaned = cleaned.trim();

  // If the model returned plain lines or bullets without <ul>, wrap safely
  if (cleaned && !cleaned.toLowerCase().includes('<ul')) {
    const lines = cleaned
      .split(/\n+/)
      .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 3);
    if (lines.length > 0) {
      return `<ul>${lines.map((line) => `<li>${line}</li>`).join('')}</ul>`;
    }
  }

  return cleaned;
}
