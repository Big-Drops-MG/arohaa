const fs = require('fs');
const path = require('path');

const features = ['alerts', 'event-tracking', 'experiments', 'funnel', 'heatmap', 'segments', 'seo'];
const dashboardPath = 'd:\\Big Drops\\arohaa\\apps\\dashboard\\features';

features.forEach(feature => {
  let featureUpper = feature.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  if (feature === 'seo') featureUpper = 'Seo';
  const filePath = path.join(dashboardPath, feature, 'view', `${featureUpper}Dashboard.tsx`);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add import
    if (!content.includes('useDashboardSegmentFilter')) {
      content = content.replace(
        /import { useDashboardUtmFilter } from "@\/hooks\/use-dashboard-utm-filter"/,
        `import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"\nimport { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"`
      );
    }
    
    // Add segmentId hook
    if (!content.includes('const { segmentId } = useDashboardSegmentFilter()')) {
      content = content.replace(
        /const { utmFilter } = useDashboardUtmFilter\(\)/,
        `const { utmFilter } = useDashboardUtmFilter()\n  const { segmentId } = useDashboardSegmentFilter()`
      );
    }
    
    // Add segmentId to buildAnalyticsApiPath
    content = content.replace(
      /\{ rangeId:?.*?, customRange, utmFilter \}/g,
      (match) => match.replace('utmFilter', 'utmFilter, segmentId')
    );
    
    // Add segmentId to shouldUseInitialTabData
    content = content.replace(
      /shouldUseInitialTabData\([\s\S]*?utmFilter,[\s\S]*?customRange[\s\S]*?\)/g,
      (match) => {
        if (!match.includes('segmentId')) {
          return match.replace(/customRange[\s\S]*?\)/, 'customRange,\n        undefined,\n        segmentId\n      )');
        }
        return match;
      }
    );

    // Add segmentId to dependencies
    content = content.replace(
      /\[(.*?)utmFilter(.*?)(fetch.*?)?\]/g,
      (match, p1, p2, p3) => {
        if (!match.includes('segmentId')) {
           return match.replace('utmFilter', 'utmFilter, segmentId');
        }
        return match;
      }
    );

    fs.writeFileSync(filePath, content);
    console.log(`Updated ${featureUpper}Dashboard.tsx`);
  } else {
    console.log(`Not found: ${filePath}`);
  }
});

// Also update OverviewUsaMap.tsx
const mapPath = path.join(dashboardPath, 'overview', 'view', 'OverviewUsaMap.tsx');
if (fs.existsSync(mapPath)) {
  let content = fs.readFileSync(mapPath, 'utf8');
  if (!content.includes('useDashboardSegmentFilter')) {
      content = content.replace(
        /import { useDashboardUtmFilter } from "@\/hooks\/use-dashboard-utm-filter"/,
        `import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"\nimport { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"`
      );
  }
  if (!content.includes('const { segmentId } = useDashboardSegmentFilter()')) {
      content = content.replace(
        /const { utmFilter } = useDashboardUtmFilter\(\)/,
        `const { utmFilter } = useDashboardUtmFilter()\n  const { segmentId } = useDashboardSegmentFilter()`
      );
  }
  content = content.replace(
      /\{ rangeId:?.*?, customRange, utmFilter \}/g,
      (match) => match.replace('utmFilter', 'utmFilter, segmentId')
  );
  content = content.replace(
      /\[(.*?)utmFilter(.*?)(fetch.*?)?\]/g,
      (match, p1, p2, p3) => {
        if (!match.includes('segmentId')) {
           return match.replace('utmFilter', 'utmFilter, segmentId');
        }
        return match;
      }
  );
  fs.writeFileSync(mapPath, content);
  console.log('Updated OverviewUsaMap.tsx');
}
