'use client';

import { use } from 'react';
import BehavioursDashboard from '@/components/behavioursDashboard/BehavioursDashboard';
import { getDisplayName, getFirebaseId, getPythonDirName } from '@/lib/homeMappings';

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

  return (
    <BehavioursDashboard
      name={displayName}
      firebaseId={firebaseId}
      title={title}
      goal={goal}
    />
  );
}

