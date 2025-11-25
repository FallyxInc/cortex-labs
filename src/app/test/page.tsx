'use client';

import BehavioursDashboard from '@/components/behavioursDashboard/BehavioursDashboard';

export default function Berkshire() {
  return (
    <BehavioursDashboard
      name="test"
      firebaseId="test"
      title="Test Behaviours Dashboard"
      goal={15}
    />
  );
}

