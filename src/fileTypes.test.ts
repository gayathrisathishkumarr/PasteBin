import { describe, expect, it } from 'vitest';
import { acceptedTextFiles, isSupportedTextFile, languageForFile } from './fileTypes';

const file = (name: string, type = '') => ({ name, type } as File);

describe('file upload types', () => {
  it('accepts Java source files and detects the Java language', () => {
    const java = file('Example.java', 'text/x-java-source');
    expect(acceptedTextFiles).toContain('.java');
    expect(isSupportedTextFile(java)).toBe(true);
    expect(languageForFile(java)).toBe('Java');
  });

  it('keeps existing source and general text files supported', () => {
    expect(languageForFile(file('app.ts'))).toBe('TypeScript');
    expect(languageForFile(file('script.py'))).toBe('Python');
    expect(isSupportedTextFile(file('notes.csv', 'text/csv'))).toBe(true);
  });

  it('rejects genuinely unsupported binary files', () => {
    expect(isSupportedTextFile(file('archive.zip', 'application/zip'))).toBe(false);
  });
});
