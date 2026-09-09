export const MAX_JOB_DESCRIPTION_CHARS = 30_000;

// Up to four UTF-8 bytes per character, plus multipart overhead elsewhere.
export const MAX_JOB_DESCRIPTION_BYTES = MAX_JOB_DESCRIPTION_CHARS * 4;
