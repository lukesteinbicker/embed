export interface VisitorFields {
  active: boolean;
  joined: boolean;
  dailyRoomId: string | null;
  chatRoomId: string | null;
  sessionEndedAt: string | null;
}

export interface EmbedConfig {
  API_BASE: string;
}

export interface VisitorData {
  visitorId: string;
  sessionId: string;
  companyId: string;
  token: string;
}

export interface VisitStatus {
  active?: boolean;
  joined?: boolean;
  dailyRoomId?: string | null;
  chatRoomId?: string | null;
  sessionEndedAt?: string | null;
  endedAt?: string | null;
}

export interface EventSourceMessage {
  type: 'visit_update' | 'connected' | 'ping' | 'error';
  active?: boolean;
  joined?: boolean;
  dailyRoomId?: string | null;
  chatRoomId?: string | null;
  sessionEndedAt?: string | null;
  sessionId?: string;
  message?: string;
}
