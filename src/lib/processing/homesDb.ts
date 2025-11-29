// Central place for chains and homes configuration (TypeScript port of homes_db.py)

import { ChainExtractionConfig, NOTE_TYPES } from "./types";

export interface ChainConfig {
  name: string;
  homes: string[];
  extraction_type: string;
  supports_follow_up: Record<string, boolean>;
}

// Extract date from filename in format: {name}_{date}_{time}.{ext}
// Example: berkshire_care_09-11-2025_1111.pdf
export function extractDateFromFilename(
  filename: string,
): { month: string; day: string; year: string } | null {
  try {
    // Remove extension and split by underscore
    const parts = filename.replace(/\.[^/.]+$/, "").split("_");

    // Find the part that matches MM-DD-YYYY format
    const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;

    for (const part of parts) {
      const match = part.match(dateRegex);
      if (match) {
        const [, month, day, year] = match;
        // Create date (month is 0-indexed in JavaScript)
        return { month: month, day: day, year: year };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

// Chain-specific extraction configurations
export const CHAIN_EXTRACTION_CONFIGS: Record<string, ChainExtractionConfig> = {
  kindera: {
    behaviourNoteTypes: [
      NOTE_TYPES.RESPONSIVE_PHYSICAL_AGGRESSION,
      NOTE_TYPES.RESPONSIVE_VERBAL,
      NOTE_TYPES.RESPONSIVE_POTENTIAL_HARM,
      NOTE_TYPES.RESPONSIVE_WANDERING,
      NOTE_TYPES.BEHAVIOUR_RESPONSIVE,
    ],
    followUpNoteTypes: [
      NOTE_TYPES.BEHAVIOUR_FOLLOWUP,
      NOTE_TYPES.BEHAVIOUR_NOTE,
    ],
    extraFollowUpNoteTypes: [
      NOTE_TYPES.FAMILY_RESIDENT,
      NOTE_TYPES.PHYSICIAN_NOTE,
    ],
    injuryColumns: {
      start: 13,
      end: 37,
    },
    fieldExtractionMarkers: {
      behaviour_type: {
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
      description: {
        fieldName: "Data :",
        endMarkers: ["Action", "Page", "________________", "SIGNED]"],
      },
      consequences: {
        fieldName: "Action :",
        endMarkers: ["Response", "Page", "________________", "SIGNED]"],
      },
      poa_notified: {
        fieldName: "Response :",
        endMarkers: ["Page", "________________", "SIGNED]"],
      },
    },
    hasTimeFrequency: true,
    hasEvaluation: true,
  },
  responsive: {
    behaviourNoteTypes: [NOTE_TYPES.BEHAVIOUR_RESPONSIVE],
    followUpNoteTypes: [NOTE_TYPES.BEHAVIOUR_FOLLOWUP],
    extraFollowUpNoteTypes: [
      NOTE_TYPES.FAMILY_RESIDENT,
      NOTE_TYPES.PHYSICIAN_NOTE,
    ],
    injuryColumns: {
      start: 13,
      end: 87,
    },
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
    behaviourNoteTypes: [NOTE_TYPES.BEHAVIOUR_RESPONSIVE],
    followUpNoteTypes: [NOTE_TYPES.BEHAVIOUR_FOLLOWUP],
    extraFollowUpNoteTypes: [
      NOTE_TYPES.FAMILY_RESIDENT,
      NOTE_TYPES.PHYSICIAN_NOTE,
    ],
    injuryColumns: {
      start: 13,
      end: 34,
    },
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
