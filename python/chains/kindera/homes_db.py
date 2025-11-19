# Import shared homes_db configuration
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from homes_db import (
    CHAINS, HOME_TO_CHAIN, ALL_HOMES,
    association_dict, homes_dict, naming_dict,
    get_chain_for_home, get_extraction_type, supports_follow_up, get_homes_for_chain
)

# Kindera chain homes
KINDERA_HOMES = CHAINS['kindera']['homes']
homes = ["BERKSHIRE CARE", "BANWELL GARDENS"]  # For backward compatibility

homes_email = {
    "Ina Grafton": ["ayaan@fallyx.com"],
    "Mill Creek": ["ayaan@fallyx.com"],
    "Niagara": ["ayaanesmail04@gmail.com"],
    "Wellington": ["ayaanesmail04@gmail.com"],
    "Bon Air": ["ayaanesmail04@gmail.com"],
    "Champlain": ["ayaanesmail04@gmail.com"],
    "Lancaster": ["ayaanesmail04@gmail.com"],
    "The ONeill": ["ayaanesmail04@gmail.com"],
    "Villa Marconi": ["ayaanesmail04@gmail.com"],
    "SRR": ["ayaanesmail04@gmail.com"],
    "Berkshire Care": ["ayaanesmail04@gmail.com"],
    "Banwell Gardens": ["ayaanesmail04@gmail.com"]
}
#firebase related
association_dict = {
    'iggh': 'ina_grafton_gage',
    'millCreek': 'mill_creek_care',
    'niagara': 'niagara_ltc',
    'wellington': 'the_wellington',
    'bonairltc': 'bon_air',
    'champlain': 'champlain_ltc',
    'lancaster': 'lancaster_ltc',
    'oneill': 'the_oneill',
    'vmltc': 'villa_marconi',
    'scarborough_retirement': 'srr',
    'shepherd': 'shepherd_lodge',
    'berkshire': 'berkshire_care',
    'banwell': 'banwell_gardens',
}
homes_dict = {
    'ina_grafton_gage': 'iggh',
    'mill_creek_care': 'millCreek',
    'niagara_ltc': 'niagara',
    'the_wellington': 'wellington',
    'bon_air': 'bonairltc',
    'champlain_ltc': 'champlain',
    'lancaster_ltc': 'lancaster',
    'the_oneill': 'oneill',
    'villa_marconi': 'vmltc',
    'generations': 'generations',
    'scarborough_retirement': 'srr',
    'shepherd_lodge': 'shepherd',
    'berkshire_care': 'berkshire',
    'banwell_gardens': 'banwell',
}

naming_dict = {
    'ina_grafton_gage': 'Ina Grafton',
    'mill_creek_care': 'Mill Creek',
    'niagara_ltc': 'Niagara',
    'the_wellington': 'Wellington',
    'bon_air': 'Bon Air',
    'champlain_ltc': 'Champlain',
    'lancaster_ltc': 'Lancaster',
    'the_oneill': 'The ONeill',
    'villa_marconi': 'Villa Marconi',
    'scarborough_retirement': 'SRR',
    'shepherd_lodge': 'shepherd',
    'berkshire_care': 'Berkshire Care',
    'banwell_gardens': 'Banwell Gardens',

}
homes_firebase = ["iggh", "niagara", "wellington", "millCreek", "bonairltc", "champlain", "lancaster", "oneill", "vmltc", "shepherd", "berkshire", "banwell"]



shift_times = {
    "Ina Grafton": {
        "Morning": "07:00 to 15:00",
        "Evening": "15:01 to 23:00",
        "Night": "23:01 to 06:59"
    },
    "Mill Creek": {
        "Morning": "06:30 to 14:30",
        "Evening": "14:31 to 22:30",
        "Night": "22:31 to 06:30"
    },
    "Niagara": {
        "Morning": "06:00 to 14:00",
        "Evening": "14:01 to 22:00",
        "Night": "22:01 to 05:59"
    },
    "Wellington": {
        "Morning": "06:30 to 14:30",
        "Evening": "14:31 to 22:30",
        "Night": "22:31 to 06:30"
    },
    "The ONeill": {
        "Morning": "07:00 to 15:00",
        "Evening": "15:01 to 23:00",
        "Night": "23:01 to 07:00"
    },
    "Lancaster": {
        "Morning": "06:00 to 14:00",
        "Evening": "14:01 to 22:00",
        "Night": "22:01 to 06:00"
    },
    "Champlain": {
        "Morning": "06:00 to 14:00",
        "Evening": "14:01 to 22:00",
        "Night": "22:01 to 06:00"
    },
    "Villa Marconi": {
        "Morning": "07:00 to 15:00",
        "Evening": "15:01 to 23:00",
        "Night": "23:01 to 07:00"
    },
    "Berkshire Care": {
        "Morning": "07:00 to 15:00",
        "Evening": "15:01 to 23:00",
        "Night": "23:01 to 07:00"
    },
    "Banwell Gardens": {
        "Morning": "07:00 to 15:00",
        "Evening": "15:01 to 23:00",
        "Night": "23:01 to 07:00"
    }
}


def get_shift_time(home, input_time):
    # Convert input_time to a datetime object
    input_time = datetime.strptime(input_time.strip(), "%H:%M")
    
    # Check if the home exists in the shift_times dictionary
    if home in shift_times:
        for shift, time_range in shift_times[home].items():
            start_time_str, end_time_str = time_range.split(" to ")
            start_time = datetime.strptime(start_time_str, "%H:%M")
            end_time = datetime.strptime(end_time_str, "%H:%M")
            
            # Handle overnight shifts
            if start_time <= end_time:
                if start_time <= input_time <= end_time:
                    return shift
            else:
                if input_time >= start_time or input_time <= end_time:
                    return shift
    return "Time not in any shift"

