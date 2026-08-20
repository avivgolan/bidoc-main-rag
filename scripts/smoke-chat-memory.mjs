import assert from "node:assert/strict";
import { getConfig, initSettings, loadEnv } from "../src/config.js";
import { applyExplicitMemoryCommand, deleteAllChatMemoryForUser, getChatMemoryStats, loadAgentMemory } from "../src/chatMemory.js";
import { getChatSessionMemory, upsertChatSessionMemory } from "../src/supabase.js";

loadEnv();
await initSettings();
const config = getConfig();
const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const userId = `memory_smoke_user_${suffix}`;
const sessionId = `memory_smoke_session_${suffix}`;
const nextSessionId = `${sessionId}_next`;

try {
  const saved = await upsertChatSessionMemory({
    config,
    sessionId,
    userId,
    summary: { active_topics: ["בדיקת זיכרון"], last_intent: "smoke test" },
    turnCount: 12,
    summaryVersion: 1
  });
  assert.equal(saved.session_id, sessionId);
  assert.equal(saved.turn_count, 12);

  const restored = await getChatSessionMemory({ config, sessionId, userId });
  assert.equal(restored?.summary?.last_intent, "smoke test");
  assert.equal(restored?.turn_count, 12);

  await assert.rejects(
    getChatSessionMemory({ config, sessionId, userId: `${userId}_other` }),
    /different user/
  );

  const stats = await getChatMemoryStats({ config, userId });
  assert.equal(stats.sessions, 1);

  const previousConversation = await loadAgentMemory({
    config: { ...config, openRouterApiKey: "" },
    sessionId: nextSessionId,
    userId,
    query: "אתה זוכר על מה דיברנו בשיחה האחרונה?",
    agent: "lite"
  });
  assert.equal(previousConversation.previousSessionRecalled, true, JSON.stringify({
    mode: previousConversation.mode,
    summarySource: previousConversation.summarySource,
    sessionRow: previousConversation.sessionRow,
    errors: previousConversation.errors
  }));
  assert.equal(previousConversation.summarySource, "previous_session");
  assert.equal(previousConversation.summary?.last_intent, "smoke test");
  assert.equal(previousConversation.sessionRow, null);

  const isolatedUser = await loadAgentMemory({
    config: { ...config, openRouterApiKey: "" },
    sessionId: nextSessionId,
    userId: `${userId}_other`,
    query: "על מה דיברנו בשיחה הקודמת?",
    agent: "lite"
  });
  assert.equal(isolatedUser.previousSessionRecalled, false);
  assert.equal(isolatedUser.summarySource, "none");

  const remembered = await applyExplicitMemoryCommand({
    config,
    userId,
    sessionId,
    message: "זכור שהספק המועדף עליי לבדיקת המערכת הוא אלפא"
  });
  assert.equal(remembered?.ok, true);

  const recalled = await loadAgentMemory({
    config,
    sessionId,
    userId,
    query: "הספק המועדף עליי לבדיקת המערכת הוא אלפא",
    agent: "main"
  });
  assert.ok(recalled.memories.some((item) => item.content.includes("אלפא")));

  const forgotten = await applyExplicitMemoryCommand({
    config,
    userId,
    sessionId,
    message: "שכח שהספק המועדף עליי לבדיקת המערכת הוא אלפא"
  });
  assert.equal(forgotten?.ok, true);
  assert.ok(forgotten.count >= 1);
  console.log("chat memory smoke test passed");
} finally {
  await deleteAllChatMemoryForUser({ config, userId }).catch(() => {});
}
