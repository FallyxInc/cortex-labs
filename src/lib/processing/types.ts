// Shared types for behaviour processing

export interface BehaviourEntry {
  "Effective Date": string;
  "Resident Name": string;
  Type: string;
  Data: string;
  Injuries?: string;
  Previous_Injuries?: string;
}

export interface ProcessedIncident {
  incident_number: string;
  name: string;
  date: string;
  time: string;
  incident_location: string;
  room: string;
  injuries: string;
  incident_type: string;
}

export interface MergedBehaviourData {
  id: number;
  date: string;
  time: string;
  "Day of the Week": string;
  name: string;
  incident_number: string;
  incident_location: string;
  room: string;
  injuries: string;
  incident_type: string;
  behaviour_type: string;
  triggers: string;
  interventions: string;
  poa_notified: string;
  who_affected: string;
  code_white: string;
  prn: string;
  other_notes: string;
  summary: string;
  CI: string;
}

export interface FollowUpNote {
  id: string;
  resident_name: string;
  date: string;
  time: string;
  other_notes: string;
  summary_of_behaviour: string;
}

export const INJURY_TYPES_GROUP1 = [
  "abrasion",
  "bleeding",
  "broken skin",
  "bruising",
  "bruise",
  "burn",
  "dislocation",
  "fracture",
  "frostbite",
  "hematoma",
  "hypoglycemia",
  "incision",
];

export const INJURY_TYPES_GROUP2 = [
  "laceration",
  "pain",
  "redness",
  "scratches",
  "skin tear",
  "sprain",
  "strain",
  "swelling",
  "unconscious",
  "contusion",
];

export const ALL_INJURY_TYPES = [
  ...INJURY_TYPES_GROUP1,
  ...INJURY_TYPES_GROUP2,
];

export const NOTE_TYPES = {
  INCIDENT_FALLS: "Incident - Falls",
  POST_FALL_NURSING: "Post Fall - Nursing",
  BEHAVIOUR_RESPONSIVE: "Behaviour - Responsive Behaviour",
  BEHAVIOUR_FOLLOWUP: "Behaviour - Follow up",
  BEHAVIOUR_NOTE: "Behaviour Note",
  FAMILY_RESIDENT: "Family/Resident Involvement",
  PHYSICIAN_NOTE: "Physician Note",
  RESPONSIVE_PHYSICAL_AGGRESSION: "Responsive Behaviour - Physical Agression",
  RESPONSIVE_OTHER: "Responsive Behaviours - Other",
  RESPONSIVE_VERBAL: "Responsive Behaviour - Verbal",
  RESPONSIVE_POTENTIAL_HARM: "Responsive Behaviour - Potential to harm self",
  RESPONSIVE_WANDERING: "Responsive Behaviour - Wandering",
};

export const DEFAULT_NO_PROGRESS_TEXT =
  "No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM Within 24hrs of RIM";
export const DEFAULT_NO_PROGRESS_TEXT_SHORT =
  "No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM";

// Field extraction configuration for different chains
export interface FieldExtractionConfig {
  fieldName: string | string[]; // Support multiple field names for different note formats
  endMarkers: string[];
}

// Configuration for a specific note type's extraction
export interface NoteTypeExtractionConfig {
  extractionMarkers: Record<string, FieldExtractionConfig>;
  hasTimeFrequency?: boolean;
  hasEvaluation?: boolean;
}

export interface ChainExtractionConfig {
  behaviourNoteTypes: string[];
  followUpNoteTypes: string[];
  extraFollowUpNoteTypes?: string[]; // Optional extra note types to append to follow-up records
  injuryColumns: {
    start: number;
    end: number;
  };

  // Default extraction config (used when no specific config exists for a note type)
  fieldExtractionMarkers: Record<string, FieldExtractionConfig>;
  hasTimeFrequency?: boolean;
  hasEvaluation?: boolean;

  // Note-type-specific extraction configs (overrides default)
  behaviourNoteConfigs?: Record<string, NoteTypeExtractionConfig>;
  followUpNoteConfigs?: Record<string, NoteTypeExtractionConfig>;
}

export interface ExtractedBehaviourFields {
  behaviour_type?: string;
  triggers?: string;
  description?: string;
  consequences?: string;
  interventions?: string;
  medication_changes?: string;
  risks?: string;
  outcome?: string;
  poa_notified?: string;
  time_frequency?: string;
  evaluation?: string;
}
