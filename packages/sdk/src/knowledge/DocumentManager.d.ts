export declare class DocumentManager {
    static extractToc(markdown: string, maxDepth?: number): Promise<string>;
    static selectSection(markdown: string, selector: string): Promise<string | undefined>;
}
