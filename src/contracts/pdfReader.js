import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { CONTRACTS_PDF_READER_VERSION } from "./constants.js";
import { ContractsAgentError } from "./errors.js";

export { CONTRACTS_PDF_READER_VERSION };
export const CONTRACTS_MAX_PAGES = 80;
export const CONTRACTS_MAX_TEXT_CHARACTERS = 160_000;

const BIDI_MARKS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;
const PDFJS_CDN_VERSION = "4.10.38";
const require = createRequire(import.meta.url);
const pdfjsRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
const packedCmapUrl = `${pathToFileURL(path.join(pdfjsRoot, "cmaps")).href}/`;
const packedStandardFontDataUrl = `${pathToFileURL(path.join(pdfjsRoot, "standard_fonts")).href}/`;
const remoteCmapUrl = `https://unpkg.com/pdfjs-dist@${PDFJS_CDN_VERSION}/cmaps/`;
const remoteStandardFontDataUrl = `https://unpkg.com/pdfjs-dist@${PDFJS_CDN_VERSION}/standard_fonts/`;

ensurePdfjsDomPolyfills();

export function contractPdfLoadOptions(pdfBytes, { vercel = Boolean(process.env.VERCEL) } = {}) {
  const source = pdfBytes instanceof Uint8Array
    ? pdfBytes
    : new Uint8Array(pdfBytes || []);
  const data = new Uint8Array(source.byteLength);
  data.set(source);
  return {
    data,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
    verbosity: 0,
    isOffscreenCanvasSupported: false,
    disableRange: true,
    disableStream: true,
    disableAutoFetch: true,
    cMapPacked: true,
    cMapUrl: vercel ? remoteCmapUrl : packedCmapUrl,
    standardFontDataUrl: vercel ? remoteStandardFontDataUrl : packedStandardFontDataUrl,
    canvasFactory: createContractsCanvasFactory()
  };
}

function loadNapiCanvas() {
  return require("@napi-rs/canvas");
}

function ensurePdfjsDomPolyfills() {
  try {
    const canvas = loadNapiCanvas();
    if (typeof globalThis.DOMMatrix === "undefined" && canvas.DOMMatrix) {
      globalThis.DOMMatrix = canvas.DOMMatrix;
    }
    if (typeof globalThis.ImageData === "undefined" && canvas.ImageData) {
      globalThis.ImageData = canvas.ImageData;
    }
    if (typeof globalThis.Path2D === "undefined" && canvas.Path2D) {
      globalThis.Path2D = canvas.Path2D;
    }
  } catch {
    // Optional on machines that only run mocked PDF tests.
  }
}

function createContractsCanvasFactory() {
  return {
    create(width, height) {
      const canvas = loadNapiCanvas().createCanvas(width, height);
      return {
        canvas,
        context: canvas.getContext("2d", { willReadFrequently: true })
      };
    },
    reset(canvasAndContext, width, height) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    },
    destroy(canvasAndContext) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    }
  };
}

