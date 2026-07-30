const fs = require('fs');
const path = require('path');

const analyticsFile = 'd:\\Big Drops\\arohaa\\apps\\api\\src\\routes\\analytics.ts';
let content = fs.readFileSync(analyticsFile, 'utf8');

// 1. Add imports
if (!content.includes('getSegmentById')) {
  content = content.replace(
    /import \{ parseAnalyticsUtmFilter \} from '\.\.\/lib\/analytics-utm-filter\.js'/,
    `import { parseAnalyticsUtmFilter } from '../lib/analytics-utm-filter.js'\nimport { getSegmentById } from '@workspace/database'\nimport { SegmentCompiler } from '../services/segment-compiler.service.js'`
  );
}

// 2. Add resolveSegmentFilter function
if (!content.includes('resolveSegmentFilter')) {
  const resolveFunc = `
async function resolveSegmentFilter(segmentId?: string, workspaceId?: string) {
  if (!segmentId || !workspaceId) return undefined;
  const segment = await getSegmentById(segmentId);
  if (!segment || segment.workspaceId !== workspaceId || !segment.conditions) return undefined;
  return new SegmentCompiler().compile(segment.conditions as any);
}
`;
  content = content.replace(
    /export async function analyticsRoutes/,
    resolveFunc + '\nexport async function analyticsRoutes'
  );
}

// 3. Add segment_id to Querystring types
content = content.replace(
  /utm_value\?: string/g,
  'utm_value?: string\n      segment_id?: string'
);

// 4. Add segment_id to schema properties
content = content.replace(
  /\.\.\.utmFilterSchemaProps,/g,
  '...utmFilterSchemaProps,\n            segment_id: { type: \'string\', format: \'uuid\' },'
);
content = content.replace(
  /\.\.\.utmFilterSchemaProps,\n    },/g,
  '...utmFilterSchemaProps,\n      segment_id: { type: \'string\', format: \'uuid\' },\n    },'
);

// 5. In route handlers: resolve segmentFilter and merge into utmFilter
content = content.replace(
  /const utmFilter = parseAnalyticsUtmFilter\(request\.query\)/g,
  `const parsedUtm = parseAnalyticsUtmFilter(request.query)
      const segmentFilter = await resolveSegmentFilter(request.query.segment_id, request.query.workspace_id)
      const utmFilter = parsedUtm || {}
      if (segmentFilter) {
        utmFilter.segmentSql = segmentFilter.sql
        utmFilter.segmentParams = segmentFilter.params
      }`
);

fs.writeFileSync(analyticsFile, content);
console.log('Updated analytics.ts');
