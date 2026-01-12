"use client";

import { use, useEffect, useState } from "react";
import UserDashboard from "@/components/dashboard/UserDashboard";
import {
  getHomeName,
} from "@/lib/homeMappings";

interface PageProps {
  params: Promise<{ homeId: string }>;
}

export default function HomePage({ params }: PageProps) {
  const { homeId } = use(params);
  const [displayName, setDisplayName] = useState<string>(homeId);

  useEffect(() => {
    getHomeName(homeId).then((name) => {
      setDisplayName(name);
    });
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
