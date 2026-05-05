const BAD_PATTERNS = [
  /ignore\s+previous/gi,
  /system\s+prompt/gi,
  /base64/gi,
  /reveal.*context/gi,
  /print.*document/gi,
  /disregard.*instructions/gi,
  /encode.*text/gi,
  /run.*command/gi,
  /התעלם/gi,
  /הנחיות\s*קודמות/gi,
  /הוראות\s*קודמות/gi,
  /הצג.*את.*המסמך/gi,
  /חשוף.*מידע/gi,
  /הוראות\s*מערכת/gi,
  /ignore\s*prompt/gi,
  /קוד\s*בסיס/gi
];

export function sanitizeMessage(input) {
  let text = String(input || "");
  for (const pattern of BAD_PATTERNS) text = text.replace(pattern, "[REDACTED]");
  if (text.length > 8000) text = text.slice(0, 8000);
  return text;
}
