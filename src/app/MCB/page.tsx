'use client';

import BehavioursDashboard from '@/components/behavioursDashboard/BehavioursDashboard';

export default function MCB() {
  return (
    <BehavioursDashboard
      name="MCB"
      firebaseId="millCreek"
      title="Mill Creek Behaviours Dashboard"
      goal={30}
    />
  );
}

