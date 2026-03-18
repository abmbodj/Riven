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

/**
 * Incremental parser for Tiptap doc JSON.
 * Emits each top-level node from the "content" array as it completes.
 * Useful for rendering guide/note sections progressively.
 *
 * Tiptap docs look like: { "type": "doc", "content": [ {node}, {node}, ... ] }
 * We parse each {node} as it completes within the content array.
 */
export function createDocStreamParser(onNode) {
  let buffer = '';
  let contentArrayStarted = false;
  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let nodeIndex = 0;

  return {
    feed(text) {
      const prevLen = buffer.length;
      buffer += text;

      // First, detect when we've entered the content array
      if (!contentArrayStarted) {
        const contentIdx = buffer.indexOf('"content"');
        if (contentIdx === -1) return;

        // Find the opening [ after "content":
        const bracketIdx = buffer.indexOf('[', contentIdx + 9);
        if (bracketIdx === -1) return;

        contentArrayStarted = true;
        // Reset parsing state and start scanning from after the [
        inString = false;
        escaped = false;
        depth = 0;
        objectStart = -1;

        // Scan from bracketIdx + 1
        for (let i = bracketIdx + 1; i < prevLen; i++) {
          this._processChar(i);
        }
      }

      for (let i = Math.max(prevLen, 0); i < buffer.length; i++) {
        if (!contentArrayStarted) continue;
        this._processChar(i);
      }
    },

    _processChar(i) {
      const ch = buffer[i];

      if (escaped) {
        escaped = false;
        return;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        return;
      }
      if (ch === '"') {
        inString = !inString;
        return;
      }
      if (inString) return;

      if (ch === '{') {
        if (depth === 0) objectStart = i;
        depth++;
      }

      if (ch === '}') {
        depth--;
        if (depth === 0 && objectStart >= 0) {
          try {
            const node = JSON.parse(buffer.slice(objectStart, i + 1));
            onNode(node, nodeIndex++);
          } catch {
            // Incomplete — skip
          }
          objectStart = -1;
        }
      }
    },

    getFullText() {
      return buffer;
    },

    getNodeCount() {
      return nodeIndex;
    },
  };
}
