import type { Node } from 'unist';
import type { Root, RootContent } from 'mdast';

let remarkParse: any;
let remarkStringify: any;
let unified: any;
let visit: any;

async function loadRemarkModules() {
  if (!remarkParse) {
    const remarkParseModule = await (new Function('return import("remark-parse")')());
    const remarkStringifyModule = await (new Function('return import("remark-stringify")')());
    const unifiedModule = await (new Function('return import("unified")')());
    const visitModule = await (new Function('return import("unist-util-visit")')());

    remarkParse = remarkParseModule.default;
    remarkStringify = remarkStringifyModule.default;
    unified = unifiedModule.unified;
    visit = visitModule.visit;
  }
}

export class DocumentManager {
  static async extractToc(markdown: string, maxDepth: number = 3): Promise<string> {
    await loadRemarkModules();
    const normalized = markdown.replace(/^[ \t]+/gm, '').trim();
    const tree = unified().use(remarkParse).parse(normalized);
    const toc: string[] = [];

    function extractText(node: any): string {
      if (node.type === 'text') return node.value;
      if (node.children) return node.children.map(extractText).join('');
      return '';
    }

    function visitNode(node: any): void {
      if (node.type === 'heading' && node.depth <= maxDepth) {
        const text = extractText(node);
        toc.push(`${'#'.repeat(node.depth)} ${text}`);
      }
      if (node.children) node.children.forEach(visitNode);
    }

    visitNode(tree);
    return toc.join('\n');
  }

  static async selectSection(markdown: string, selector: string): Promise<string | undefined> {
    await loadRemarkModules();
    if (!selector) return undefined;

    const tree = unified().use(remarkParse).parse(markdown);
    const lines = markdown.split(/\r?\n/);
    const siblings = (tree as any).children as Node[];

    const isId = selector.startsWith('#');
    const target = isId ? selector.slice(1) : selector.replace(/^#+\s*/, '').trim();

    let startIndex = -1;
    let sectionDepth = 0;

    for (let idx = 0; idx < siblings.length; idx++) {
      const node: any = siblings[idx];
      if (node.type === 'heading') {
        let id: string | undefined;
        if (node.position) {
          const raw = lines[node.position.start.line - 1];
          if (raw) {
            const match = raw.match(/^(#{1,6})\s+.*?\s*\{#(.+?)\}/);
            if (match) id = match[2];
          }
        }

        const text = extractText(node);
        const computedId = id || (node.data?.hProperties?.id as string) || slugify(text);

        if ((isId && computedId === target) || (!isId && text === target)) {
          startIndex = idx;
          sectionDepth = node.depth;
          break;
        }
      }
    }

    if (startIndex < 0) {
      const targetText = selector.replace(/^#+\s*/, '').trim();
      for (let idx = 0; idx < siblings.length; idx++) {
        const node: any = siblings[idx];
        if (node.type === 'heading') {
          const text = extractText(node).trim();
          if (text === targetText) {
            startIndex = idx;
            sectionDepth = node.depth;
            break;
          }
        }
      }
    }

    if (startIndex < 0) return undefined;

    const nodes: Node[] = [];
    for (let i = startIndex; i < siblings.length; i++) {
      const node: any = siblings[i];
      if (node.type === 'heading' && node.depth <= sectionDepth && i > startIndex) {
        break;
      }
      nodes.push(node);
    }

    const sectionTree: Root = { type: 'root', children: nodes as RootContent[] };
    return unified().use(remarkStringify).stringify(sectionTree);
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/[^\w-]/g, '');
}

function extractText(node: any): string {
  let text = '';
  visit(node, 'text', (n: any) => {
    text += n.value;
  });
  return text;
}
