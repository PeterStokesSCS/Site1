// Render a DOM node (the formatted variation document) to an A4 PDF Blob.
// Used for download and for storing the signed copy against the project.
// jsPDF + html2canvas are loaded on demand to keep them out of the initial bundle.

export async function generatePdfBlob(node) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const fullImgH = (canvas.height * imgW) / canvas.width;

  if (fullImgH <= pageH) {
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, imgW, fullImgH);
  } else {
    // Slice the tall canvas into page-height chunks.
    const pagePx = Math.floor((pageH * canvas.width) / pageW); // canvas px per A4 page
    let rendered = 0, page = 0;
    while (rendered < canvas.height) {
      const slicePx = Math.min(pagePx, canvas.height - rendered);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = slicePx;
      slice.getContext("2d").drawImage(canvas, 0, rendered, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
      const sliceH = (slicePx * imgW) / canvas.width;
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, imgW, sliceH);
      rendered += slicePx;
      page++;
    }
  }
  return pdf.output("blob");
}

// Generate and trigger a browser download.
export async function downloadPdf(node, filename) {
  const blob = await generatePdfBlob(node);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
