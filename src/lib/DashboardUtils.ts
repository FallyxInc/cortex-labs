import { ref, update } from 'firebase/database';
import * as Papa from 'papaparse';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';


export function markPostFallNotes(input) {
  console.log('markPostFallNotes is being called with data:', input);
  const data = [...input];
  data.sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));
  for (let i = 0; i < data.length; i++) {
    const currentID = data[i].id;
    const currentRecord = data[i];
    
    // Convert postFallNotes to number
    const postFallNotesCount = Number(currentRecord.postFallNotes) || 0;
    const notHospitalized = currentRecord.transfer_to_hospital === 'no' || currentRecord.transfer_to_hospital === 'No';
    
    console.log('Checking conditions:', {
      name: currentRecord.name,
      postFallNotes: postFallNotesCount,
      transfer_to_hospital: currentRecord.transfer_to_hospital,
      notHospitalized: notHospitalized,
      poaContacted: currentRecord.poaContacted
    });

    // Set colors for different conditions
    input[currentID].postFallNotesColor = 
      postFallNotesCount < 3 && notHospitalized ? 'red' : 'default';
    
    // Only set red if explicitly "No" or "no"
    input[currentID].poaContactedColor = 
      currentRecord.poaContacted === 'No' || currentRecord.poaContacted === 'no' 
        ? 'red' 
        : 'default';
  }
  return input;
}

export function countFallsByExactInjury(data) {
  var injuryCounts = {};

  data.forEach((fall) => {
    var injury = fall.injury;

    if (injuryCounts[injury]) {
      injuryCounts[injury]++;
    } else {
      injuryCounts[injury] = 1;
    }
  });

  return injuryCounts;
}

export function countFallsByLocation(data) {
  const locationCounts = {};
  
  Object.values(data).forEach(item => {
    // Check for both possible field names
    const locationValue = item.location || item.incident_location;
    
    if (locationValue) {
      locationCounts[locationValue] = (locationCounts[locationValue] || 0) + 1;
    }
  });
  
  console.log('Location counts:', locationCounts); // Debug log
  return locationCounts;
}

export function countFallsByHIR(data) {
  let hirCount = 0;
  data.forEach(item => {
    try {
      if (item.hir === 'yes' || item.hir === 'Yes') {
        hirCount++;
      }
    } catch (error) {
      console.error('Error processing HIR:', error);
    }
  });
  return hirCount;
}

export function getMonthFromTimeRange(timeRange) {
  // Example logic for determining the month label
  // Replace this logic with the actual month logic you are using
  var currentMonth = 'August 2024'; // You can dynamically determine this based on the current time or input data
  if (timeRange === '3months') {
    return 'June - August 2024';
  } else if (timeRange === '6months') {
    return 'March - August 2024';
  } else {
    return currentMonth;
  }
}

