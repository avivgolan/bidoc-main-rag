import { readContractDocx, isDocxArchive } from "./docxReader.js";
import { ContractsAgentError } from "./errors.js";
import { isPdfSignature } from "./media.js";

export async function readContractDocument(options = {}) {
  const bytes = options.pdfBytes;
  if (isPdfSignature(bytes)) {
    const { readContractPdf } = await import("./pdfReader.js");
    return readContractPdf(options);
  }
  if (isDocxArchive(bytes)) {
    return readContractDocx(options);
  }
  throw new ContractsAgentError(
    "contracts_document_signature_invalid",
    "The uploaded payload is not a valid PDF or DOCX document.",
    422
  );
}
