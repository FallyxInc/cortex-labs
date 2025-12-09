// Central place for chains and homes configuration (TypeScript port of homes_db.py)

import { ChainExtractionConfig, ExcelIncidentColumns } from "./types";
import { getChainConfigFromFirebase } from "@/lib/chainConfig";

export interface ChainConfig {
  name: string;
  homes: string[];
  extraction_type: string;
  supports_follow_up: Record<string, boolean>;
}



const DEFAULT_EXCEL_INCIDENT_COLUMNS: ExcelIncidentColumns = {
  incident_number: "Incident #",
  name: "Resident Name",
  date_time: "Incident Date/Time",
  incident_location: "Incident Location",
  room: "Resident Room Number",
  incident_type: "Incident Type",
};

// Chain-specific extraction configurations
export const CHAIN_EXTRACTION_CONFIGS: Record<string, ChainExtractionConfig> = {
  kindera: {
    behaviourNoteTypes: [
      "Responsive Behaviour - Physical Agression",
      "Responsive Behaviours - Other",
      "Responsive Behaviour - Verbal",
      "Responsive Behaviour - Potential to harm self",
      "Responsive Behaviour - Wandering",
      "Behaviour - Responsive Behaviour",
    ],
    followUpNoteTypes: [
      "Behaviour Note",
      "Behaviour - Follow up",
    ],
    extraFollowUpNoteTypes: [
      "Family/Resident Involvment",
      "Physician Note",
    ],
    excelExtraction: {
      injuryColumns: {
        start: 13,
        end: 37,
      },
      incidentColumns: DEFAULT_EXCEL_INCIDENT_COLUMNS,
    },
    matchingWindowHours: 24,
    // Default extraction markers (fallback if no specific config)
    fieldExtractionMarkers: {
      description: {
        fieldName: "Data :",
        endMarkers: ["Action", "Page", "________________", "SIGNED]"],
      },
      interventions: {
        fieldName: "Action :",
        endMarkers: ["Response", "Page"],
      },
      evaluation: {
        fieldName: "Response :",
        endMarkers: ["Page", "________________", "SIGNED]"],
      },
      outcome: {
        fieldName: "Response :",
        endMarkers: ["Page", "________________", "SIGNED]"],
      },
    },
    hasTimeFrequency: true,
    hasEvaluation: true,
    // Note-type-specific configs for different behaviour note formats
    behaviourNoteConfigs: {
      // Responsive Behaviour format (Data/Action/Response)
      "Responsive Behaviour - Physical Agression": {
        extractionMarkers: {
          description: {
            fieldName: "Data :",
            endMarkers: ["Action", "Page", "________________", "SIGNED]"],
          },
          interventions: {
            fieldName: "Action :",
            endMarkers: ["Response", "Page"],
          },
          evaluation: {
            fieldName: "Response :",
            endMarkers: ["Page", "________________", "SIGNED]"],
          },
          outcome: {
            fieldName: "Response :",
            endMarkers: ["Page", "________________", "SIGNED]"],
          },
        },
        hasTimeFrequency: false,
        hasEvaluation: true,
      },
      "Responsive Behaviours - Other": {
        extractionMarkers: {
          description: {
            fieldName: "Data :",
            endMarkers: ["Action", "Page", "________________", "SIGNED]"],
          },
          interventions: {
            fieldName: "Action :",
            endMarkers: ["Response", "Page"],
          },
          evaluation: {
            fieldName: "Response :",
            endMarkers: ["Page", "________________", "SIGNED]"],
          },
          outcome: {
            fieldName: "Response :",
            endMarkers: ["Page", "________________", "SIGNED]"],
          },
        },
        hasTimeFrequency: false,
        hasEvaluation: true,
      },
      "Responsive Behaviour - Verbal": {
        extractionMarkers: {
          description: {
            fieldName: "Data :",
            endMarkers: ["Action", "Page", "________________", "SIGNED]"],
          },
          interventions: {
            fieldName: "Action :",
            endMarkers: ["Response", "Page"],
          },
          evaluation: {
            fieldName: "Response :",
            endMarkers: ["Page", "________________", "SIGNED]"],
          },
          outcome: {
            fieldName: "Response :",
            endMarkers: ["Page", "________________", "SIGNED]"],
          },
        },
        hasTimeFrequency: false,
        hasEvaluation: true,
      },
      "Responsive Behaviour - Potential to harm self": {
        extractionMarkers: {
          description: {
            fieldName: "Data :",
            endMarkers: ["Action", "Page", "________________", "SIGNED]"],
          },
          interventions: {
            fieldName: "Action :",
            endMarkers: ["Response", "Page"],
          },
          evaluation: {
            fieldName: "Response :",
            endMarkers: ["Page", "________________", "SIGNED]"],
          },
          outcome: {
            fieldName: "Response :",
            endMarkers: ["Page", "________________", "SIGNED]"],
          },
        },
        hasTimeFrequency: false,
        hasEvaluation: true,
      },
      "Responsive Behaviour - Wandering": {
        extractionMarkers: {
          description: {
            fieldName: "Data :",
            endMarkers: ["Action", "Page", "________________", "SIGNED]"],
          },
          interventions: {
            fieldName: "Action :",
            endMarkers: ["Response", "Page"],
          },
          evaluation: {
            fieldName: "Response :",
            endMarkers: ["Page", "________________", "SIGNED]"],
          },
          outcome: {
            fieldName: "Response :",
            endMarkers: ["Page", "________________", "SIGNED]"],
          },
        },
        hasTimeFrequency: false,
        hasEvaluation: true,
      },
      "Behaviour - Responsive Behaviour": {
        extractionMarkers: {
          description: {
            fieldName: "Data :",
            endMarkers: ["Action", "Page", "________________", "SIGNED]"],
          },
          interventions: {
            fieldName: "Action :",
            endMarkers: ["Response", "Page"],
          },
          evaluation: {
            fieldName: "Response :",
            endMarkers: ["Page", "________________", "SIGNED]"],
          },
          outcome: {
            fieldName: "Response :",
            endMarkers: ["Page", "________________", "SIGNED]"],
          },
        },
        hasTimeFrequency: false,
        hasEvaluation: true,
      },
    },
    followUpNoteConfigs: {
      // Behaviour Note format (Behaviour Displayed/Intervention/etc.)
      "Behaviour Note": {
        extractionMarkers: {
          behaviour_type: {
            fieldName: "Behaviour Displayed :",
            endMarkers: ["Intervention :", "Time, Frequency", "Page"],
          },
          description: {
            fieldName: "Behaviour Displayed :",
            endMarkers: ["Intervention :", "Time, Frequency", "Page"],
          },
          interventions: {
            fieldName: "Intervention :",
            endMarkers: ["Time, Frequency", "Evaluation of Intervention", "Page"],
          },
          time_frequency: {
            fieldName: "Time, Frequency and # of Staff :",
            endMarkers: ["Evaluation of Intervention", "Resident Response", "Page"],
          },
          evaluation: {
            fieldName: "Evaluation of Intervention :",
            endMarkers: ["Resident Response", "Page", "________________"],
          },
          outcome: {
            fieldName: "Resident Response :",
            endMarkers: ["Page", "________________", "SIGNED]"],
          },
        },
        hasTimeFrequency: true,
        hasEvaluation: true,
      },
    }
  },
  responsive: {
    behaviourNoteTypes: ["Behaviour - Responsive Behaviour"],
    followUpNoteTypes: ["Behaviour - Follow up"],
    extraFollowUpNoteTypes: [
      "Family/Resident Involvment",
      "Physician Note",
    ],
    excelExtraction: {
      injuryColumns: {
        start: 13,
        end: 87,
      },
      incidentColumns: DEFAULT_EXCEL_INCIDENT_COLUMNS,
    },
    matchingWindowHours: 20,
    fieldExtractionMarkers: {
      behaviour_type: {
        fieldName: "Type of Behaviour :",
        endMarkers: ["Antecedent/Triggers", "Page"],
      },
      triggers: {
        fieldName: "Antecedent/Triggers :",
        endMarkers: ["Describe the behaviour", "Page"],
      },
      description: {
        fieldName: "Describe the behaviour :",
        endMarkers: ["Disruptiveness", "Page"],
      },
      consequences: {
        fieldName: "Disruptiveness (Data)/Consequences to the behaviour :",
        endMarkers: ["Interventions", "Page"],
      },
      interventions: {
        fieldName: "Interventions (review/update care plan) (Action) :",
        endMarkers: ["Change in medication", "Page"],
      },
      medication_changes: {
        fieldName: "Change in medication :",
        endMarkers: ["What are the risks and causes", "Page"],
      },
      risks: {
        fieldName: "What are the risks and causes :",
        endMarkers: ["Outcome(s)(Result)", "Page"],
      },
      outcome: {
        fieldName: "Outcome(s)(Result) :",
        endMarkers: ["Substitute Decision Maker", "Page"],
      },
      poa_notified: {
        fieldName: "Substitute Decision Maker notified (if not, explain) :",
        endMarkers: ["Page", "Range"],
      },
    },
    hasTimeFrequency: false,
    hasEvaluation: false,
  },
  test: {
    behaviourNoteTypes: ["Behaviour - Responsive Behaviour"],
    followUpNoteTypes: ["Behaviour - Follow up"],
    extraFollowUpNoteTypes: [
      "Family/Resident Involvment",
      "Physician Note",
    ],
    excelExtraction: {
      injuryColumns: {
        start: 13,
        end: 34,
      },
      incidentColumns: DEFAULT_EXCEL_INCIDENT_COLUMNS,
    },
    matchingWindowHours: 20,
    fieldExtractionMarkers: {
      behaviour_type: {
        fieldName: "Type of Behaviour :",
        endMarkers: ["Antecedent/Triggers", "Page"],
      },
      triggers: {
        fieldName: "Antecedent/Triggers :",
        endMarkers: ["Describe the behaviour", "Page"],
      },
      description: {
        fieldName: "Describe the behaviour :",
        endMarkers: ["Disruptiveness", "Page"],
      },
      consequences: {
        fieldName: "Disruptiveness (Data)/Consequences to the behaviour :",
        endMarkers: ["Interventions", "Page"],
      },
      interventions: {
        fieldName: "Interventions (review/update care plan) (Action) :",
        endMarkers: ["Change in medication", "Page"],
      },
      medication_changes: {
        fieldName: "Change in medication :",
        endMarkers: ["What are the risks and causes", "Page"],
      },
      risks: {
        fieldName: "What are the risks and causes :",
        endMarkers: ["Outcome(s)(Result)", "Page"],
      },
      outcome: {
        fieldName: "Outcome(s)(Result) :",
        endMarkers: ["Substitute Decision Maker", "Page"],
      },
      poa_notified: {
        fieldName: "Substitute Decision Maker notified (if not, explain) :",
        endMarkers: ["Page", "Range"],
      },
    },
    hasTimeFrequency: false,
    hasEvaluation: false,
  },
};


