import fs from 'fs';

export class FileOperations {
  /**
   * Ensure directory exists, create if not
   */
  static ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Copy file atomically
   */
  static async copyFile(source: string, destination: string): Promise<void> {
    const tempDest = `${destination}.tmp`;
    await fs.promises.copyFile(source, tempDest);
    await fs.promises.rename(tempDest, destination);
  }
}
