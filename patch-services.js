const fs = require('fs');
const path = require('path');

const servicesDir = 'd:\\Big Drops\\arohaa\\apps\\api\\src\\services';
const serviceFiles = [
  'analytics.service.ts',
  'analytics-traffic.service.ts',
  'analytics-events.service.ts',
  'analytics-funnel.service.ts',
  'analytics-heatmap.service.ts',
  'analytics-seo.service.ts'
];

serviceFiles.forEach(file => {
  const filePath = path.join(servicesDir, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Inject segmentSql and segmentParams to all export function getAnalytics...
  content = content.replace(
    /(export async function get[A-Za-z]+\([\s\S]*?utmFilter\?: AnalyticsUtmFilter,[\s\S]*?\)): Promise</g,
    (match, p1) => {
      if (!p1.includes('segmentSql')) {
        return p1.replace(/\),?$/g, ',\n  segmentSql?: string,\n  segmentParams?: Record<string, unknown>,\n)') + ': Promise<';
      }
      return match;
    }
  );

  // Pass segmentSql to rangeFilter, previousRangeFilter, rangeLookbackFilter
  content = content.replace(
    /rangeFilter\(utmFilter\)/g,
    'rangeFilter(utmFilter, segmentSql)'
  );
  content = content.replace(
    /previousRangeFilter\(utmFilter\)/g,
    'previousRangeFilter(utmFilter, segmentSql)'
  );
  content = content.replace(
    /rangeLookbackFilter\(utmFilter\)/g,
    'rangeLookbackFilter(utmFilter, segmentSql)'
  );

  // Merge segmentParams into p
  content = content.replace(
    /\.\.\.utmFilterParams\(utmFilter\),/g,
    '...utmFilterParams(utmFilter),\n    ...(segmentParams || {}),'
  );

  // Merge segmentSql into cache keys
  content = content.replace(
    /utmFilterCacheKey\(utmFilter\)\)/g,
    'utmFilterCacheKey(utmFilter), segmentSql)'
  );

  fs.writeFileSync(filePath, content);
  console.log('Patched', file);
});

const rangeFile = 'd:\\Big Drops\\arohaa\\apps\\api\\src\\lib\\analytics-range.ts';
let rangeContent = fs.readFileSync(rangeFile, 'utf8');

if (!rangeContent.includes('segmentSql?: string')) {
  rangeContent = rangeContent.replace(
    /export function rangeFilter\(utmFilter\?: AnalyticsUtmFilter\): string \{/g,
    'export function rangeFilter(utmFilter?: AnalyticsUtmFilter, segmentSql?: string): string {'
  );
  rangeContent = rangeContent.replace(
    /return `workspace_id = \{wid:UUID\} AND created_at >= toDateTime64\(\{range_from:String\}, 3, 'UTC'\) AND created_at < toDateTime64\(\{range_to:String\}, 3, 'UTC'\)\$\{utmFilterSql\(utmFilter\)\}`/,
    'return `workspace_id = {wid:UUID} AND created_at >= toDateTime64({range_from:String}, 3, \'UTC\') AND created_at < toDateTime64({range_to:String}, 3, \'UTC\')${utmFilterSql(utmFilter)}${segmentSql ? ` AND ${segmentSql}` : \'\'}`'
  );

  rangeContent = rangeContent.replace(
    /export function rangeLookbackFilter\(utmFilter\?: AnalyticsUtmFilter\): string \{/,
    'export function rangeLookbackFilter(utmFilter?: AnalyticsUtmFilter, segmentSql?: string): string {'
  );
  rangeContent = rangeContent.replace(
    /return rangeFilter\(utmFilter\)/g,
    'return rangeFilter(utmFilter, segmentSql)'
  );

  rangeContent = rangeContent.replace(
    /export function previousRangeFilter\(utmFilter\?: AnalyticsUtmFilter\): string \{/,
    'export function previousRangeFilter(utmFilter?: AnalyticsUtmFilter, segmentSql?: string): string {'
  );
  rangeContent = rangeContent.replace(
    /return `workspace_id = \{wid:UUID\} AND created_at >= toDateTime64\(\{prev_from:String\}, 3, 'UTC'\) AND created_at < toDateTime64\(\{prev_to:String\}, 3, 'UTC'\)\$\{utmFilterSql\(utmFilter\)\}`/,
    'return `workspace_id = {wid:UUID} AND created_at >= toDateTime64({prev_from:String}, 3, \'UTC\') AND created_at < toDateTime64({prev_to:String}, 3, \'UTC\')${utmFilterSql(utmFilter)}${segmentSql ? ` AND ${segmentSql}` : \'\'}`'
  );

  rangeContent = rangeContent.replace(
    /export function rangeCacheKey\(\s*window: AnalyticsWindow,\s*utmKey = 'all',\s*\): string \{/,
    'export function rangeCacheKey(\n  window: AnalyticsWindow,\n  utmKey = \'all\',\n  segmentSql?: string,\n): string {'
  );
  rangeContent = rangeContent.replace(
    /return `custom:\$\{window\.custom\.from\}:\$\{window\.custom\.to\}:\$\{utmKey\}`/,
    'return `custom:${window.custom.from}:${window.custom.to}:${utmKey}${segmentSql ? `:${segmentSql}` : \'\'}`'
  );
  rangeContent = rangeContent.replace(
    /return `\$\{window\.rangeId\}:\$\{formatClickHouseDateTime\(window\.start\)\}:\$\{formatClickHouseDateTime\(window\.end\)\}:\$\{utmKey\}`/,
    'return `${window.rangeId}:${formatClickHouseDateTime(window.start)}:${formatClickHouseDateTime(window.end)}:${utmKey}${segmentSql ? `:${segmentSql}` : \'\'}`'
  );

  fs.writeFileSync(rangeFile, rangeContent);
  console.log('Patched analytics-range.ts');
}
