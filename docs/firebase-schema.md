# Firebase Firestore Schema

## Collections Overview

### users
```typescript
{
  id: string;                    // Document ID (UUID)
  openId: string;                // OAuth identifier
  name: string | null;           // User display name
  email: string | null;          // User email
  loginMethod: string | null;    // "email", "google", "apple", etc.
  role: string;                 // "user", "admin", "civilian", "responder"
  userRole: "civilian" | "responder" | null;  // Emergency app specific role
  phoneNumber?: string;           // Optional phone number
  profilePicture?: string;        // Optional profile picture URL
  isActive: boolean;             // Account status
  createdAt: Timestamp;          // Account creation
  updatedAt: Timestamp;          // Last update
  lastSignedIn: Timestamp;       // Last login
}
```

### incidents
```typescript
{
  id: string;                    // Document ID
  reporterId: string;            // Reference to users.openId
  reporterName: string;          // Reporter display name
  incidentType: "medical" | "fire" | "crime" | "other";
  description: string;            // Incident description
  latitude?: number;             // GPS latitude
  longitude?: number;            // GPS longitude
  address?: string;              // Human readable address
  status: "pending" | "in_progress" | "resolved";
  priority: "low" | "medium" | "high" | "critical";
  isPanicAlert: boolean;         // True for SOS alerts
  mlClassification?: string;      // AI classification result
  createdAt: Timestamp;          // Incident creation
  updatedAt: Timestamp;          // Last update
  resolvedAt?: Timestamp;        // Resolution timestamp
}
```

### incident media (subcollection of incidents)
```typescript
{
  id: string;                    // Document ID
  fileUrl: string;              // Storage URL
  fileType: "photo" | "video";   // Media type
  fileName: string;             // Original filename
  fileSize?: number;             // File size in bytes
  uploadedBy: string;           // Reference to users.openId
  createdAt: Timestamp;          // Upload time
}
```

### incident notes (subcollection of incidents)
```typescript
{
  id: string;                    // Document ID
  content: string;              // Note content
  authorId: string;             // Reference to users.openId
  authorName: string;           // Author display name
  createdAt: Timestamp;          // Note creation
}
```

### statusHistory (subcollection of incidents)
```typescript
{
  id: string;                    // Document ID
  previousStatus?: "pending" | "in_progress" | "resolved";
  newStatus: "pending" | "in_progress" | "resolved";
  notes?: string;                // Status change notes
  updatedBy: string;             // Reference to users.openId
  createdAt: Timestamp;          // Status change time
}
```

### notifications
```typescript
{
  id: string;                    // Document ID
  userId: string;               // Reference to users.openId
  incidentId?: string;           // Related incident ID
  title: string;                // Notification title
  body: string;                 // Notification body
  type: string;                 // Notification type/category
  isRead: boolean;              // Read status
  createdAt: Timestamp;          // Notification creation
}
```

## Indexes

### Composite Indexes
- `users`: by `openId`, by `email`
- `incidents`: by `reporterId`, by `status`, by `priority`, by `createdAt`
- `notifications`: by `userId`, by `isRead`, by `createdAt`

### Subcollection Queries
- Incident media: Query by `createdAt` desc
- Incident notes: Query by `createdAt` desc  
- Status history: Query by `createdAt` desc

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Anyone can read incidents, only authenticated users can create
    match /incidents/{incidentId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      
      // Subcollections - only authenticated users
      match /media/{mediaId} {
        allow read, write: if request.auth != null;
      }
      match /notes/{noteId} {
        allow read, write: if request.auth != null;
      }
      match /statusHistory/{historyId} {
        allow read, write: if request.auth != null;
      }
    }
    
    // Notifications - user-specific
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

## Data Flow

1. **User Registration**: Create user document with role assignment
2. **Incident Creation**: Create incident document + optional media subcollection
3. **Status Updates**: Add to statusHistory subcollection, update incident status
4. **Responder Actions**: Add notes to subcollection, update assignments
5. **Notifications**: Create notification documents for relevant users
