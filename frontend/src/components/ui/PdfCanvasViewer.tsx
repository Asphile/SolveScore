import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Renders a PDF entirely in JavaScript (PDF.js -> <canvas>), never asking the
 * browser to natively open/handle the PDF. This sidesteps two real problems
 * with native <iframe>/<embed> PDF viewing: inconsistent rendering across
 * Chromium builds, and browser settings like Edge's "Always download PDF
 * files" silently turning an in-page preview into a forced download. */
export function PdfCanvasViewer({ data }: { data: ArrayBuffer }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Monotonic counters, not booleans -- so a superseded/cancelled attempt
  // (whether from React StrictMode's dev-mode double-invoke or a genuine page
  // change) is unambiguously ignored rather than mistaken for a real failure.
  const docGenerationRef = useRef(0);
  const pageGenerationRef = useRef(0);

  useEffect(() => {
    const myGeneration = ++docGenerationRef.current;
    setError(null);
    const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
    loadingTask.promise
      .then((doc) => {
        if (docGenerationRef.current !== myGeneration) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
      })
      .catch((err) => {
        if (docGenerationRef.current !== myGeneration) return;
        console.error("PDF load error:", err);
        setError(`Could not read this PDF${err?.message ? `: ${err.message}` : "."}`);
      });
    return () => {
      loadingTask.destroy().catch(() => {});
    };
  }, [data]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    const myGeneration = ++pageGenerationRef.current;
    let renderTask: RenderTask | undefined;

    pdfDoc
      .getPage(pageNum)
      .then((page) => {
        if (pageGenerationRef.current !== myGeneration || !canvasRef.current) return;
        const viewport = page.getViewport({ scale: 1.4 });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        renderTask = page.render({ canvasContext: context, viewport });
        return renderTask.promise;
      })
      .catch((err) => {
        if (pageGenerationRef.current !== myGeneration) return;
        if (err?.name === "RenderingCancelledException") return;
        console.error("PDF page render error:", err);
        setError(`Could not render this page${err?.message ? `: ${err.message}` : "."}`);
      });

    return () => {
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNum]);

  if (error) {
    return <p className="error-text" style={{ padding: 24 }}>{error}</p>;
  }

  return (
    <div className="flex-col" style={{ alignItems: "center", gap: 12, padding: "20px 0", width: "100%" }}>
      <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "68vh" }}>
        <canvas ref={canvasRef} style={{ boxShadow: "var(--shadow-md)", display: "block" }} />
      </div>
      {numPages > 1 && (
        <div className="flex gap-2" style={{ alignItems: "center" }}>
          <button className="btn btn-outline btn-sm" disabled={pageNum <= 1} onClick={() => setPageNum((p) => p - 1)}>
            <ChevronLeft size={15} /> Prev
          </button>
          <span className="text-caption">
            Page {pageNum} of {numPages}
          </span>
          <button className="btn btn-outline btn-sm" disabled={pageNum >= numPages} onClick={() => setPageNum((p) => p + 1)}>
            Next <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
