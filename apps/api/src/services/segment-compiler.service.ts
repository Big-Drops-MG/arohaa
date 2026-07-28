export const COLUMN_MAP: Record<string, string> = {
  source: 'utm_source',
  medium: 'utm_medium',
  campaign: 'utm_campaign',
  city: 'city',
  country: 'country',
  device: 'device_type',
  browser: 'browser',
  os: 'os',
  event: 'event_name',
  path: 'page_url',
};

export type SegmentOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than';

export type SegmentRule = {
  column: string;
  operator: SegmentOperator;
  value: string | number | (string | number)[];
};

export type SegmentGroup = {
  operator: 'and' | 'or';
  rules: (SegmentRule | SegmentGroup)[];
};

export type CompiledSegment = {
  sql: string;
  params: Record<string, unknown>;
};

export class SegmentCompiler {
  private paramCounter = 0;
  private params: Record<string, unknown> = {};

  public compile(group: SegmentGroup | null): CompiledSegment {
    this.paramCounter = 0;
    this.params = {};

    if (!group || !group.rules || group.rules.length === 0) {
      return { sql: '1=1', params: {} };
    }

    const sql = this.compileGroup(group);
    return { sql, params: this.params };
  }

  private compileGroup(group: SegmentGroup): string {
    if (!group.rules || group.rules.length === 0) {
      return '1=1';
    }

    const compiledRules = group.rules.map((rule) => {
      if ('operator' in rule && rule.operator && ('and' === rule.operator || 'or' === rule.operator)) {
        return this.compileGroup(rule as SegmentGroup);
      }
      return this.compileRule(rule as SegmentRule);
    });

    const joinOperator = group.operator === 'or' ? ' OR ' : ' AND ';
    return `(${compiledRules.join(joinOperator)})`;
  }

  private compileRule(rule: SegmentRule): string {
    const chColumn = COLUMN_MAP[rule.column];
    if (!chColumn) {
      throw new Error(`Unsupported segment column: ${rule.column}`);
    }

    const paramName = `seg_p_${this.paramCounter++}`;
    this.params[paramName] = rule.value;

    switch (rule.operator) {
      case 'equals':
        return `${chColumn} = {${paramName}: ${this.getParamType(rule.value)}}`;
      case 'not_equals':
        return `${chColumn} != {${paramName}: ${this.getParamType(rule.value)}}`;
      case 'contains':
        this.params[paramName] = `%${rule.value}%`;
        return `${chColumn} ILIKE {${paramName}: String}`;
      case 'not_contains':
        this.params[paramName] = `%${rule.value}%`;
        return `${chColumn} NOT ILIKE {${paramName}: String}`;
      case 'in':
        if (!Array.isArray(rule.value)) {
          throw new Error(`Operator 'in' requires an array value`);
        }
        return `${chColumn} IN {${paramName}: Array(${this.getParamArrayType(rule.value)})}`;
      case 'not_in':
        if (!Array.isArray(rule.value)) {
          throw new Error(`Operator 'not_in' requires an array value`);
        }
        return `${chColumn} NOT IN {${paramName}: Array(${this.getParamArrayType(rule.value)})}`;
      case 'greater_than':
        return `${chColumn} > {${paramName}: ${this.getParamType(rule.value)}}`;
      case 'less_than':
        return `${chColumn} < {${paramName}: ${this.getParamType(rule.value)}}`;
      default:
        throw new Error(`Unsupported segment operator: ${rule.operator}`);
    }
  }

  private getParamType(value: unknown): string {
    if (typeof value === 'number') {
      return 'Float64';
    }
    return 'String';
  }

  private getParamArrayType(value: unknown[]): string {
    if (value.length > 0 && typeof value[0] === 'number') {
      return 'Float64';
    }
    return 'String';
  }
}
