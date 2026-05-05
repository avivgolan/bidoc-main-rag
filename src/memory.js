const memoryStore = new Map();

export function getLocalMemory(sessionId, limit = 8) {
  return (memoryStore.get(sessionId) || []).slice(-limit * 2);
}

export function appendLocalMemory(sessionId, userMessage, assistantMessage) {
  if (!sessionId) return;
  const existing = memoryStore.get(sessionId) || [];
  existing.push({ role: "user", content: userMessage });
  existing.push({ role: "assistant", content: assistantMessage });
  memoryStore.set(sessionId, existing.slice(-24));
}
