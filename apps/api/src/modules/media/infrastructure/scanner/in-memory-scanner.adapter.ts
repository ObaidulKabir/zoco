import type { ScanResult, VirusScannerPort } from '../../application/ports/virus-scanner.port';

export class InMemoryScannerAdapter implements VirusScannerPort {
  async scanStream(stream: NodeJS.ReadableStream): Promise<ScanResult> {
    return { isClean: true };
  }

  async scanBuffer(buffer: Buffer): Promise<ScanResult> {
    const text = buffer.toString('utf8');
    if (text.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE') || text.includes('eicar')) {
      return { isClean: false, virusName: 'Eicar-Test-Signature' };
    }
    return { isClean: true };
  }
}
