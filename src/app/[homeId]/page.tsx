'use client';

import { use, useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase/firebase';
import BehavioursDashboard from '@/components/dashboard/BehavioursDashboard';
import { getDisplayName, getFirebaseId, HOME_MAPPINGS, type HomeMapping } from '@/lib/homeMappings';

interface PageProps {
  params: Promise<{ homeId: string }>;
}

export default function HomePage({ params }: PageProps) {
  const { homeId } = use(params);
  const [firebaseId, setFirebaseId] = useState<string>(getFirebaseId(homeId));
  const [displayName, setDisplayName] = useState<string>(getDisplayName(homeId));
  
  // Load Firebase mappings on client side to get correct firebaseId
  // This ensures we use the same firebaseId that the API uses when saving metrics
  useEffect(() => {
    const loadFirebaseMappings = async () => {
      try {
        const mappingsRef = ref(db, '/homeMappings');
        const snapshot = await get(mappingsRef);
        
        if (snapshot.exists()) {
          const firebaseMappings = snapshot.val() as Record<string, HomeMapping>;
          const allMappings = { ...HOME_MAPPINGS, ...firebaseMappings };
          
          // Find the mapping for this homeId
          const mapping = allMappings[homeId];
          if (mapping) {
            setFirebaseId(mapping.firebaseId);
            setDisplayName(mapping.displayName || homeId);
          }
        }
      } catch (error) {
        console.warn('Failed to load Firebase mappings, using fallback:', error);
        // Keep the fallback values from getFirebaseId/getDisplayName
      }
    };
    
    loadFirebaseMappings();
  }, [homeId]);
  
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

