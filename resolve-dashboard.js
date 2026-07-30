const fs = require('fs');
const path = require('path');

const files = [
  'apps/dashboard/features/alerts/view/AlertsDashboard.tsx',
  'apps/dashboard/features/event-tracking/view/EventTrackingDashboard.tsx',
  'apps/dashboard/features/experiments/view/ExperimentsDashboard.tsx',
  'apps/dashboard/features/funnel/view/FunnelDashboard.tsx',
  'apps/dashboard/features/segments/view/SegmentsDashboard.tsx',
  'apps/dashboard/features/traffic/view/TrafficDashboard.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Conflict 1: Imports
  content = content.replace(
    /<<<<<<< HEAD\r?\n\s*import \{ useDashboardSegmentFilter \} from "@\/hooks\/use-dashboard-segment-filter"\r?\n=======\r?\n\s*import type \{ AnalyticsFetchMode \} from "@\/lib\/dashboard\/analytics-fetch-mode"\r?\n>>>>>>> [a-f0-9]+\r?\n/,
    'import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"\nimport type { AnalyticsFetchMode } from "@/lib/dashboard/analytics-fetch-mode"\n'
  );
  
  // Conflict 2: TrafficDashboard dependencies
  if (file.includes('TrafficDashboard.tsx')) {
    content = content.replace(
      /<<<<<<< HEAD\r?\n\s*\[projectId, customRange, utmFilter, segmentId, dashboardData\.formType\]\r?\n=======\r?\n\s*\[projectId, customRange, utmFilter\]\r?\n>>>>>>> [a-f0-9]+\r?\n/,
      '      [projectId, customRange, utmFilter, segmentId, dashboardData.formType]\n'
    );
  }

  fs.writeFileSync(file, content);
  console.log('Resolved', file);
}