export async function readContractPdf({
  pdfBytes,
  maxPages = CONTRACTS_MAX_PAGES,
  maxTextCharacters = CONTRACTS_MAX_TEXT_CHARACTERS,
  deadlineAt = null,
  signal = null,
  loadDocument = getDocument
} = {}) {
  const boundary = createPdfOperationBoundary({ deadlineAt, signal });
  let loadingTask = null;
  let document = null;
  let primaryError = null;
  try {
    try {
      throwIfPdfOperationAborted(boundary.signal);
      loadingTask = loadDocument(contractPdfLoadOptions(pdfBytes));
      document = await racePdfOperation(loadingTask.promise, boundary.signal);
    } catch (error) {
      throw mapPdfDocumentFailure(error, boundary.signal);
    }

    if (!Number.isInteger(document.numPages) || document.numPages < 1) {
      throw new ContractsAgentError("contracts_pdf_empty", "The PDF contains no readable pages.", 422);
    }
    if (document.numPages > maxPages) {
      throw new ContractsAgentError(
        "contracts_pdf_page_limit",
        `The PDF exceeds the ${maxPages}-page Phase 1 limit.`,
        413
      );
    }

    const pages = [];
    const unreadablePages = [];
    let extractedCharacters = 0;
    for (let pdfPage = 1; pdfPage <= document.numPages; pdfPage += 1) {
      let page = null;
      try {
        throwIfPdfOperationAborted(boundary.signal);
        page = await racePdfOperation(
          Promise.resolve().then(() => document.getPage(pdfPage)),
          boundary.signal
        );
        const content = await racePdfOperation(
          Promise.resolve().then(() => page.getTextContent({ includeMarkedContent: false })),
          boundary.signal
        );
        const text = reconstructPdfPageText(content.items);
        extractedCharacters += text.length;
        if (extractedCharacters > maxTextCharacters) {
          throw new ContractsAgentError(
            "contracts_pdf_text_limit",
            `Extracted PDF text exceeds the ${maxTextCharacters}-character Phase 1 limit.`,
            413
          );
        }
        if (!text) unreadablePages.push(pdfPage);
        pages.push({ pdfPage, text, characterCount: text.length });
      } catch (error) {
        throw mapPdfPageFailure(error, pdfPage, boundary.signal);
      } finally {
        page?.cleanup();
      }
    }

    if (extractedCharacters < 40) {
      throw new ContractsAgentError(
        "contracts_pdf_text_unavailable",
        "The PDF has no usable text layer. OCR is not supported in Phase 1.",
        422
      );
    }

    return {
      readerVersion: CONTRACTS_PDF_READER_VERSION,
      pageCount: document.numPages,
      extractedCharacters,
      unreadablePages,
      pages
    };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      const destroy = document?.destroy?.bind(document) || loadingTask?.destroy?.bind(loadingTask);
      if (destroy) {
        const cleanupPromise = Promise.resolve().then(() => destroy());
        await racePdfOperation(cleanupPromise, boundary.signal);
      }
    } catch (error) {
      if (!primaryError) throw mapPdfInternalOrAbortFailure(error, boundary.signal);
    } finally {
      boundary.dispose();
    }
  }
}

function createPdfOperationBoundary({ deadlineAt, signal } = {}) {
  const controller = new AbortController();
  const externalSignal = signal && typeof signal.addEventListener === "function" ? signal : null;
  const abortFromExternal = () => {
    if (controller.signal.aborted) return;
    controller.abort(contractExtractionCancellationError(externalSignal?.reason));
  };
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  const numericDeadline = Number(deadlineAt);
  let deadlineTimer = null;
  if (deadlineAt !== null && deadlineAt !== undefined && Number.isFinite(numericDeadline)) {
    const remainingMs = numericDeadline - Date.now();
    if (remainingMs <= 0) {
      controller.abort(contractExtractionDeadlineError());
    } else {
      deadlineTimer = setTimeout(() => {
        if (!controller.signal.aborted) controller.abort(contractExtractionDeadlineError());
      }, Math.min(remainingMs, 2_147_483_647));
    }
  }

  return {
    signal: controller.signal,
    dispose() {
      if (deadlineTimer) clearTimeout(deadlineTimer);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    }
  };
}

function racePdfOperation(operation, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abortOperation);
      callback(value);
    };
    const abortOperation = () => finish(reject, pdfAbortReason(signal));
    signal?.addEventListener("abort", abortOperation, { once: true });
    if (signal?.aborted) abortOperation();
    Promise.resolve(operation).then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error)
    );
  });
}

function mapPdfDocumentFailure(error, signal) {
  const abortError = pdfAbortFailure(error, signal);
  if (abortError) return abortError;
  if (error instanceof ContractsAgentError) return error;
  console.error("[contracts:pdf] document open failed", {
    name: String(error?.name || "Error").slice(0, 80),
    message: String(error?.message || "").replace(/[\r\n]+/gu, " ").slice(0, 400)
  });
  const encrypted = /password|encrypted/i.test(String(error?.message || ""));
  return new ContractsAgentError(
    encrypted ? "contracts_pdf_encrypted" : "contracts_pdf_unreadable",
    encrypted ? "Encrypted PDFs are not supported in Phase 1." : "The PDF could not be read.",
    422,
    { cause: error }
  );
}

