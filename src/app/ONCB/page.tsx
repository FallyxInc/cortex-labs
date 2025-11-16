'use client';

import BehavioursDashboard from '@/components/behavioursDashboard/BehavioursDashboard';

export default function ONCB() {
  return (
    <BehavioursDashboard
      name="ONCB"
      title="The O'Neill Centre Behaviours Dashboard"
      goal={15}
    />
  );
}