// Extract date from filename in format: {name}_{date}_{time}.{ext}
// Example: berkshire_care_09-11-2025_1111.pdf
export function extractDateFromFilename(
  filename: string,
): { month: string; day: string; year: string } | null {
  try {
    // Remove extension and split by underscore
    // const parts = filename.replace(/\.[^/.]+$/, "").split("_");

    // Find the part that matches MM-DD-YYYY format
    // or YYYY-MM-DD format anywhere in the filename
    let dateRegex = /(\d{2})-(\d{2})-(\d{4})/;
    let match = filename.match(dateRegex);
    
    if (match) {
      const [, month, day, year] = match;
      return { month: month, day: day, year: year };
    }
    else {
      // Try YYYY-MM-DD format
      dateRegex = /(\d{4})-(\d{2})-(\d{2})/;
      match = filename.match(dateRegex);  
      if (match) {
        const [, year, month, day] = match;
        return { month: month, day: day, year: year };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get chain extraction config - checks hardcoded configs first, then Firebase
 * This allows dynamic loading of configs created through onboarding
 */
export async function getChainExtractionConfig(
  chainId: string
): Promise<ChainExtractionConfig | null> {
  // First check hardcoded configs
  if (CHAIN_EXTRACTION_CONFIGS[chainId]) {
    return CHAIN_EXTRACTION_CONFIGS[chainId];
  }

  // Then check Firebase for dynamically created configs
  try {
    const firebaseConfig = await getChainConfigFromFirebase(chainId);
    if (firebaseConfig) {
      // Cache it in memory for future use
      CHAIN_EXTRACTION_CONFIGS[chainId] = firebaseConfig;
      return firebaseConfig;
    }
  } catch (error) {
    console.error(`Error loading chain config for ${chainId}:`, error);
  }

  // Fallback to responsive config if nothing found
  console.warn(`Chain config not found for ${chainId}, falling back to responsive`);
  return CHAIN_EXTRACTION_CONFIGS["responsive"] || null;
}
