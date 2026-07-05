import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseMarkdownFile } from '../../packages/cli/src/parser';

/** Create a temp file with the given content and return its path. */
function tmpFile(content, name = 'test.md') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentflow-test-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

describe('parseMarkdownFile', () => {
  describe('file not found', () => {
    it('returns null for a non-existent file', () => {
      const result = parseMarkdownFile('/no/such/file.md');
      expect(result).toBeNull();
    });
  });

  describe('full mode (default)', () => {
    it('parses frontmatter and content', () => {
      const fp = tmpFile('---\nname: hello\ntype: tool\n---\n# My Title\n\nSome body text.');
      const result = parseMarkdownFile(fp);

      expect(result.filePath).toBe(fp);
      // parseMarkdownFile has no notion of a "root" for a standalone call — relativePath
      // is whatever path string was passed in, same as filePath. Real callers (repo-scanner,
      // workflow-service) compute a true relative path themselves before calling.
      expect(result.relativePath).toBe(fp);
      expect(result.frontmatter).toEqual({ name: 'hello', type: 'tool' });
      expect(result.title).toBe('My Title');
      expect(result.content).toContain('Some body text.');
      expect(result.rawContent).toContain('---');
      expect(result.resourceType).toBeNull();
    });

    it('extracts refs from content', () => {
      const fp = tmpFile('# Doc\n\nUse {{tools/search}} and {{-> nodes/next}}.');
      const result = parseMarkdownFile(fp);

      expect(result.refs).toHaveLength(2);
      expect(result.refs[0].semanticType).toBe('mention');
      expect(result.refs[1].semanticType).toBe('edge');
    });

    it('handles file with no frontmatter', () => {
      const fp = tmpFile('# Just Markdown\n\nNo frontmatter here.');
      const result = parseMarkdownFile(fp);

      expect(result.frontmatter).toEqual({});
      expect(result.title).toBe('Just Markdown');
      expect(result.content).toContain('No frontmatter here.');
    });

    it('handles empty frontmatter', () => {
      const fp = tmpFile('---\n---\n# Empty FM\n\nBody.');
      const result = parseMarkdownFile(fp);

      expect(result.frontmatter).toEqual({});
      expect(result.title).toBe('Empty FM');
    });

    it('falls back to filename for title when no heading', () => {
      const fp = tmpFile('Just some text, no heading.', 'my-doc.md');
      const result = parseMarkdownFile(fp);

      expect(result.title).toBe('my-doc');
    });

    it('handles invalid YAML frontmatter gracefully', () => {
      const fp = tmpFile('---\n: invalid: yaml: [broken\n---\n# Title\n\nBody.');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = parseMarkdownFile(fp);

      expect(result.frontmatter).toEqual({});
      expect(result.title).toBe('Title');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('handles empty file', () => {
      const fp = tmpFile('');
      const result = parseMarkdownFile(fp);

      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe('');
      expect(result.refs).toEqual([]);
    });
  });

  describe('metadata-only mode', () => {
    it('extracts frontmatter and title but skips content and refs', () => {
      const fp = tmpFile('---\nname: test\n---\n# My Title\n\nBody with {{tools/search}}.');
      const result = parseMarkdownFile(fp, 'metadata-only');

      expect(result.frontmatter).toEqual({ name: 'test' });
      expect(result.title).toBe('My Title');
      expect(result.content).toBe('');
      expect(result.refs).toEqual([]);
    });

    it('still returns rawContent in metadata-only mode', () => {
      const fp = tmpFile('---\nname: test\n---\n# Title\n\nBody.');
      const result = parseMarkdownFile(fp, 'metadata-only');

      expect(result.rawContent).toContain('name: test');
    });

    it('handles no frontmatter in metadata-only mode', () => {
      const fp = tmpFile('# Heading Only\n\nSome text.');
      const result = parseMarkdownFile(fp, 'metadata-only');

      expect(result.frontmatter).toEqual({});
      expect(result.title).toBe('Heading Only');
      expect(result.content).toBe('');
      expect(result.refs).toEqual([]);
    });
  });
});
