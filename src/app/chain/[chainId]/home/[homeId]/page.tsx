"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { db, auth } from "@/lib/firebase/firebase";
import { Dashboard } from "@/components/dashboard";
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

          // Get the actual Firebase ID for the home (handles special characters and mappings)
          const firebaseId = getFirebaseId(homeId);

          // Get all possible home identifiers from mappings
          const possibleIds = [homeId, firebaseId];

          // Add any other mappings that point to the same firebaseId
          Object.entries(HOME_MAPPINGS).forEach(([key, mapping]) => {
            if (
              mapping.firebaseId === firebaseId &&
              !possibleIds.includes(key)
            ) {
              possibleIds.push(key);
            }
          });

          // Verify home belongs to this chain - try all possible IDs
          let homeData = null;
          let foundHomeId = null;

          for (const testId of possibleIds) {
            const homeSnapshot = await get(ref(db, `/${testId}`));
            if (homeSnapshot.exists()) {
              homeData = homeSnapshot.val();
              foundHomeId = testId;
              break;
            }
          }

          if (homeData) {
            // Verify the home belongs to this chain
            if (homeData.chainId === chainId) {
              setHomeBelongsToChain(true);
            } else {
              router.push("/unauthorized");
              return;
            }
          } else {
            // Last attempt: check if home is in chain's homes list
            const chainRef = ref(db, `chains/${chainId}`);
            const chainSnapshot = await get(chainRef);
            if (chainSnapshot.exists()) {
              const chainData = chainSnapshot.val();
              const homes = chainData.homes || [];
              // Check if any of the possible IDs is in the chain's homes list
              const homeInChain = possibleIds.some((id) => homes.includes(id));
              if (homeInChain) {
                setHomeBelongsToChain(true);
              } else {
                console.error(
                  `Home not found: ${homeId} (tried: ${possibleIds.join(", ")})`,
                );
                router.push("/unauthorized");
                return;
              }
            } else {
              router.push("/unauthorized");
              return;
            }
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

  const handleBackToChain = () => {
    router.push(`/chain/${chainId}`);
  };

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

  // Get Firebase ID for the dashboard component (use decoded homeId)
  // Start with fallback, then load from Firebase to ensure consistency with API
  const [firebaseId, setFirebaseId] = useState<string>(getFirebaseId(homeId));
  const [displayName, setDisplayName] = useState<string>(
    getDisplayName(homeId),
  );

  // Load Firebase mappings on client side to get correct firebaseId
  // This ensures we use the same firebaseId that the API uses when saving metrics
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

          // Find the mapping for this homeId
          const mapping = allMappings[homeId];
          if (mapping) {
            setFirebaseId(mapping.firebaseId);
            setDisplayName(mapping.displayName || homeId);
          }
        }
      } catch (error) {
        console.warn(
          "Failed to load Firebase mappings, using fallback:",
          error,
        );
        // Keep the fallback values from getFirebaseId/getDisplayName
      }
    };

    loadFirebaseMappings();
  }, [homeId]);

  // Format title
  const title =
    displayName && displayName !== homeId
      ? `${displayName} Behaviours Dashboard`
      : `${homeId.charAt(0).toUpperCase() + homeId.slice(1).replace(/_/g, " ")} Behaviours Dashboard`;

  // Default goal value
  const goal = 15;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back to Chain Overview Link */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <button
            onClick={handleBackToChain}
            className="text-cyan-600 hover:text-cyan-700 font-medium text-base flex items-center gap-1.5"
          >
            <span className="text-lg">←</span>
            <span>Back to Chain Overview</span>
          </button>
        </div>
      </div>

      {/* Home Dashboard */}
      <Dashboard
        name={displayName}
        firebaseId={firebaseId}
        title={title}
        goal={goal}
      />
    </div>
  );
}
