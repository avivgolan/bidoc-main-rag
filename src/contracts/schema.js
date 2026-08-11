import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { ContractsAgentError } from "./errors.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CONTRACTS_SCHEMA_PATH = path.join(
  ROOT,
  "docs",
  "Indicator + Contracts",
  "schemas",
  "contracts-agent-output.v1.schema.json"
);

const canonicalSchema = JSON.parse(fs.readFileSync(CONTRACTS_SCHEMA_PATH, "utf8"));
const canonicalAjv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: true });
addFormats(canonicalAjv);
const validateCanonical = canonicalAjv.compile(canonicalSchema);

const nullableString = { type: ["string", "null"] };
const nullableDate = { type: ["string", "null"], format: "date" };

export const CONTRACTS_MODEL_DRAFT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["draftVersion", "documentObservations", "candidates", "missingObservations", "packetReferences"],
  properties: {
    draftVersion: { const: "contracts-model-draft.v1" },
    documentObservations: {
      type: "object",
      additionalProperties: false,
      required: ["documentType", "executionDate", "attachmentsStatus", "contractSiteRaw"],
      properties: {
        documentType: {
          enum: ["draft", "signing_version", "signed_contract", "appendix", "amendment", "change_order", "instruction", "unknown"]
        },
        executionDate: nullableDate,
        attachmentsStatus: { enum: ["complete", "incomplete", "unknown"] },
        contractSiteRaw: nullableString
      }
    },
    candidates: {
      type: "array",
      maxItems: 120,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type", "roleCode", "responsibleParty", "beneficiary", "action", "trigger", "fixedDate",
          "offset", "recurrence", "projectionHint", "factStatus", "confidence", "conflictHint", "evidence", "metadata"
        ],
        properties: {
          type: {
            enum: [
              "fixed_milestone", "relative_condition", "recurring_rule", "extension_rule", "extension_event",
              "consequence", "notice_rule", "missing_information", "conflict"
            ]
          },
          roleCode: { type: "string", pattern: "^[a-z][a-z0-9_]{1,79}$" },
          responsibleParty: nullableString,
          beneficiary: nullableString,
          action: { type: "string", minLength: 1, maxLength: 1000 },
          trigger: {
            type: ["object", "null"],
            additionalProperties: false,
            required: ["kind", "description", "eventDate"],
            properties: {
              kind: { enum: ["fixed_date", "event", "signing", "commencement", "inspection_start", "month_end", "channel_delivery", "manager_decision", "unknown"] },
              description: { type: "string", minLength: 1, maxLength: 1000 },
              eventDate: nullableDate
            }
          },
          fixedDate: nullableDate,
          offset: {
            type: ["object", "null"],
            additionalProperties: false,
            required: ["value", "unit", "direction", "inclusivity", "rollConvention"],
            properties: {
              value: { type: ["number", "null"] },
              unit: { enum: ["day", "calendar_day", "working_day", "week", "month", "hour", "unknown"] },
              direction: { enum: ["after", "before", "unspecified"] },
              inclusivity: { enum: ["inclusive", "exclusive", "unspecified"] },
              rollConvention: { enum: ["none", "next_working_day", "previous_working_day", "unspecified"] }
            }
          },
          recurrence: {
            type: ["object", "null"],
            additionalProperties: false,
            required: ["frequency", "window", "occurrencePolicy"],
            properties: {
              frequency: { enum: ["weekly", "monthly", "event_driven", "ad_hoc", "unknown"] },
              window: nullableString,
              occurrencePolicy: { enum: ["each_occurrence", "latest_only", "not_defined"] }
            }
          },
          projectionHint: { enum: ["project_schedule", "contract_compliance", "both", "none"] },
          factStatus: { enum: ["explicit", "inferred", "missing"] },
          confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
          conflictHint: nullableString,
          evidence: {
            type: "array",
            minItems: 1,
            maxItems: 12,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["segmentId", "exactQuote"],
              properties: {
                segmentId: { type: "string", minLength: 1, maxLength: 200 },
                exactQuote: { type: "string", minLength: 1, maxLength: 3000 }
              }
            }
          },
          metadata: { type: "object", maxProperties: 30 }
        }
      }
    },
    missingObservations: {
      type: "array",
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "field", "description", "blocks"],
        properties: {
          key: { type: "string", minLength: 1, maxLength: 120 },
          field: { type: "string", minLength: 1, maxLength: 300 },
          description: { type: "string", minLength: 1, maxLength: 1000 },
          blocks: { type: "array", minItems: 1, maxItems: 20, uniqueItems: true, items: { type: "string", minLength: 1, maxLength: 120 } }
        }
      }
    },
    packetReferences: {
      type: "array",
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["reference", "status", "impact"],
        properties: {
          reference: { type: "string", minLength: 1, maxLength: 500 },
          status: { enum: ["missing", "partial", "present", "unknown"] },
          impact: { type: "string", minLength: 1, maxLength: 1000 }
        }
      }
    }
  }
};

const draftAjv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: true });
addFormats(draftAjv);
const validateDraft = draftAjv.compile(CONTRACTS_MODEL_DRAFT_SCHEMA);

export function assertContractsModelDraft(value) {
  if (validateDraft(value)) return value;
  const issueCodes = schemaIssueCodes(validateDraft.errors, "model_draft");
  throw new ContractsAgentError(
    "contracts_model_draft_invalid",
    "The model returned an invalid contract-extraction draft.",
    502,
    { issueCodes }
  );
}

export function assertContractExtractionSchema(value) {
  if (validateCanonical(value)) return value;
  const issueCodes = schemaIssueCodes(validateCanonical.errors, "canonical_output");
  throw new ContractsAgentError(
    "contracts_output_schema_invalid",
    "Contract extraction failed canonical schema validation.",
    502,
    { issueCodes }
  );
}

export function contractExtractionSchemaErrors(value) {
  return validateCanonical(value) ? [] : schemaIssueCodes(validateCanonical.errors, "canonical_output");
}

function schemaIssueCodes(errors = [], prefix) {
  return [...new Set(errors.map((error) => {
    const pathPart = String(error.instancePath || "root")
      .replace(/^\//u, "")
      .replaceAll("/", ".")
      .replace(/[^a-zA-Z0-9._-]/gu, "_") || "root";
    return `${prefix}.${pathPart}.${error.keyword}`.toLowerCase();
  }))].slice(0, 30);
}
