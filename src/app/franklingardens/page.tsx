"use client";

import BehavioursDashboard from "@/components/behavioursDashboard/BehavioursDashboard";

export default function FranklinGardens() {
  return (
    <BehavioursDashboard
      name="franklingardens"
      firebaseId="franklingardens"
      title="Franklin Gardens Behaviours Dashboard"
      goal={15}
    />
  );
}
