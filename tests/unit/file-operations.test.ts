import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileOperations } from '../../src/utils/file-operations';
import fs from 'fs';
import path from 'path';

describe('FileOperations', () => {
  const testDir = path.join(__dirname, 'test-file-operations');

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('ensureDir', () => {
    it('should create directory if not exists', () => {
      const newDir = path.join(testDir, 'new-directory');

      expect(fs.existsSync(newDir)).toBe(false);

      FileOperations.ensureDir(newDir);

      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('should create nested directories', () => {
      const nestedDir = path.join(testDir, 'level1', 'level2', 'level3');

      FileOperations.ensureDir(nestedDir);

      expect(fs.existsSync(nestedDir)).toBe(true);
    });

    it('should not throw if directory already exists', () => {
      const existingDir = path.join(testDir, 'existing');
      fs.mkdirSync(existingDir);

      expect(() => FileOperations.ensureDir(existingDir)).not.toThrow();
    });
  });

  describe('copyFile', () => {
    it('should copy file to destination', async () => {
      const sourceFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'dest.txt');
      const content = 'test content for copying';

      fs.writeFileSync(sourceFile, content);

      await FileOperations.copyFile(sourceFile, destFile);

      expect(fs.existsSync(destFile)).toBe(true);
      expect(fs.readFileSync(destFile, 'utf-8')).toBe(content);
    });

    it('should use atomic write (temp file + rename)', async () => {
      const sourceFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'dest.txt');

      fs.writeFileSync(sourceFile, 'atomic test');

      await FileOperations.copyFile(sourceFile, destFile);

      // Temp file should not exist after copy
      expect(fs.existsSync(`${destFile}.tmp`)).toBe(false);
      expect(fs.existsSync(destFile)).toBe(true);
    });

    it('should overwrite existing destination', async () => {
      const sourceFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'dest.txt');

      fs.writeFileSync(sourceFile, 'new content');
      fs.writeFileSync(destFile, 'old content');

      await FileOperations.copyFile(sourceFile, destFile);

      expect(fs.readFileSync(destFile, 'utf-8')).toBe('new content');
    });

    it('should preserve file content exactly', async () => {
      const sourceFile = path.join(testDir, 'binary-source.bin');
      const destFile = path.join(testDir, 'binary-dest.bin');

      // Create binary content
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      fs.writeFileSync(sourceFile, binaryContent);

      await FileOperations.copyFile(sourceFile, destFile);

      const copiedContent = fs.readFileSync(destFile);
      expect(copiedContent.equals(binaryContent)).toBe(true);
    });

    it('should handle large files', async () => {
      const sourceFile = path.join(testDir, 'large-source.txt');
      const destFile = path.join(testDir, 'large-dest.txt');

      // Create a ~1MB file
      const largeContent = 'x'.repeat(1024 * 1024);
      fs.writeFileSync(sourceFile, largeContent);

      await FileOperations.copyFile(sourceFile, destFile);

      const stats = fs.statSync(destFile);
      expect(stats.size).toBe(largeContent.length);
    });
  });
});