export function getTimeShift(fallTime, home) {
  // Debug logging
  console.log('Analyzing time:', fallTime, 'for home:', home);

  // Handle empty/invalid time
  if (!fallTime || fallTime === '') {
    return 'Unknown';
  }

  // Handle time format
  let hours, minutes;
  
  try {
    // Handle different time formats
    if (fallTime.includes(':')) {
      const timeParts = fallTime.split(':');
      hours = parseInt(timeParts[0], 10);
      minutes = parseInt(timeParts[1], 10);
    } else {
      // If time is in another format, return Unknown
      return 'Unknown';
    }

    // Validate parsed time
    if (isNaN(hours) || isNaN(minutes)) {
      console.log('Invalid time format:', fallTime);
      return 'Unknown';
    }

    const totalMinutes = (hours * 60) + minutes;
    console.log('Total minutes:', totalMinutes);

    // Goderich-specific time shifts
    if (home.toLowerCase() === 'goderich') {
      // Morning: 7:00 AM (420) to 2:59 PM (899)
      if (totalMinutes >= 420 && totalMinutes <= 899) return 'Morning';
      
      // Evening: 3:00 PM (900) to 10:59 PM (1379)
      if (totalMinutes >= 900 && totalMinutes <= 1379) return 'Evening';
      
      // Night: 11:00 PM (1380) to 6:59 AM (419)
      if (totalMinutes >= 1380 || totalMinutes <= 419) return 'Night';
      
      console.log(`Time ${fallTime} (${totalMinutes} minutes) outside shift ranges`);
      return 'Unknown';
    }

    // Handle other homes' time shifts
    const timeShifts = {
      iggh: {
        morning: [420, 900], // 7:00 AM to 3:00 PM
        evening: [901, 1380], // 3:01 PM to 11:00 PM
        night: [1381, 419], // 11:01 PM to 6:59 AM
      },
      millCreek: {
        morning: [390, 870], // 6:30 AM to 2:30 PM
        evening: [871, 1350], // 2:31 PM to 10:30 PM
        night: [1351, 389], // 10:31 PM to 6:30 AM
      },
      niagara: {
        morning: [360, 840], // 6:00 AM to 2:00 PM
        evening: [841, 1320], // 2:01 PM to 10:00 PM
        night: [1321, 359], // 10:01 PM to 5:59 AM
      },
      wellington: {
        morning: [390, 870], // 6:30 AM to 2:30 PM
        evening: [871, 1350], // 2:31 PM to 10:30 PM
        night: [1351, 389], // 10:31 PM to 6:30 AM
      },
      home1: {
        morning: [420, 900], // 7:00 AM to 3:00 PM
        evening: [901, 1380], // 3:01 PM to 11:00 PM
        night: [1381, 419], // 11:01 PM to 6:59 AM
      },
      home2: {
        morning: [420, 900], // 7:00 AM to 3:00 PM
        evening: [901, 1380], // 3:01 PM to 11:00 PM
        night: [1381, 419], // 11:01 PM to 6:59 AM
      },
      home3: {
        morning: [420, 900], // 7:00 AM to 3:00 PM
        evening: [901, 1380], // 3:01 PM to 11:00 PM
        night: [1381, 419], // 11:01 PM to 6:59 AM
      },
      home4: {
        morning: [420, 900], // 7:00 AM to 3:00 PM
        evening: [901, 1380], // 3:01 PM to 11:00 PM
        night: [1381, 419], // 11:01 PM to 6:59 AM
      },
      bonairltc: {
        morning: [390, 869],   // 6:30 AM to 2:29 PM
        evening: [870, 1349],  // 2:30 PM to 10:29 PM
        night: [1350, 389],    // 10:30 PM to 6:29 AM
      },
      champlain: {
        morning: [360, 839],   // 6:00 AM to 1:59 PM
        evening: [840, 1319],  // 2:00 PM to 9:59 PM
        night: [1320, 359],    // 10:00 PM to 5:59 AM
      },
      lancaster: {
        morning: [360, 839],   // 6:00 AM to 1:59 PM
        evening: [840, 1319],  // 2:00 PM to 9:59 PM
        night: [1320, 359],    // 10:00 PM to 5:59 AM
      },
      oneill: {
        morning: [420, 899],   // 7:00 AM to 2:59 PM
        evening: [900, 1379],  // 3:00 PM to 10:59 PM
        night: [1380, 419],    // 11:00 PM to 6:59 AM
      },
      vmltc: {
        morning: [420, 899],   // 7:00 AM to 2:59 PM
        evening: [900, 1379],  // 3:00 PM to 10:59 PM
        night: [1380, 419],    // 11:00 PM to 6:59 AM
      },
      generations: {
        morning: [420, 899],   // 7:00 AM to 2:59 PM
        evening: [900, 1379],  // 3:00 PM to 10:59 PM
        night: [1380, 419],    // 11:00 PM to 6:59 AM
      },
      generationltc: {
        morning: [420, 899],   // 7:00 AM to 2:59 PM
        evening: [900, 1379],  // 3:00 PM to 10:59 PM
        night: [1380, 419],    // 11:00 PM to 6:59 AM
      },
      goderich: {
        morning: [420, 899],   // 7:00 AM to 2:59 PM
        evening: [900, 1379],  // 3:00 PM to 10:59 PM
        night: [1380, 419],    // 11:00 PM to 6:59 AM
      },
      
      palisade: {
        morning: [420, 899],   // 7:00 AM to 2:59 PM
        evening: [900, 1379],  // 3:00 PM to 10:59 PM
        night: [1380, 419],    // 11:00 PM to 6:59 AM
      },
      shepherd: {
        morning: [420, 899],   // 7:00 AM to 2:59 PM
        evening: [900, 1379],  // 3:00 PM to 10:59 PM
        night: [1380, 419],    // 11:00 PM to 6:59 AM
      },

      domlipa: {
        morning: [420, 899],   // 7:00 AM to 2:59 PM
        evening: [900, 1379],  // 3:00 PM to 10:59 PM
        night: [1380, 419],    // 11:00 PM to 6:59 AM
      },

      srr: {
        morning: [420, 899],   // 7:00 AM to 2:59 PM
        evening: [900, 1379],  // 3:00 PM to 10:59 PM
        night: [1380, 419],    // 11:00 PM to 6:59 AM
      },

      wellbrook_east: {
        morning: [420, 899],   // 7:00 AM to 2:59 PM
        evening: [900, 1379],  // 3:00 PM to 10:59 PM
        night: [1380, 419],    // 11:00 PM to 6:59 AM
      },

      wellbrook_west: {
        morning: [420, 899],   // 7:00 AM to 2:59 PM
        evening: [900, 1379],  // 3:00 PM to 10:59 PM
        night: [1380, 419],    // 11:00 PM to 6:59 AM
      },

      southview_acres: {
        morning: [420, 899],   // 7:00 AM to 2:59 PM
        evening: [900, 1379],  // 3:00 PM to 10:59 PM
        night: [1380, 419],    // 11:00 PM to 6:59 AM
      },
      
      
      
      

    };

    const shiftConfig = timeShifts[home];
    if (!shiftConfig) {
      throw new Error(`No configuration found for home: ${home}`);
    }

    if (totalMinutes >= shiftConfig.morning[0] && totalMinutes <= shiftConfig.morning[1]) {
      return 'Morning';
    } else if (totalMinutes >= shiftConfig.evening[0] && totalMinutes <= shiftConfig.evening[1]) {
      return 'Evening';
    } else {
      if (totalMinutes >= shiftConfig.night[0] || totalMinutes <= shiftConfig.night[1]) {
        return 'Night';
      }
    }

    throw new Error(`Time ${fallTime} does not match any shift for home: ${home}`);
  } catch (error) {
    console.error('Error processing time:', error);
    return 'Unknown';
  }
}

