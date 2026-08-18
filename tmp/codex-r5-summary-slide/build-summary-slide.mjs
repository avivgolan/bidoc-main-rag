import fs from "node:fs/promises";
import { Presentation, PresentationFile, layers, shape, text } from "@oai/artifact-tool";

const OUTPUT_DIR = "C:\\Users\\user\\OneDrive - post.bgu.ac.il\\Documents\\GitHub\\n8n\\main-rag-backend\\bidoc-main-rag\\tmp\\codex-r5-summary-slide\\rendered";
const FINAL_PPTX = "C:\\Users\\user\\OneDrive - post.bgu.ac.il\\Documents\\GitHub\\n8n\\main-rag-backend\\bidoc-main-rag\\docs\\Indicator + Contracts\\BIDoc_Contracts_Agents_Summary_EN_2026-08-18.pptx";

const paragraph = (text, {
  fontSize = 18,
  bold = false,
  color = "#000000",
  spaceAfter = 0,
  lineSpacingPercent = 108000
} = {}) => ({
  runs: [{
    run: text,
    textStyle: {
      fontSize: `${fontSize}px`,
      typeface: "Arial",
      color,
      bold
    }
  }],
  spaceAfter,
  paragraphStyle: { lineSpacingPercent }
});

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function buildSummarySlide(presentation, tokens) {
  const slide = presentation.slides.add();
  const cards = [
    { left: 41, token: tokens.body2 },
    { left: 453, token: tokens.body3 },
    { left: 864, token: tokens.body4 }
  ];
  const elements = [
    text([tokens.footer1], {
      name: "footer",
      position: { left: 1110, top: 659 },
      width: 129,
      height: 25,
      style: {
        fontSize: "13px", typeface: "Arial", color: "#000000",
        alignment: "right", verticalAlignment: "bottom", autoFit: "none",
        insets: { top: 0, right: 0, bottom: 0, left: 0 }
      }
    }),
    text([tokens.title], {
      name: "slide-title",
      position: { left: 41, top: 36 },
      width: 1198,
      height: 94,
      style: {
        fontSize: "39px", typeface: "Arial", color: "#000000",
        alignment: "left", verticalAlignment: "top", autoFit: "none",
        insets: { top: 0, right: 0, bottom: 0, left: 0 }
      }
    }),
    text([
      tokens.body1.topic,
      tokens.body1.loremIpsumDolorSitAmetConsecteturAdipiscing,
      tokens.body1.loremIpsumDolorSitAmetConsecteturAdipiscing2
    ], {
      name: "summary-intro",
      position: { left: 41, top: 143 },
      width: 1198,
      height: 180,
      style: {
        fontSize: "20px", typeface: "Arial", color: "#000000",
        alignment: "left", verticalAlignment: "top", autoFit: "none",
        insets: { top: 0, right: 0, bottom: 0, left: 0 }
      }
    })
  ];

  for (const [index, card] of cards.entries()) {
    elements.push(shape({
      name: `callout-card-${index + 1}`,
      geometry: "roundRect",
      fill: index === 2 ? "#EAF5FC" : "#F2F2F2",
      position: { left: card.left, top: 353 },
      width: 375,
      height: 276
    }));
    elements.push(text(["✓"], {
      name: `check-${index + 1}`,
      position: { left: card.left + 32, top: 381 },
      width: 30,
      height: 34,
      style: {
        fontSize: "25px", bold: true, typeface: "Arial",
        color: index === 2 ? "#3D8DFF" : "#000000",
        alignment: "left", verticalAlignment: "middle", autoFit: "none",
        insets: { top: 0, right: 0, bottom: 0, left: 0 }
      }
    }));
    elements.push(text([
      card.token.titleHere,
      card.token.loremIpsumDolorSitAmetConsecteturAdipiscing
    ], {
      name: `callout-copy-${index + 1}`,
      position: { left: card.left + 33, top: 433 },
      width: 310,
      height: 166,
      style: {
        fontSize: "17px", typeface: "Arial", color: "#000000",
        alignment: "left", verticalAlignment: "top", autoFit: "none",
        insets: { top: 0, right: 0, bottom: 0, left: 0 }
      }
    }));
  }

  slide.compose(
    layers({ name: "codex-grid-summary", width: "fill", height: "fill" }, elements),
    { frame: { left: 0, top: 0, width: 1280, height: 720 }, baseUnit: 1 }
  );
  return slide;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const presentation = Presentation.create({
    slideSize: { width: 1280, height: 720 }
  });

  const tokens = {
    title: paragraph(
      "Completed: Contract Intelligence from PDF to Indicator Handoff",
      { fontSize: 39, bold: true, lineSpacingPercent: 93000 }
    ),
    body1: {
      topic: paragraph(
        "BIDOC | CONTRACTS PIPELINE COMPLETE",
        { fontSize: 18, bold: true, color: "#3D8DFF", spaceAfter: 650 }
      ),
      loremIpsumDolorSitAmetConsecteturAdipiscing: paragraph(
        "The Contracts Agent and Contract Relationships Agent now convert a contract into traceable clauses, reviewed relationships, normalized decisions and a safe, zero-write handoff.",
        { fontSize: 20, lineSpacingPercent: 112000, spaceAfter: 450 }
      ),
      loremIpsumDolorSitAmetConsecteturAdipiscing2: paragraph(
        "Evidence is persisted in KAPAIM and reloads without reprocessing.",
        { fontSize: 20, bold: true, lineSpacingPercent: 112000 }
      )
    },
    body2: {
      titleHere: paragraph("1. Contracts Agent", { fontSize: 24, bold: true, spaceAfter: 700 }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: paragraph(
        "Parsed 743 source lines into 189 grounded records, with Hebrew summaries, controlled tags, exact evidence and durable reuse.",
        { fontSize: 17, lineSpacingPercent: 112000 }
      )
    },
    body3: {
      titleHere: paragraph("2. Relationships & Decisions", { fontSize: 24, bold: true, spaceAfter: 700 }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: paragraph(
        "Connected clauses, surfaced conflicts and references, and produced 137 current decisions with human review and split/merge lineage.",
        { fontSize: 17, lineSpacingPercent: 112000 }
      )
    },
    body4: {
      titleHere: paragraph("3. Indicator Handoff", { fontSize: 24, bold: true, spaceAfter: 700 }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: paragraph(
        "Classified 40 suitable, 24 unsuitable and 73 for review. The future Indicator agent owns placement, dates and Schedule writes.",
        { fontSize: 17, lineSpacingPercent: 112000 }
      )
    },
    footer1: "BIDOC • 2026"
  };

  const slide = buildSummarySlide(presentation, tokens);
  slide.speakerNotes.textFrame.setText(
    "[Sources]\n" +
    "- Internal R5 checkpoint: docs/Indicator + Contracts/BIDoc_Contracts_Pipeline_R5_Shadow_Schedule_Projection_Checkpoint_2026-08-17.md\n" +
    "- Verified retained-workspace audit: 137 current decisions; 40 suitable; 24 unsuitable; 73 requiring review; zero Schedule writes.\n" +
    "- Verified test results: Contracts 148/148; Schedule 47/47; React build passed."
  );
  slide.speakerNotes.setVisible(true);

  await writeBlob(
    `${OUTPUT_DIR}\\slide-1.png`,
    await presentation.export({ slide, format: "png", scale: 2 })
  );
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(`${OUTPUT_DIR}\\slide-1.layout.json`, await layout.text());
  const snapshot = await presentation.inspect({
    kind: "slide,textbox,shape,notes",
    maxChars: 12000
  });
  await fs.writeFile(`${OUTPUT_DIR}\\inspect.ndjson`, snapshot.ndjson);

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(FINAL_PPTX);
  process.stdout.write(JSON.stringify({ finalPptx: FINAL_PPTX, preview: `${OUTPUT_DIR}\\slide-1.png` }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