function mapPdfPageFailure(error, pdfPage, signal) {
  const abortError = pdfAbortFailure(error, signal);
  if (abortError) return abortError;
  if (error instanceof ContractsAgentError) return error;
  return new ContractsAgentError(
    "contracts_pdf_page_unreadable",
    `PDF page ${pdfPage} could not be read.`,
    422,
    { cause: error, issueCodes: ["pdf.page_unreadable"] }
  );
}

function mapPdfInternalOrAbortFailure(error, signal) {
  return pdfAbortFailure(error, signal) || error;
}

function pdfAbortFailure(error, signal) {
  if (signal?.aborted) return pdfAbortReason(signal);
  if (error instanceof ContractsAgentError) return null;
  if (error?.name === "AbortError" || error?.name === "AbortException") {
    return contractExtractionCancellationError(error);
  }
  return null;
}

function throwIfPdfOperationAborted(signal) {
  if (signal?.aborted) throw pdfAbortReason(signal);
}

function pdfAbortReason(signal) {
  return signal?.reason instanceof ContractsAgentError
    ? signal.reason
    : contractExtractionCancellationError(signal?.reason);
}

function contractExtractionDeadlineError() {
  return new ContractsAgentError(
    "contracts_extraction_time_budget_exceeded",
    "The Contracts Agent exceeded its bounded extraction time budget.",
    504,
    { issueCodes: ["extraction.time_budget_exceeded"] }
  );
}

function contractExtractionCancellationError(cause) {
  if (cause instanceof ContractsAgentError) return cause;
  return new ContractsAgentError(
    "contracts_extraction_cancelled",
    "Contract extraction was cancelled.",
    499,
    { cause, issueCodes: ["extraction.cancelled"] }
  );
}

export function reconstructPdfPageText(items = []) {
  const lines = [];
  let line = "";
  let previous = null;

  const flush = () => {
    const normalized = normalizeExtractedLine(line);
    if (normalized) lines.push(normalized);
    line = "";
    previous = null;
  };

  for (const item of items) {
    const raw = String(item?.str || "").normalize("NFC").replace(BIDI_MARKS, "");
    if (!raw) {
      if (item?.hasEOL) flush();
      continue;
    }

    if (previous && isDifferentVisualLine(previous, item)) flush();
    if (previous && shouldInsertWordSpace(previous, item, line, raw)) line += " ";
    line += raw;
    previous = item;
    if (item?.hasEOL) flush();
  }
  flush();
  return lines.join("\n");
}

function isDifferentVisualLine(previous, current) {
  const previousY = Number(previous?.transform?.[5]);
  const currentY = Number(current?.transform?.[5]);
  if (!Number.isFinite(previousY) || !Number.isFinite(currentY)) return false;
  const height = Math.max(1, Math.min(Number(previous.height || 0) || 10, Number(current.height || 0) || 10));
  return Math.abs(previousY - currentY) > height * 0.55;
}

function shouldInsertWordSpace(previous, current, line, raw) {
  if (!line || /\s$/u.test(line) || /^\s/u.test(raw)) return false;
  const previousX = Number(previous?.transform?.[4]);
  const currentX = Number(current?.transform?.[4]);
  const previousWidth = Number(previous?.width || 0);
  const currentWidth = Number(current?.width || 0);
  if (![previousX, currentX, previousWidth, currentWidth].every(Number.isFinite)) {
    return String(previous?.str || "").length > 1 || raw.length > 1;
  }
  const gap = previousX >= currentX
    ? previousX - (currentX + currentWidth)
    : currentX - (previousX + previousWidth);
  const height = Math.max(1, Math.min(Number(previous.height || 0) || 10, Number(current.height || 0) || 10));
  return gap > Math.max(1.25, height * 0.12);
}

function normalizeExtractedLine(value) {
  return String(value || "")
    .replace(BIDI_MARKS, "")
    .replace(/[\t ]+/gu, " ")
    .trim();
}
