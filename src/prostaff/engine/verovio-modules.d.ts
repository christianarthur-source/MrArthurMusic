// Minimal typings for the parts of Verovio that Pro Staff uses (the package ships without them).
declare module 'verovio/wasm' {
  const createVerovioModule: () => Promise<unknown>;
  export default createVerovioModule;
}

declare module 'verovio/esm' {
  export interface TimemapEntry {
    tstamp: number;
    qstamp: number;
    on?: string[];
    off?: string[];
    restsOn?: string[];
    restsOff?: string[];
    tempo?: number;
    measureOn?: string;
  }
  export class VerovioToolkit {
    constructor(module: unknown);
    getVersion(): string;
    setOptions(options: Record<string, unknown>): void;
    getOptions(): Record<string, unknown>;
    getAvailableOptions(): any;
    loadData(data: string): boolean;
    loadZipDataBuffer(data: ArrayBuffer): boolean;
    getPageCount(): number;
    renderToSVG(page?: number, xmlDeclaration?: boolean): string;
    renderToMIDI(): string;
    renderToTimemap(options?: Record<string, unknown>): TimemapEntry[];
    getMIDIValuesForElement(id: string): { pitch?: number; time?: number; duration?: number };
    getTimesForElement(id: string): any;
    getElementsAtTime(ms: number): { notes: string[]; page: number; measure: string };
    getPageWithElement(id: string): number;
    getElementAttr(id: string): Record<string, string>;
    getMEI(options?: Record<string, unknown>): string;
    getLog(): string;
    redoLayout(options?: Record<string, unknown>): void;
    renderToPAE(): string;
  }
}
