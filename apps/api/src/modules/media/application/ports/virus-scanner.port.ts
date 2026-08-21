export interface ScanResult {
  isClean: boolean;
  virusName?: string;
}

export interface VirusScannerPort {
  scanStream(stream: NodeJS.ReadableStream): Promise<ScanResult>;
  scanBuffer(buffer: Buffer): Promise<ScanResult>;
}
