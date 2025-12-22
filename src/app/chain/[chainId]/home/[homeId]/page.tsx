"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { db, auth } from "@/lib/firebase/firebase";
import { UserDashboard } from "@/components/dashboard";
import {
  getDisplayName,
  getFirebaseId,
  HOME_MAPPINGS,
  type HomeMapping,
} from "@/lib/homeMappings";

interface PageProps {
  params: Promise<{ chainId: string; homeId: string }>;
}

export default function ChainAdminHomePage({ params }: PageProps) {
  const { chainId, homeId: rawHomeId } = use(params);
  // Decode the homeId to handle special characters like apostrophes
  const homeId = decodeURIComponent(rawHomeId);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userChainId, setUserChainId] = useState<string | null>(null);
  const [homeBelongsToChain, setHomeBelongsToChain] = useState(false);
  const [displayName, setDisplayName] = useState<string>(getDisplayName(homeId));

  // Auth check effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const userSnapshot = await get(ref(db, `users/${user.uid}`));

        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          const role = userData.role;

          if (role !== "chainAdmin") {
            router.push("/unauthorized");
            return;
          }

          // Verify user has access to this chain
          if (userData.chainId !== chainId) {
            router.push("/unauthorized");
            return;
          }

          // Verify home belongs to this chain - try all possible IDs
          let homeData = null;
          const homeSnapshot = await get(ref(db, `/${homeId}`));
          if (homeSnapshot.exists()) {
            homeData = homeSnapshot.val();
          } else {
            router.push("/unauthorized");
            return;
          }

          if (homeData?.chainId === chainId) {
            setHomeBelongsToChain(true);
          } else {
            router.push("/unauthorized");
            return;
          }

          setUserRole(role);
          setUserChainId(userData.chainId);
        } else {
          router.push("/login");
          return;
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        router.push("/login");
        return;
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, chainId, homeId]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div
          className="animate-spin rounded-full h-32 w-32 border-b-2"
          style={{ borderColor: "#06b6d4" }}
        ></div>
      </div>
    );
  }

  if (
    !userRole ||
    userRole !== "chainAdmin" ||
    userChainId !== chainId ||
    !homeBelongsToChain
  ) {
    return null;
  }

  return (
    <UserDashboard
      name={displayName}
      firebaseId={homeId}
      title={displayName}
      goal={0}
      chainId={chainId}
    />
  );
}
