export type Confidence = "High" | "Medium" | "Low";

export type TechnologyCategory =
  | "JavaScript framework"
  | "Meta-framework"
  | "CMS"
  | "E-commerce"
  | "CSS framework"
  | "JavaScript library"
  | "Analytics"
  | "Tag manager"
  | "CDN / Hosting"
  | "Server"
  | "Fonts"
  | "Icons"
  | "Marketing"
  | "Styling"
  | "Site builder"
  | "Language";

export interface TechnologyDetection {
  name: string;
  category: TechnologyCategory;
  confidence: Confidence;
  evidence: string[];
  website?: string;
  version?: string | null;
}
