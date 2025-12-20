import { NextRequest, NextResponse } from 'next/server';
import { getLegacyHydrationData } from './hydration-legacy';

export async function GET(request: NextRequest) {
    
    // Get the home id and date range from the request
    // const homeId = request.nextUrl.searchParams.get('homeId');
    const retirementHome = request.nextUrl.searchParams.get('retirementHome');
    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');
    if (!startDate || !endDate || !retirementHome) {
        return NextResponse.json({ error: 'Home ID, start date, and end date are required' }, { status: 400 });
    }

    // check data from hydration firebase as a base
    const hydrationData = await getLegacyHydrationData('home_manager', retirementHome);

    // check data from default firebase

    // match data from hydration firebase and default firebase
    // overwrite overlapping data with data from default firebase

    
    // return NextResponse.json({ home });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data } = body;
  return NextResponse.json({ message: 'Hello, world!' });
}