'use client';

import BehavioursDashboard from '@/components/behavioursDashboard/BehavioursDashboard';

export default function Banwell() {
  return (
    <BehavioursDashboard
      name="banwell"
      firebaseId="banwell"
      title="Banwell Gardens Behaviours Dashboard"
      goal={15}
    />
  );
}

