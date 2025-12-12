import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { getDisplayName } from '@/lib/homeMappings';

interface HomeMetrics {
  homeId: string;
  homeName: string;
  chainId: string;
  totalIncidents: number;
  incidentRate: number; // per resident or per day
  followUpCompletionRate: number; // percentage
  criticalBehaviours: number; // aggressive behaviours
  behaviourTypes: Record<string, number>;
  monthlyLogins: number;
  lastUpdated: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chainId: string }> }
) {
  try {
    const { chainId } = await params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!chainId) {
      return NextResponse.json(
        { error: 'Chain ID is required' },
        { status: 400 }
      );
    }

    // Verify chain exists
    const chainRef = adminDb.ref(`/chains/${chainId}`);
    const chainSnapshot = await chainRef.once('value');
    
    if (!chainSnapshot.exists()) {
      return NextResponse.json(
        { error: 'Chain not found' },
        { status: 404 }
      );
    }

    const chainData = chainSnapshot.val();
    const homeIds = chainData.homes || [];

    // Fetch all homes data
    const homesMetrics: HomeMetrics[] = [];

    for (const homeId of homeIds) {
      try {
        const homeRef = adminDb.ref(`/${homeId}`);
        const homeSnapshot = await homeRef.once('value');
        
        if (!homeSnapshot.exists()) {
          continue;
        }

        const homeData = homeSnapshot.val();
        const behaviours = homeData.behaviours || {};
        
        // Get all behavior entries
        let allBehaviours: any[] = [];
        for (const key in behaviours) {
          if (key === 'createdAt' || key === 'updatedAt') continue;
          const behaviourData = behaviours[key];
          if (Array.isArray(behaviourData)) {
            allBehaviours = allBehaviours.concat(behaviourData);
          } else if (behaviourData && typeof behaviourData === 'object') {
            // Handle nested structure
            for (const subKey in behaviourData) {
              if (Array.isArray(behaviourData[subKey])) {
                allBehaviours = allBehaviours.concat(behaviourData[subKey]);
              }
            }
          }
        }

        // Filter by date range if provided
        if (startDate && endDate) {
          allBehaviours = allBehaviours.filter((behaviour: any) => {
            if (!behaviour.date) return false;
            const behaviourDate = new Date(behaviour.date);
            const start = new Date(startDate);
            const end = new Date(endDate);
            return behaviourDate >= start && behaviourDate <= end;
          });
        }

        // Calculate metrics
        const totalIncidents = allBehaviours.length;
        
        // Calculate behaviour types
        const behaviourTypes: Record<string, number> = {};
        let criticalBehaviours = 0;
        let followUpsCompleted = 0;
        let totalFollowUps = 0;

        allBehaviours.forEach((behaviour: any) => {
          // Count by incident type
          const incidentType = behaviour.incident_type || 'Unknown';
          behaviourTypes[incidentType] = (behaviourTypes[incidentType] || 0) + 1;

          // Count critical behaviours (aggressive, physical, etc.)
          const type = (incidentType || '').toLowerCase();
          if (type.includes('aggressive') || type.includes('physical') || type.includes('violent')) {
            criticalBehaviours++;
          }

          // Count follow-ups
          if (behaviour.follow_up_date || behaviour.follow_up_notes) {
            totalFollowUps++;
            if (behaviour.follow_up_completed === 'yes' || behaviour.follow_up_date) {
              followUpsCompleted++;
            }
          }
        });

        // Calculate follow-up completion rate
        const followUpCompletionRate = totalFollowUps > 0 
          ? Math.round((followUpsCompleted / totalFollowUps) * 100) 
          : 0;

        // Calculate incident rate (simplified - could be per resident or per day)
        // For now, using total incidents as rate (can be enhanced later)
        const incidentRate = totalIncidents;

        // Get monthly logins (placeholder - would need to track this separately)
        const monthlyLogins = 0; // TODO: Implement login tracking per home

        // Get last updated
        const lastUpdated = homeData.updatedAt || homeData.behaviours?.updatedAt || homeData.createdAt || '';

        const displayName = getDisplayName(homeId) || homeId;

        homesMetrics.push({
          homeId,
          homeName: displayName,
          chainId,
          totalIncidents,
          incidentRate,
          followUpCompletionRate,
          criticalBehaviours,
          behaviourTypes,
          monthlyLogins,
          lastUpdated,
        });
      } catch (error) {
        console.error(`Error processing home ${homeId}:`, error);
        // Continue with other homes
      }
    }

    return NextResponse.json({
      success: true,
      chainId,
      chainName: chainData.name || chainId,
      homes: homesMetrics.sort((a, b) => a.homeName.localeCompare(b.homeName)),
    });

  } catch (error) {
    console.error('Error fetching chain homes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chain homes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

