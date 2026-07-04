# Backup: corrupted `agent_settings.data->tools` before the M1 cleanup

Taken 2026-07-04 from App Supabase (MAIN, `pmdnmzuqbcnzgkuhpfnx`), `agent_settings` row `id='default'`, `updated_at = 2026-07-03 16:19:54.993+00`, immediately before resetting the tools map to empty strings (docs/n8n-agents-migration-spec.md, Task M1).

No real webhook URLs were recoverable — every leaf is the stringified `"[object Object]"` (or `""` for meeting_evidence_search), which is why the reset loses nothing.

```json
{
  "alert": {"url": {"url": {"url": {"url": "[object Object]"}}}},
  "emails": {"url": {"url": {"url": {"url": "[object Object]"}}}},
  "meetings": {"url": {"url": {"url": {"url": "[object Object]"}}}},
  "submittals": {"url": {"url": {"url": {"url": "[object Object]"}}}},
  "safety_report": {"url": {"url": {"url": {"url": "[object Object]"}}}},
  "quality_control": {"url": {"url": {"url": {"url": "[object Object]"}}}},
  "exceptions_report": {"url": {"url": {"url": {"url": "[object Object]"}}}},
  "whatsapp_messages": {"url": {"url": {"url": {"url": "[object Object]"}}}},
  "consultants_reports": {"url": {"url": {"url": {"url": "[object Object]"}}}},
  "financial_transactions": {"url": {"url": {"url": {"url": "[object Object]"}}}},
  "meeting_evidence_search": {"url": {"url": {"url": {"url": {"url": {"url": {"url": ""}}}}}}}
}
```

Root cause (fixed in code the same day): `publicSettings` returns tools as `{configured, url}` objects; saving that shape back through `writeLocalSettings` persisted objects instead of strings, and each read→save round trip nested one more `{url: ...}` layer. `resolveToolUrl` returned the truthy object as-is. Fix: `normalizeToolUrlValue` in `src/config.js` applied on read (`getConfig`, `resolveToolUrl`) and on save (`writeLocalSettings`).
