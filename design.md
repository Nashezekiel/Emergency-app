# Emergency Response System - Mobile App Design

## Overview
The Emergency Response System is a dual-role mobile application serving two distinct user types: **Civilians** (reporting emergencies) and **Responders** (managing incidents). The app prioritizes quick incident reporting, real-time location sharing, and efficient incident management.

## Screen List

### Civilian Interface
1. **Home Screen** - Quick access to reporting options and recent incident status
2. **Incident Report Form** - Structured form for detailed incident reporting
3. **Panic Alert Screen** - One-tap emergency alert with automatic location
4. **Media Upload Screen** - Attach photos/videos as evidence
5. **Status Tracking Screen** - View real-time updates on reported incidents
6. **Incident Details Screen** - View full details and history of a specific incident
7. **Settings Screen** - User preferences and account settings

### Responder Interface
1. **Dashboard Screen** - Real-time view of all incoming alerts and incidents
2. **Incident List Screen** - Filterable/sortable list of incidents by priority
3. **Incident Detail Screen** - Full incident information with map and response tools
4. **Live Map Screen** - Map view showing all incident locations with navigation
5. **Coordination Screen** - Add notes, assign responders, update incident status
6. **Case History Screen** - Complete action history for an incident
7. **Settings Screen** - Responder preferences and account settings

## Primary Content and Functionality

### Civilian Interface

**Home Screen**
- Hero section with "Report Emergency" button (prominent, red accent)
- "Panic Alert" quick-tap button (large, accessible)
- Recent incidents card showing last 3 reported incidents with status badges
- Quick stats: "1 Active", "3 Resolved"

**Incident Report Form**
- Emergency type selector (Medical, Fire, Crime, Other) with icons
- Description text area (placeholder: "Describe what happened...")
- Location field (auto-populated from GPS, editable)
- Optional multimedia section (photo/video upload)
- Submit button with loading state
- Form validation with inline error messages

**Panic Alert Screen**
- Large countdown timer (5 seconds) before alert is sent
- Cancel button (in case of accidental tap)
- "Sending to emergency services..." message
- Auto-includes current GPS location and phone number
- Confirmation screen after alert sent

**Media Upload Screen**
- Photo/video preview thumbnail
- File size indicator
- Upload progress bar
- Retry/replace options

**Status Tracking Screen**
- List of reported incidents with status badges (Pending, In Progress, Resolved)
- Each card shows: incident type, time reported, current status, responder name
- Tap to view full details
- Real-time status updates with visual indicators

**Incident Details Screen**
- Incident type and description
- Location map with marker
- Timeline of status updates
- Responder information (name, contact)
- Attached media gallery
- Chat/notes section for civilian-responder communication

### Responder Interface

**Dashboard Screen**
- High-priority incidents at top (red alert badges)
- Incident cards showing: type, location, time reported, status
- Filter buttons: All, High Priority, In Progress, Pending
- Quick stats: "5 Active", "12 Today", "2 Critical"
- Notification bell with unread count

**Incident List Screen**
- Sortable columns: Priority, Type, Location, Time, Status
- Color-coded priority indicators (Red=Critical, Orange=High, Yellow=Medium)
- Swipe-to-action: Assign, Update Status, View Details
- Search/filter bar at top

**Incident Detail Screen**
- Split view: Left side map, right side details
- Incident info: Type, description, reporter contact
- Location with "Get Directions" button
- Attached media gallery
- Current status and assigned responders

**Live Map Screen**
- Map showing all incident locations with color-coded markers
- Marker clustering for dense areas
- Tap marker to see incident preview
- "Get Directions" button for selected incident
- Legend showing priority colors

**Coordination Screen**
- Incident summary at top
- Responder assignment section (add/remove responders)
- Status update dropdown (Pending, In Progress, Resolved)
- Notes section with timestamp and responder name
- Add note input field with send button

**Case History Screen**
- Timeline view of all actions taken
- Entries show: timestamp, action type, responder name, details
- Expandable entries for full details
- Export/print option

## Key User Flows

### Civilian: Report Emergency
1. User taps "Report Emergency" on Home
2. Incident Report Form loads with auto-populated location
3. User selects emergency type (Medical, Fire, Crime, Other)
4. User enters description
5. User optionally uploads photo/video
6. User taps "Submit"
7. Confirmation screen shows incident ID and estimated response time
8. User redirected to Status Tracking screen

### Civilian: Panic Alert
1. User taps "Panic Alert" button (or holds for 3 seconds)
2. Countdown timer appears (5 seconds to cancel)
3. If not cancelled, alert sent with GPS location
4. Confirmation: "Alert sent to emergency services"
5. Responders immediately see high-priority incident on dashboard

### Responder: Manage Incident
1. Responder sees incident on Dashboard
2. Taps incident to view details
3. Assigns responders to incident
4. Updates status to "In Progress"
5. Adds coordination notes
6. Uses "Get Directions" to navigate to location
7. Updates status to "Resolved" when complete
8. Case History automatically records all actions

### Responder: Track Multiple Incidents
1. Responder views Dashboard with all incidents
2. Uses filters to show only "High Priority" incidents
3. Taps Live Map to visualize all locations
4. Selects incident from map
5. Gets directions to nearest high-priority incident
6. Manages incident and returns to dashboard

## Color Choices

| Color | Usage | Hex |
|-------|-------|-----|
| **Emergency Red** | Panic button, critical alerts, high-priority incidents | #EF4444 |
| **Alert Orange** | Medium-priority incidents, warnings | #F59E0B |
| **Success Green** | Resolved incidents, confirmations | #22C55E |
| **Primary Blue** | Primary buttons, links, accents | #0a7ea4 |
| **Background** | Screen backgrounds (light: #ffffff, dark: #151718) | - |
| **Surface** | Cards, elevated surfaces (light: #f5f5f5, dark: #1e2022) | - |
| **Text Primary** | Main text (light: #11181C, dark: #ECEDEE) | - |
| **Text Secondary** | Secondary text (light: #687076, dark: #9BA1A6) | - |
| **Border** | Dividers, borders (light: #E5E7EB, dark: #334155) | - |

## Navigation Structure

- **Tab Bar (Civilian)**: Home, Report, Status, Settings
- **Tab Bar (Responder)**: Dashboard, Map, Coordination, Settings
- **Role-based routing**: App detects user role at login and shows appropriate interface

## Accessibility Considerations

- Large touch targets (minimum 44x44 points) for all interactive elements
- High contrast text (WCAG AA compliant)
- One-handed usage: critical buttons (Panic, Report, Submit) positioned in lower half of screen
- Haptic feedback on button taps (light impact)
- Clear loading states and error messages
- Voice-over compatible labels for all interactive elements
