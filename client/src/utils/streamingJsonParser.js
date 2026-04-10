/**
 * Incremental JSON array parser for streaming AI responses.
 * Emits each complete top-level object from a JSON array as it arrives,
 * without waiting for the entire response.
 *
 * Works for flashcard arrays [{front, back}, ...] and exam question arrays.
 */
export function createArrayStreamParser(onItem) {
  let buffer = '';
  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let arrayStarted = false;
  let itemIndex = 0;

  return {
    feed(text) {
      const prevLen = buffer.length;
      buffer += text;

      for (let i = prevLen; i < buffer.length; i++) {
        const ch = buffer[i];

        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\' && inString) {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;

        if (ch === '[' && !arrayStarted) {
          arrayStarted = true;
          continue;
        }

        if (ch === '{') {
          if (depth === 0) objectStart = i;
          depth++;
        }

        if (ch === '}') {
          depth--;
          if (depth === 0 && objectStart >= 0) {
            try {
              const obj = JSON.parse(buffer.slice(objectStart, i + 1));
              onItem(obj, itemIndex++);
            } catch {
              // Incomplete or malformed — skip silently
            }
            objectStart = -1;
          }
        }
      }
    },

    getFullText() {
      return buffer;
    },

    getItemCount() {
      return itemIndex;
    },
  };
}
