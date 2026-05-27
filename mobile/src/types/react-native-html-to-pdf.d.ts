declare module 'react-native-html-to-pdf' {
  export interface PdfOptions {
    html: string;
    fileName?: string;
    directory?: string;
    base64?: boolean;
    width?: number;
    height?: number;
  }

  export interface PdfResult {
    filePath?: string;
    base64?: string;
  }

  export function generatePDF(options: PdfOptions): Promise<PdfResult>;
}