export function countResidentsWithRecurringFalls(data) {
  var residentFallCounts = {};

  // Count falls for each resident
  data.forEach((fall) => {
    var residentName = fall.name;
    if (residentFallCounts[residentName]) {
      residentFallCounts[residentName]++;
    } else {
      residentFallCounts[residentName] = 1;
    }
  });

  // Only include residents with more than one fall
  var recurringFalls = {};
  for (var resident in residentFallCounts) {
    if (residentFallCounts[resident] > 1) {
      recurringFalls[resident] = residentFallCounts[resident];
    }
  }

  return recurringFalls;
}

export function countFallsByTimeOfDay(data, name) {
  var timeOfDayCounts = { Morning: 0, Evening: 0, Night: 0 };

  data.forEach((fall) => {
    var shift = getTimeShift(fall.time, name);
    timeOfDayCounts[shift]++;
  });

  return timeOfDayCounts;
}

export function countFallsByUnit(data) {
  const unitCounts = {};
  
  data.forEach((fall) => {
    // Use homeUnit if available, otherwise use room
    const unit = fall.homeUnit || fall.room;
    
    if (unit) {
      const trimmedUnit = unit.trim();
      unitCounts[trimmedUnit] = (unitCounts[trimmedUnit] || 0) + 1;
    }
  });
  
  return unitCounts;
}

export function countFallsByDayOfWeek(data) {
  const dayCounts = {
    'Sunday': 0,
    'Monday': 0,
    'Tuesday': 0,
    'Wednesday': 0,
    'Thursday': 0,
    'Friday': 0,
    'Saturday': 0
  };
  
  data.forEach((fall) => {
    if (fall.date) {
      // Parse the date string in YYYY-MM-DD format
      const [year, month, day] = fall.date.split('-').map(Number);
      // Create date object (month is 0-based in JavaScript)
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      dayCounts[dayOfWeek]++;
    }
  });
  
  return dayCounts;
}

export function countFallsByHour(data) {
  const hourCounts = {};
  
  // Initialize all hours with 0
  for (let i = 0; i < 24; i++) {
    hourCounts[i] = 0;
  }
  
  data.forEach((fall) => {
    if (fall.time) {
      // Parse the time string to get hours
      const timeParts = fall.time.split(':');
      if (timeParts.length >= 1) {
        const hour = parseInt(timeParts[0], 10);
        if (!isNaN(hour)) {
          hourCounts[hour]++;
        }
      }
    }
  });
  
  return hourCounts;
}
