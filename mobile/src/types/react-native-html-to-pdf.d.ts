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

  const RNHTMLtoPDF: {
    convert(options: PdfOptions): Promise<PdfResult>;
  };

  export default RNHTMLtoPDF;
}

declare function require(name: string): any;
