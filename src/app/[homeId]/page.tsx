"use client";

import { use, useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "@/lib/firebase/firebase";
import { UserDashboard } from "@/components/dashboard";
import {
  getDisplayName,
  HOME_MAPPINGS,
  type HomeMapping,
} from "@/lib/homeMappings";

interface PageProps {
  params: Promise<{ homeId: string }>;
}

export default function HomePage({ params }: PageProps) {
  const { homeId } = use(params);
  const [displayName, setDisplayName] = useState<string>(
    getDisplayName(homeId),
  );

  useEffect(() => {
    const loadFirebaseMappings = async () => {
      try {
        const mappingsRef = ref(db, "/homeMappings");
        const snapshot = await get(mappingsRef);

        if (snapshot.exists()) {
          const firebaseMappings = snapshot.val() as Record<
            string,
            HomeMapping
          >;
          const allMappings = { ...HOME_MAPPINGS, ...firebaseMappings };

          const mapping = allMappings[homeId];
          if (mapping) {
            setDisplayName(mapping.displayName || homeId);
          }
        }
      } catch (error) {
        console.warn(
          "Failed to load Firebase mappings, using fallback:",
          error,
        );
      }
    };

    loadFirebaseMappings();
  }, [homeId]);

  const title =
    displayName && displayName !== homeId
      ? `${displayName} Behaviours Dashboard`
      : `${homeId.charAt(0).toUpperCase() + homeId.slice(1).replace(/_/g, " ")} Behaviours Dashboard`;

  const goal = 15;

  return (
    <UserDashboard
      name={displayName}
      firebaseId={homeId}
      title={title}
      goal={goal}
    />
  );
}
