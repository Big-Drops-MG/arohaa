import { describe, it, expect } from 'vitest';
import { SegmentCompiler, SegmentGroup } from './segment-compiler.service.js';

describe('SegmentCompiler', () => {
  it('should compile an empty group to 1=1', () => {
    const compiler = new SegmentCompiler();
    const result = compiler.compile({ operator: 'and', rules: [] });
    expect(result.sql).toBe('1=1');
    expect(result.params).toEqual({});
  });

  it('should compile a simple equals rule', () => {
    const compiler = new SegmentCompiler();
    const group: SegmentGroup = {
      operator: 'and',
      rules: [{ column: 'city', operator: 'equals', value: 'New York' }],
    };
    const result = compiler.compile(group);
    expect(result.sql).toBe('(city = {seg_p_0: String})');
    expect(result.params).toEqual({ seg_p_0: 'New York' });
  });

  it('should compile multiple rules with AND', () => {
    const compiler = new SegmentCompiler();
    const group: SegmentGroup = {
      operator: 'and',
      rules: [
        { column: 'city', operator: 'equals', value: 'New York' },
        { column: 'device', operator: 'in', value: ['desktop', 'mobile'] },
      ],
    };
    const result = compiler.compile(group);
    expect(result.sql).toBe('(city = {seg_p_0: String} AND device_type IN {seg_p_1: Array(String)})');
    expect(result.params).toEqual({
      seg_p_0: 'New York',
      seg_p_1: ['desktop', 'mobile'],
    });
  });

  it('should compile nested groups', () => {
    const compiler = new SegmentCompiler();
    const group: SegmentGroup = {
      operator: 'or',
      rules: [
        { column: 'country', operator: 'equals', value: 'US' },
        {
          operator: 'and',
          rules: [
            { column: 'city', operator: 'contains', value: 'Lon' },
            { column: 'browser', operator: 'not_equals', value: 'Chrome' },
          ],
        },
      ],
    };
    const result = compiler.compile(group);
    expect(result.sql).toBe('(country = {seg_p_0: String} OR (city ILIKE {seg_p_1: String} AND browser != {seg_p_2: String}))');
    expect(result.params).toEqual({
      seg_p_0: 'US',
      seg_p_1: '%Lon%',
      seg_p_2: 'Chrome',
    });
  });

  it('should throw on unsupported columns', () => {
    const compiler = new SegmentCompiler();
    const group: SegmentGroup = {
      operator: 'and',
      rules: [{ column: 'unsupported_col', operator: 'equals', value: 'test' }],
    };
    expect(() => compiler.compile(group)).toThrowError(/Unsupported segment column: unsupported_col/);
  });
});
