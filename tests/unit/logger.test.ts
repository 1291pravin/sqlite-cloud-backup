import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../../src/utils/logger';

describe('Logger', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log at info level by default', () => {
    const logger = new Logger();

    logger.info('test message');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] test message', '');
  });

  it('should respect log level', () => {
    const logger = new Logger('warn');

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should log debug messages when level is debug', () => {
    const logger = new Logger('debug');

    logger.debug('debug message');
    expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG] debug message', '');
  });

  it('should log with metadata', () => {
    const logger = new Logger();
    const meta = { key: 'value' };

    logger.info('test', meta);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] test', meta);
  });
});
