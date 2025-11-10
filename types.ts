export interface Project {
  name: string;
  duration: number;
  color: string;
  originalNames: string[]; // Added to track original names for mapping
}

export interface AnalyzedEvent {
  title: string;
  durationHours: number;
  color: string;
}

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

export interface CalendarImage {
  id: string;
  base64: string;
  events: AnalyzedEvent[];
}
