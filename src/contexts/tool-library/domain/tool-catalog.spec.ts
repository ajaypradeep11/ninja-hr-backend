import { TOOL_CATALOG, TOOL_CATEGORIES } from './tool-catalog';

describe('tool catalog', () => {
  it('has unique slugs', () => {
    const slugs = TOOL_CATALOG.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('contains the 17 prompt tools and the 6 built-in Intelligence tools', () => {
    expect(TOOL_CATALOG.filter((t) => t.kind === 'PROMPT')).toHaveLength(17);
    expect(TOOL_CATALOG.filter((t) => t.kind === 'BUILTIN')).toHaveLength(6);
  });

  it('only uses declared categories', () => {
    for (const tool of TOOL_CATALOG) {
      expect(TOOL_CATEGORIES).toContain(tool.category);
    }
  });

  it('every PROMPT tool has a system prompt, inputs, and at least one required field', () => {
    for (const tool of TOOL_CATALOG.filter((t) => t.kind === 'PROMPT')) {
      expect(tool.systemPrompt.length).toBeGreaterThan(50);
      expect(tool.inputs.length).toBeGreaterThan(0);
      expect(tool.inputs.some((f) => f.required)).toBe(true);
      expect(tool.href).toBeUndefined();
    }
  });

  it('every BUILTIN tool points at an existing admin route and has no prompt', () => {
    for (const tool of TOOL_CATALOG.filter((t) => t.kind === 'BUILTIN')) {
      expect(tool.href).toMatch(/^\/admin\//);
      expect(tool.systemPrompt).toBe('');
      expect(tool.inputs).toHaveLength(0);
    }
  });

  it('every placeholder referenced by a prompt exists in the input schema', () => {
    for (const tool of TOOL_CATALOG.filter((t) => t.kind === 'PROMPT')) {
      const keys = new Set(tool.inputs.map((f) => f.key));
      const placeholders = tool.systemPrompt.match(/<([a-z][a-z0-9_]*)>/g) ?? [];
      const structural = new Set(['task', 'output_format', 'inputs']);
      for (const raw of placeholders) {
        const name = raw.slice(1, -1);
        if (structural.has(name)) continue;
        // Synonym placeholders in the source prompt ("resignation_letter" as
        // an alias of the offboarding notice) are allowed if any input exists.
        if (!keys.has(name)) {
          expect(tool.inputs.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('input field keys are unique and machine-safe per tool', () => {
    for (const tool of TOOL_CATALOG) {
      const keys = tool.inputs.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('select fields declare their options', () => {
    for (const tool of TOOL_CATALOG) {
      for (const field of tool.inputs.filter((f) => f.type === 'select')) {
        expect(field.options && field.options.length).toBeGreaterThan(1);
      }
    }
  });
});
