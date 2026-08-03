/**
 * Validation for the text-file-generation tool — no Prisma import here,
 * mirroring `lib/ai/tools/web-search.ts`'s boundary: this file only
 * shapes/validates what the model gave it, the caller (run-task-
 * orchestration.ts) owns actually persisting it.
 */

export interface TextFile {
  filename: string;
  content: string;
}

const MAX_CONTENT_LENGTH = 20_000;
// No slashes or path-traversal-shaped characters — this never touches a
// real filesystem today, but a stored filename shouldn't look like a path
// regardless, and it's a cheap constraint to hold on to.
const FILENAME_PATTERN = /^[a-zA-Z0-9_.\- ]{1,80}$/;

export function prepareTextFile(filename: string, content: string): TextFile {
  const trimmedName = filename.trim();
  if (!FILENAME_PATTERN.test(trimmedName)) {
    throw new Error(
      "Filename must be 1-80 characters using only letters, numbers, spaces, dots, dashes, or underscores.",
    );
  }
  if (!content.trim()) {
    throw new Error("File content cannot be empty.");
  }
  return {
    filename: trimmedName,
    content:
      content.length > MAX_CONTENT_LENGTH
        ? content.slice(0, MAX_CONTENT_LENGTH)
        : content,
  };
}
