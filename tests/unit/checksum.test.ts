import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChecksumUtil } from '../../src/utils/checksum';
import fs from 'fs';
import path from 'path';

describe('ChecksumUtil', () => {
  const testFile = path.join(__dirname, 'test-checksum.txt');
  const testContent = 'test content for checksum';

  beforeEach(() => {
    fs.writeFileSync(testFile, testContent);
  });

  afterEach(() => {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  it('should calculate file checksum consistently', async () => {
    const checksum1 = await ChecksumUtil.calculateFileChecksum(testFile);
    const checksum2 = await ChecksumUtil.calculateFileChecksum(testFile);

    expect(checksum1).toBe(checksum2);
    expect(checksum1).toHaveLength(64); // SHA-256 produces 64 hex characters
  });

  it('should calculate buffer checksum', () => {
    const buffer = Buffer.from(testContent);
    const checksum = ChecksumUtil.calculateBufferChecksum(buffer);

    expect(checksum).toHaveLength(64);
  });

  it('should verify checksum correctly', async () => {
    const checksum = await ChecksumUtil.calculateFileChecksum(testFile);
    const isValid = await ChecksumUtil.verifyChecksum(testFile, checksum);

    expect(isValid).toBe(true);
  });

  it('should detect incorrect checksum', async () => {
    const incorrectChecksum = 'a'.repeat(64);
    const isValid = await ChecksumUtil.verifyChecksum(testFile, incorrectChecksum);

    expect(isValid).toBe(false);
  });

  it('should produce same checksum for file and buffer', async () => {
    const fileChecksum = await ChecksumUtil.calculateFileChecksum(testFile);
    const buffer = fs.readFileSync(testFile);
    const bufferChecksum = ChecksumUtil.calculateBufferChecksum(buffer);

    expect(fileChecksum).toBe(bufferChecksum);
  });
});
