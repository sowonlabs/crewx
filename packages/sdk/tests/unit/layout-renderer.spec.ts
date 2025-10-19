import { beforeEach, describe, expect, it } from 'vitest';
import { LayoutRenderer } from '../../src/services/layout-renderer.service';
import type { LayoutDefinition } from '../../src/types/layout.types';

const createLayout = (): LayoutDefinition => ({
  id: 'test-layout',
  version: '1.0.0',
  description: 'Layout for testing deep copy behaviour',
  template: '{{props.theme.colors.primary}}',
  propsSchema: {
    theme: { type: 'object' },
    features: { type: 'array' },
    segments: { type: 'array' },
  },
  defaultProps: {
    theme: {
      colors: {
        primary: 'blue',
        secondary: 'gray',
      },
    },
    features: ['history', 'timeline'],
    segments: [
      { id: 'system', enabled: true },
      { id: 'user', enabled: true },
    ],
  },
});

describe('LayoutRenderer.resolveProps deep copy behaviour', () => {
  let renderer: LayoutRenderer;

  beforeEach(() => {
    renderer = new LayoutRenderer();
  });

  it('returns independent default props per invocation', () => {
    const layout = createLayout();

    const first = renderer.resolveProps(layout, undefined);
    const second = renderer.resolveProps(layout, undefined);

    expect(first.props).not.toBe(second.props);
    expect(first.props.theme).not.toBe(second.props.theme);
    expect(first.props.features).not.toBe(second.props.features);

    first.props.theme.colors.primary = 'red';
    first.props.features.push('audit');

    expect(second.props.theme.colors.primary).toBe('blue');
    expect(second.props.features).toEqual(['history', 'timeline']);
  });

  it('does not mutate layout default props when merging overrides', () => {
    const layout = createLayout();

    const { props } = renderer.resolveProps(layout, {
      theme: { colors: { secondary: 'purple' } },
      features: ['history', 'audit'],
    });

    expect(props.theme.colors.secondary).toBe('purple');
    expect(layout.defaultProps.theme.colors.secondary).toBe('gray');

    props.features.push('timeline-extended');
    expect(layout.defaultProps.features).toEqual(['history', 'timeline']);
  });

  it('deep clones nested arrays and objects from defaults', () => {
    const layout = createLayout();

    const { props } = renderer.resolveProps(layout, undefined);

    expect(props.segments).not.toBe(layout.defaultProps.segments);
    expect(props.segments[0]).not.toBe(layout.defaultProps.segments[0]);

    props.segments[0].enabled = false;

    expect(layout.defaultProps.segments[0].enabled).toBe(true);
    expect(props.segments[0].enabled).toBe(false);
  });
});
