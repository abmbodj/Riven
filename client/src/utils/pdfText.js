let pdfModulePromise = null;

const loadPdfModule = async () => {
  if (!pdfModulePromise) {
    pdfModulePromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfModule, workerModule]) => {
      pdfModule.GlobalWorkerOptions.workerSrc = workerModule.default;
      return pdfModule;
    });
  }
  return pdfModulePromise;
};

export async function extractPdfText(file, {
  getDocumentImpl = null,
  maxCharacters = 120_000,
} = {}) {
  if (!(file instanceof Blob)) throw new Error('PDF source must be a file');
  const documentFactory = getDocumentImpl || (await loadPdfModule()).getDocument;
  const loadingTask = documentFactory({ data: new Uint8Array(await file.arrayBuffer()) });
  const document = await loadingTask.promise;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = (content.items || [])
        .map((item) => String(item?.str || '').trim())
        .filter(Boolean)
        .join(' ');
      if (text) pages.push(`Page ${pageNumber}\n${text}`);
      if (pages.join('\n\n').length >= maxCharacters) break;
    }
    return pages.join('\n\n').slice(0, maxCharacters).trim();
  } finally {
    await document.destroy?.();
  }
}
