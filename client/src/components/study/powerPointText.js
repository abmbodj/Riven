import JSZip from 'jszip';

const MAX_XML_CHARS = 8 * 1024 * 1024;
const RELATIONSHIP_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const STRICT_RELATIONSHIP_NS = 'http://purl.oclc.org/ooxml/officeDocument/relationships';

export async function extractPowerPointText(file) {
  const parser = new DOMParser();
  let remainingXmlChars = MAX_XML_CHARS;

  try {
    const deck = await JSZip.loadAsync(await file.arrayBuffer());
    const readXml = async (path) => {
      const entry = deck.file(path);
      if (!entry) throw new Error('Missing PowerPoint XML');

      const xml = await new Promise((resolve, reject) => {
        const chunks = [];
        const stream = entry.internalStream('string');
        stream.on('data', (chunk) => {
          remainingXmlChars -= chunk.length;
          if (remainingXmlChars < 0) {
            stream.pause();
            reject(new Error('PowerPoint XML exceeds size limit'));
            return;
          }
          chunks.push(chunk);
        });
        stream.on('error', reject);
        stream.on('end', () => resolve(chunks.join('')));
        stream.resume();
      });

      const document = parser.parseFromString(xml, 'application/xml');
      if (document.getElementsByTagName('parsererror').length) throw new Error('Invalid PowerPoint XML');
      return document;
    };

    const presentation = await readXml('ppt/presentation.xml');
    const relationships = await readXml('ppt/_rels/presentation.xml.rels');
    const slidePaths = new Map(
      Array.from(relationships.getElementsByTagNameNS('*', 'Relationship'), (relation) => [
        relation.getAttribute('Id'),
        relation.getAttribute('Target'),
      ]),
    );
    const slides = [];
    const slideIds = presentation.getElementsByTagNameNS('*', 'sldId');
    for (const [index, slideId] of Array.from(slideIds).entries()) {
      const id = slideId.getAttributeNS(RELATIONSHIP_NS, 'id')
        ?? slideId.getAttributeNS(STRICT_RELATIONSHIP_NS, 'id');
      const target = slidePaths.get(id);
      if (!target) throw new Error('Missing PowerPoint slide');
      const path = target.startsWith('/') ? target.slice(1) : `ppt/${target}`;
      const slide = await readXml(path);
      const paragraphs = Array.from(slide.getElementsByTagNameNS('*', 'p'), (paragraph) =>
        Array.from(paragraph.getElementsByTagNameNS('*', 't'), (run) => run.textContent)
          .join('')
          .trim(),
      ).filter(Boolean);
      if (paragraphs.length) slides.push(`Slide ${index + 1}\n${paragraphs.join('\n')}`);
    }

    return slides.join('\n\n');
  } catch {
    throw new Error('Could not read this PowerPoint. Try uploading another .pptx file.');
  }
}
