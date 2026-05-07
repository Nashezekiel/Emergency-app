// Firestore Incident Types
export interface FirestoreIncident {
  id: string;
  reporterId: string;
  reporterName: string;
  incidentType: "medical" | "fire" | "crime" | "other";
  description: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  status: "pending" | "in_progress" | "resolved";
  priority: "low" | "medium" | "high" | "critical";
  isPanicAlert: boolean;
  mlClassification?: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
}

export interface FirestoreMedia {
  id: string;
  fileUrl: string;
  fileType: "photo" | "video";
  fileName: string;
  fileSize?: number;
  uploadedBy: string;
  createdAt: Date;
}

export interface FirestoreNote {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}

export interface FirestoreStatusUpdate {
  id: string;
  previousStatus?: "pending" | "in_progress" | "resolved";
  newStatus: "pending" | "in_progress" | "resolved";
  notes?: string | null;
  updatedBy: string;
  createdAt: Date;
}

// User Types
export interface FirestoreUser {
  id: string;
  openId: string;
  name?: string;
  email?: string;
  loginMethod?: string;
  role: "user" | "admin" | "civilian" | "responder";
  userRole?: "civilian" | "responder";
  phoneNumber?: string;
  profilePicture?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}
