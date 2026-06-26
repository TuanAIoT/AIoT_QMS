declare module 'qrcode' {
  export interface ToDataURLOptions {
    readonly errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    readonly margin?: number;
    readonly width?: number;
  }

  const QRCode: {
    toDataURL(text: string, options?: ToDataURLOptions): Promise<string>;
  };

  export default QRCode;
}
