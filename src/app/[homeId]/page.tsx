'use client';

import { use } from 'react';
import BehavioursDashboard from '@/components/behavioursDashboard/BehavioursDashboard';
import { getDisplayName, getFirebaseId } from '@/lib/homeMappings';

interface PageProps {
  params: Promise<{ homeId: string }>;
}

export default function HomePage({ params }: PageProps) {
  const { homeId } = use(params);
  
  // Get Firebase ID for the dashboard component (it uses this to look up data in Firebase)
  // The component has special mappings for MCB -> millCreek, ONCB -> oneill, etc.
  // For new homes, we need to use the firebaseId so it can find the data
  const firebaseId = getFirebaseId(homeId);
  
  // Get display name for the title
  const displayName = getDisplayName(homeId);
  
  // Format title - use display name if available, otherwise format the homeId
  const title = displayName && displayName !== homeId
    ? `${displayName} Behaviours Dashboard`
    : `${homeId.charAt(0).toUpperCase() + homeId.slice(1).replace(/_/g, ' ')} Behaviours Dashboard`;
  
  // Default goal value (can be made configurable per home later)
  const goal = 15;

  // The BehavioursDashboard component uses the 'name' prop to construct Firebase paths
  // It has hardcoded mappings for MCB -> millCreek, ONCB -> oneill
  // For other homes, it uses the name as-is to look up in Firebase
  // So we need to pass the firebaseId (or the mapped name) so it can find the data
  // However, the component's altName logic will handle MCB/ONCB, so for those we keep the original
  // For new homes like mill_creek_care, we should use the firebaseId
  const dashboardName = (homeId === 'MCB' || homeId === 'ONCB') ? homeId : firebaseId;

  return (
    <BehavioursDashboard
      name={dashboardName}
      title={title}
      goal={goal}
    />
  );
}

