'use client';

import BehavioursDashboard from '@/components/behavioursDashboard/BehavioursDashboard';

export default function Berkshire() {
  return (
    <BehavioursDashboard
      name="berkshire"
      firebaseId="berkshire"
      title="Berkshire Care Behaviours Dashboard"
      goal={15}
    />
  );
}

