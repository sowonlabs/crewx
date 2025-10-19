import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CrewXTool } from '../../../src/crewx.tool';
import type { AgentInfo, LayoutDefinition, LayoutLoader } from '@sowonai/crewx-sdk';
import { LayoutRenderer } from '@sowonai/crewx-sdk';

type DocumentLoaderStub = {
  isInitialized: () => boolean;
  getDocumentContent: () => Promise<string | undefined>;
  getDocumentToc: () => Promise<string | undefined>;
  getDocumentSummary: () => Promise<string | undefined>;
};

const defaultLayout: LayoutDefinition = {
  id: 'crewx/default',
  version: '1.0.0',
  description: 'Test default layout',
  propsSchema: {},
  defaultProps: {},
  template: `<crewx_system_prompt key="{{vars.security_key}}">
  <profile>
    <id>{{agent.id}}</id>
    {{#if agent.specialties.[0]}}
    <specialties>
      {{#each agent.specialties}}
      <item>{{{this}}}</item>
      {{/each}}
    </specialties>
    {{/if}}
    {{#if agent.capabilities.[0]}}
    <capabilities>
      {{#each agent.capabilities}}
      <item>{{{this}}}</item>
      {{/each}}
    </capabilities>
    {{/if}}
  </profile>
  <body>{{{layout.system_prompt}}}</body>
</crewx_system_prompt>`,
};

const minimalLayout: LayoutDefinition = {
  id: 'crewx/minimal',
  version: '1.0.0',
  description: 'Test minimal layout',
  propsSchema: {},
  defaultProps: {},
  template: `<system_prompt key="{{vars.security_key}}">
{{{layout.system_prompt}}}
</system_prompt>`,
};

const customLayout: LayoutDefinition = {
  id: 'crewx_dev_layout',
  version: '1.0.0',
  description: 'Developer layout',
  propsSchema: {},
  defaultProps: {},
  template: `<dev_prompt key="{{vars.security_key}}">
  <header>{{props.title}}</header>
  <agent>{{agent.id}}</agent>
  <prompt>{{{layout.system_prompt}}}</prompt>
</dev_prompt>`,
};

function createLayoutLoader(overrides?: {
  layouts?: Record<string, LayoutDefinition>;
  throwFor?: Set<string>;
}): LayoutLoader {
  const layouts = {
    [defaultLayout.id]: defaultLayout,
    [minimalLayout.id]: minimalLayout,
    [customLayout.id]: customLayout,
    ...(overrides?.layouts ?? {}),
  };
  const throwFor = overrides?.throwFor ?? new Set<string>();
  return {
    load: vi.fn((layoutId: string) => {
      if (throwFor.has(layoutId)) {
        throw new Error(`layout ${layoutId} missing`);
      }
      const layout = layouts[layoutId];
      if (!layout) {
        throw new Error(`layout ${layoutId} not registered`);
      }
      return layout;
    }),
    getLayoutIds: () => Object.keys(layouts),
    hasLayout: (layoutId: string) => layoutId in layouts,
    reload: vi.fn(),
  } as unknown as LayoutLoader;
}

function createDocumentLoader(): DocumentLoaderStub {
  return {
    isInitialized: () => false,
    getDocumentContent: vi.fn().mockResolvedValue(undefined),
    getDocumentToc: vi.fn().mockResolvedValue(undefined),
    getDocumentSummary: vi.fn().mockResolvedValue(undefined),
  };
}

