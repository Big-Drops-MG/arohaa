const fs = require('fs');

const files = [
  'analytics-traffic.service.ts',
  'analytics-events.service.ts',
  'analytics-funnel.service.ts',
  'analytics-heatmap.service.ts'
];

for (const f of files) {
  const p = 'apps/api/src/services/' + f;
  let c = fs.readFileSync(p, 'utf8');
  
  c = c.replace(
    /(export async function get[A-Za-z]+\([\s\S]*?\}: [A-Za-z]+)(?=\): Promise<)/g,
    '$1, segmentSql?: string, segmentParams?: Record<string, unknown>'
  );

  fs.writeFileSync(p, c);
}

// And fix analytics.service.ts getLandingPageCardMetrics
let an = fs.readFileSync('apps/api/src/services/analytics.service.ts', 'utf8');
an = an.replace(
  /(export async function getLandingPageCardMetrics\(\{[\s\S]*?\}\s*:\s*\{[\s\S]*?\}\s*)(?=\): Promise<)/,
  '$1, segmentSql?: string, segmentParams?: Record<string, unknown>'
);
fs.writeFileSync('apps/api/src/services/analytics.service.ts', an);
console.log('Fixed signatures');
