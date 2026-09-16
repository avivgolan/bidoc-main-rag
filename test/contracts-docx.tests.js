import assert from "node:assert/strict";
import { runContractsClauseParser } from "../src/contracts/clauseParser.js";
import { CONTRACTS_DOCX_MEDIA_TYPE } from "../src/contracts/media.js";
import { parseContractExtractionRequest } from "../src/contracts/request.js";
import { extractDocxText, isDocxArchive, readContractDocx } from "../src/contracts/docxReader.js";

export function registerContractsDocxTests(test) {
  test("contracts docx reader extracts Hebrew pages from Word XML", async () => {
    const bytes = makeDocx([
      "1. תחולת ההסכם",
      "הקבלן יבצע את העבודות בהתאם להסכם זה ולנספחיו.",
      "2. תמורה",
      "התמורה תשולם לפי חשבון מאושר על ידי המזמין."
    ], { pageBreakAfter: [1] });
    assert.equal(isDocxArchive(bytes), true);
    const parsed = await readContractDocx({ pdfBytes: bytes });
    assert.equal(parsed.pageCount, 2);
    assert.match(parsed.pages[0].text, /תחולת ההסכם/);
    assert.match(parsed.pages[1].text, /תמורה/);
    assert.equal(parsed.pages[0].pdfPage, 1);
    assert.equal(parsed.pages[1].pdfPage, 2);
  });

  test("contracts request intake accepts DOCX bytes and sniffs the media type", () => {
    const pdfBytes = makeDocx([
      "1. General terms of this agreement are binding on both parties to the contract."
    ]);
    const parsed = parseContractExtractionRequest({
      filename: "agreement.docx",
      mediaType: "application/octet-stream",
      pdfBase64: pdfBytes.toString("base64")
    });
    assert.equal(parsed.mediaType, CONTRACTS_DOCX_MEDIA_TYPE);
    assert.equal(parsed.filename, "agreement.docx");
    assert.equal(Buffer.compare(parsed.pdfBytes, pdfBytes), 0);
  });

  test("contracts R2 clause parser accepts a numbered DOCX agreement", async () => {
    const pdfBytes = makeDocx([
      "1. תחולת ההסכם",
      "הקבלן יבצע את העבודות בהתאם להסכם זה.",
      "2. תמורה",
      "התמורה תשולם לפי חשבון מאושר."
    ]);
    const generation = await runContractsClauseParser({ pdfBytes });
    assert.equal(generation.coverageLedger.accepted, true);
    assert.equal(generation.clauses.some((clause) => clause.clauseKey === "1"), true);
    assert.equal(generation.clauses.some((clause) => clause.clauseKey === "2"), true);
  });

  test("contracts docx reader decodes XML entities in body text", () => {
    const xml = '<w:p><w:r><w:t>A &amp; B &lt;C&gt;</w:t></w:r></w:p>';
    assert.equal(extractDocxText(xml), "A & B <C>");
  });

  test("contracts docx reader materializes Word list numbering missing from run text", async () => {
    const bytes = makeNumberedDocx([
      { text: "תחולת ההסכם", ilvl: 0 },
      { text: "הקבלן יבצע את העבודות בהתאם להסכם זה ולנספחיו.", ilvl: null },
      { text: "הסכם זה יחול על כל העבודות באתר.", ilvl: 1 },
      { text: "תמורה", ilvl: 0 },
      { text: "התמורה תשולם לפי חשבון מאושר על ידי המזמין.", ilvl: null }
    ]);
    const parsed = await readContractDocx({ pdfBytes: bytes });
    assert.match(parsed.pages[0].text, /^1\.\s+תחולת ההסכם/m);
    assert.match(parsed.pages[0].text, /^1\.1\.\s+הסכם זה יחול/m);
    assert.match(parsed.pages[0].text, /^2\.\s+תמורה/m);
    const generation = await runContractsClauseParser({ pdfBytes: bytes });
    assert.equal(generation.clauses.some((clause) => clause.clauseKey === "1"), true);
    assert.equal(generation.clauses.some((clause) => clause.clauseKey === "1.1"), true);
    assert.equal(generation.clauses.some((clause) => clause.clauseKey === "2"), true);
  });

  test("contracts docx reader inherits list numbering from paragraph styles", async () => {
    const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="2">
    <w:abstractNumId w:val="0"/>
  </w:num>
</w:numbering>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr>
  </w:style>
</w:styles>`;
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>תחולת ההסכם</w:t></w:r></w:p>
      <w:p><w:r><w:t>הקבלן יבצע את העבודות בהתאם להסכם זה ולנספחיו.</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>תמורה</w:t></w:r></w:p>
      <w:p><w:r><w:t>התמורה תשולם לפי חשבון מאושר על ידי המזמין.</w:t></w:r></w:p>
    </w:body></w:document>`;
    const bytes = zipStore([
      { name: "word/document.xml", data: Buffer.from(document, "utf8") },
      { name: "word/numbering.xml", data: Buffer.from(numbering, "utf8") },
      { name: "word/styles.xml", data: Buffer.from(styles, "utf8") }
    ]);
    const parsed = await readContractDocx({ pdfBytes: bytes });
    assert.match(parsed.pages[0].text, /^1\.\s+תחולת ההסכם/m);
    assert.match(parsed.pages[0].text, /^2\.\s+תמורה/m);
    const generation = await runContractsClauseParser({ pdfBytes: bytes });
    assert.equal(generation.clauses.some((clause) => clause.clauseKey === "1"), true);
    assert.equal(generation.clauses.some((clause) => clause.clauseKey === "2"), true);
  });

  test("contracts clause parser splits colliding appendix item numbers instead of failing coverage", async () => {
    const bytes = makeDocx([
      "1. תחולת ההסכם",
      "הקבלן יבצע את העבודות בהתאם להסכם זה ולנספחיו.",
      "2. תמורה",
      "התמורה תשולם לפי חשבון מאושר על ידי המזמין.",
      "נספח ז' – נוסח ערבות בנקאית לביצוע",
      "1. הננו ערבים בזאת כלפיכם לתשלום של כל סכום שהוא עד לסך הערבות.",
      "1. סכום הערבות כאמור, יוצמד במלואו למדד תשומות הבניה למגורים.",
      "2. לפי דרישתכם הראשונה בכתב, אנו נשלם לכם את הסכום הנדרש."
    ]);
    const generation = await runContractsClauseParser({ pdfBytes: bytes });
    assert.equal(generation.coverageLedger.accepted, true);
    assert.equal(generation.coverageLedger.duplicateKeys.length, 0);
    const appendixItems = generation.clauses.filter((clause) => clause.clauseType === "appendix_item");
    assert.equal(appendixItems.length >= 3, true);
  });
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const localPart = Buffer.concat([local, nameBuf, data]);
    locals.push(localPart);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBuf]));
    offset += localPart.length;
  }
  const localBuf = Buffer.concat(locals);
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16);
  return Buffer.concat([localBuf, centralBuf, eocd]);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function makeDocx(paragraphs, { pageBreakAfter = [] } = {}) {
  const body = paragraphs.map((text, index) => {
    const pageBreak = pageBreakAfter.includes(index)
      ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
      : "";
    return `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>${pageBreak}`;
  }).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  return zipStore([{ name: "word/document.xml", data: Buffer.from(xml, "utf8") }]);
}

function makeNumberedDocx(paragraphs) {
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
    </w:lvl>
    <w:lvl w:ilvl="1">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1.%2."/>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="1"/>
  </w:num>
</w:numbering>`;
  const body = paragraphs.map((item) => {
    const text = typeof item === "string" ? item : item.text;
    const ilvl = typeof item === "string" ? 0 : item.ilvl;
    if (ilvl === null || ilvl === undefined) {
      return `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
    }
    return `<w:p><w:pPr><w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
  }).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  return zipStore([
    { name: "word/document.xml", data: Buffer.from(xml, "utf8") },
    { name: "word/numbering.xml", data: Buffer.from(numbering, "utf8") }
  ]);
}