function createCrewXTool(deps?: {
  layoutLoader?: LayoutLoader;
  documentLoader?: DocumentLoaderStub;
  layoutRenderer?: LayoutRenderer;
}) {
  const layoutLoader = deps?.layoutLoader ?? createLayoutLoader();
  const documentLoader = deps?.documentLoader ?? createDocumentLoader();
  const layoutRenderer = deps?.layoutRenderer ?? new LayoutRenderer();

  const stub = <T extends object>(methods: Partial<T>): T => methods as T;

  return {
    tool: new CrewXTool(
      stub({}) as any,
      stub({ log: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) as any, // Logger mock with all methods
      stub({}) as any,
      stub({}) as any,
      stub({ createTask: () => 'task', addTaskLog: vi.fn(), completeTask: vi.fn() }) as any,
      stub({}) as any,
      stub({}) as any,
      documentLoader as unknown as any,
      stub({ list: () => [], setCrewXTool: vi.fn() }) as any,
      stub({}) as any,
      stub({}) as any,
      layoutLoader,
      layoutRenderer,
    ),
    layoutLoader,
  };
}

function buildAgent(partial: Partial<AgentInfo>): AgentInfo {
  return {
    id: 'crewx',
    provider: 'claude',
    workingDirectory: '.',
    capabilities: ['analysis'],
    description: 'CrewX assistant',
    inline: {
      type: 'agent',
      provider: 'claude',
      system_prompt: '<base>Prompt {{vars.security_key}}</base>',
    },
    specialties: ['general'],
    ...partial,
  } as AgentInfo;
}

const templateContext = {
  mode: 'query' as const,
  platform: 'cli' as const,
  vars: { security_key: 'secure123' },
  messages: [],
  env: {},
  options: [],
  agent: {
    id: 'crewx',
    name: 'CrewX Assistant',
    provider: 'claude',
    workingDirectory: '.',
  },
};

describe('CrewXTool processAgentSystemPrompt', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders default layout when inline layout is not provided', async () => {
    const { tool, layoutLoader } = createCrewXTool();
    const agent = buildAgent({ inline: { type: 'agent', provider: 'claude', system_prompt: '<base>Inline</base>' } });

    const rendered = await (tool as any).processAgentSystemPrompt(agent, templateContext);

    expect((layoutLoader.load as any).mock.calls[0][0]).toBe('crewx/default');
    expect(rendered).toContain('<crewx_system_prompt key="secure123">');
    expect(rendered).toContain('<id>crewx</id>');
    expect(rendered).toContain('<base>Inline</base>');
  });

  it('renders minimal layout when inline layout specifies crewx/minimal', async () => {
    const { tool, layoutLoader } = createCrewXTool();
    const agent = buildAgent({
      inline: {
        type: 'agent',
        provider: 'claude',
        prompt: 'Plain text prompt',
        layout: 'crewx/minimal',
      },
    });

    const rendered = await (tool as any).processAgentSystemPrompt(agent, templateContext);

    expect((layoutLoader.load as any).mock.calls[0][0]).toBe('crewx/minimal');
    expect(rendered.trim()).toBe('<system_prompt key="secure123">\nPlain text prompt\n</system_prompt>');
  });

  it('renders custom layout when inline layout id matches custom entry', async () => {
    const layoutLoader = createLayoutLoader();
    const { tool } = createCrewXTool({ layoutLoader });
    const agent = buildAgent({
      inline: {
        type: 'agent',
        provider: 'claude',
        prompt: 'Developer prompt',
        layout: { id: 'crewx_dev_layout', props: { title: 'Dev Mode' } },
      },
    });

    const rendered = await (tool as any).processAgentSystemPrompt(agent, templateContext);

    expect(rendered).toContain('<dev_prompt key="secure123">');
    expect(rendered).toContain('<header>Dev Mode</header>');
    expect(rendered).toContain('<prompt>Developer prompt</prompt>');
  });

  it('falls back to inline system prompt when layout loading fails for inline layout', async () => {
    const layoutLoader = createLayoutLoader({ throwFor: new Set(['crewx/missing']) });
    const { tool } = createCrewXTool({ layoutLoader });
    const agent = buildAgent({
      inline: {
        type: 'agent',
        provider: 'claude',
        system_prompt: '<broken>Inline fallback {{vars.security_key}}</broken>',
        layout: 'crewx/missing',
      },
    });

    const rendered = await (tool as any).processAgentSystemPrompt(agent, templateContext);

    expect(rendered).toContain('<broken>Inline fallback secure123</broken>');
    expect(rendered).not.toContain('<crewx_system_prompt');
  });

  it('falls back to description when layout loading fails and no inline prompt exists', async () => {
    const layoutLoader = createLayoutLoader({ throwFor: new Set(['crewx/default']) });
    const { tool } = createCrewXTool({ layoutLoader });
    const agent = buildAgent({
      inline: undefined,
      description: 'Use description {{vars.security_key}}',
    });

    const rendered = await (tool as any).processAgentSystemPrompt(agent, templateContext);

    expect(rendered).toBe('Use description secure123');
  });

  it('falls back to generic expert string when no prompt fields are present', async () => {
    const layoutLoader = createLayoutLoader({ throwFor: new Set(['crewx/default']) });
    const { tool } = createCrewXTool({ layoutLoader });
    const agent = buildAgent({ inline: undefined, description: undefined });

    const rendered = await (tool as any).processAgentSystemPrompt(agent, templateContext);

    expect(rendered).toBe('You are an expert crewx.');
  });
});
