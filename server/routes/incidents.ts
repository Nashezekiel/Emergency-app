import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getFirestore, getStorage } from "../firebase";
import { FieldValue } from "firebase-admin/firestore";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

// Helper: classify incident using Gemini LLM
async function classifyIncident(description: string, incidentType: string): Promise<{
  priority: "low" | "medium" | "high" | "critical";
  classification: string;
}> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            'You are an emergency response AI that classifies incidents. Respond ONLY with a valid JSON object like: {"priority":"critical","classification":"summary"}. Priority must be one of: low, medium, high, critical.',
        },
        {
          role: "user",
          content: `Classify this emergency: Type="${incidentType}", Description="${description}"`,
        },
      ],
      outputSchema: {
        name: "incident_classification",
        schema: {
          type: "object",
          properties: {
            priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
            classification: { type: "string" },
          },
          required: ["priority", "classification"],
        },
      },
    });

    const text =
      typeof result.choices[0].message.content === "string"
        ? result.choices[0].message.content
        : JSON.stringify(result.choices[0].message.content);

    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        priority: parsed.priority || "medium",
        classification: parsed.classification || "Emergency incident",
      };
    }
  } catch (err) {
    console.warn("[ML] Classification failed, using defaults:", err);
  }
  return { priority: "medium", classification: "Emergency incident" };
}

export const incidentsRouter = router({
  // Create a new incident report
  create: protectedProcedure
    .input(
      z.object({
        incidentType: z.enum(["medical", "fire", "crime", "other"]),
        description: z.string().min(10).max(2000),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        address: z.string().optional(),
        isPanicAlert: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getFirestore();

      // ML Classification
      let priority: "low" | "medium" | "high" | "critical" = input.isPanicAlert ? "critical" : "medium";
      let mlClassification: string | null = null;

      if (!input.isPanicAlert) {
        try {
          const classification = await classifyIncident(input.description, input.incidentType);
          priority = classification.priority;
          mlClassification = classification.classification;
        } catch {
          // Fallback silently
        }
      } else {
        mlClassification = "PANIC ALERT - Immediate response required";
      }

      const incidentData = {
        reporterId: ctx.user.openId,
        reporterName: ctx.user.name || "Unknown",
        incidentType: input.incidentType,
        description: input.description,
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        address: input.address || null,
        status: "pending",
        priority,
        isPanicAlert: input.isPanicAlert,
        mlClassification,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        resolvedAt: null,
      };

      const docRef = await db.collection("incidents").add(incidentData);

      // Automated alert for critical/panic incidents
      // NOTE: Notification is fire-and-forget — failures must NEVER block the incident save
      if (priority === "critical" || input.isPanicAlert) {
        try {
          const alertType = input.isPanicAlert ? "🚨 PANIC ALERT" : "🔴 CRITICAL INCIDENT";
          notifyOwner({
            title: `${alertType} - ${input.incidentType.toUpperCase()}`,
            content: `A new ${alertType} has been reported.\n\nType: ${input.incidentType}\nDescription: ${input.description}\nLocation: ${input.address || `${input.latitude}, ${input.longitude}` || "Unknown"}\nAI Classification: ${mlClassification}`,
          }).catch((e) => {
            console.warn("[Notification] Failed to notify owner:", e?.message ?? e);
          });
        } catch (e) {
          console.warn("[Notification] Error setting up notification:", e);
        }
      }

      return { success: true, id: docRef.id };
    }),

  // Get incident by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getFirestore();
      const doc = await db.collection("incidents").doc(input.id).get();
      if (!doc.exists) throw new Error("Incident not found");
      const data = doc.data()!;
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
        // Ensure all required fields are present with defaults
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        address: data.address || null,
        status: data.status || "pending",
        priority: data.priority || "medium",
        isPanicAlert: data.isPanicAlert || false,
        incidentType: data.incidentType || "other",
        description: data.description || "",
        reporterId: data.reporterId || "",
        reporterName: data.reporterName || "Unknown",
        mlClassification: data.mlClassification || null
      };
    }),

  // Get civilian's own incidents
  getMyCivilianIncidents: protectedProcedure.query(async ({ ctx }) => {
    const db = getFirestore();
    let snapshot: FirebaseFirestore.QuerySnapshot;
    try {
      snapshot = await db
        .collection("incidents")
        .where("reporterId", "==", ctx.user.openId)
        .orderBy("createdAt", "desc")
        .get();
    } catch (error: any) {
      // Fallback when a composite index is not available yet in Firestore.
      snapshot = await db.collection("incidents").where("reporterId", "==", ctx.user.openId).get();
    }

    return snapshot.docs
      .map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
        // Ensure all required fields are present with defaults
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        address: data.address || null,
        status: data.status || "pending",
        priority: data.priority || "medium",
        isPanicAlert: data.isPanicAlert || false,
        incidentType: data.incidentType || "other",
        description: data.description || "",
        reporterId: data.reporterId || "",
        reporterName: data.reporterName || "Unknown",
        mlClassification: data.mlClassification || null
      };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }),

  // Get all incidents for responder dashboard
  getResponderDashboard: protectedProcedure
    .input(
      z.object({
        status: z.enum(["all", "pending", "in_progress", "resolved"]).optional(),
        priority: z.enum(["all", "low", "medium", "high", "critical"]).optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = getFirestore();
      let query: FirebaseFirestore.Query = db.collection("incidents");

      if (input.status && input.status !== "all") {
        query = query.where("status", "==", input.status);
      }
      if (input.priority && input.priority !== "all") {
        query = query.where("priority", "==", input.priority);
      }

      query = query.orderBy("createdAt", "desc").limit(input.limit);

      let snapshot: FirebaseFirestore.QuerySnapshot;
      try {
        snapshot = await query.get();
      } catch (error: any) {
        // Fallback query path when Firestore composite index is missing.
        let fallbackQuery: FirebaseFirestore.Query = db.collection("incidents");
        if (input.status && input.status !== "all") {
          fallbackQuery = fallbackQuery.where("status", "==", input.status);
        }
        if (input.priority && input.priority !== "all") {
          fallbackQuery = fallbackQuery.where("priority", "==", input.priority);
        }
        snapshot = await fallbackQuery.limit(input.limit).get();
      }

      return snapshot.docs
        .map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          // Ensure all required fields are present with defaults
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          address: data.address || null,
          status: data.status || "pending",
          priority: data.priority || "medium",
          isPanicAlert: data.isPanicAlert || false,
          incidentType: data.incidentType || "other",
          description: data.description || "",
          reporterId: data.reporterId || "",
          reporterName: data.reporterName || "Unknown",
          mlClassification: data.mlClassification || null
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }),

  // Update incident status
  updateStatus: protectedProcedure
    .input(
      z.object({
        incidentId: z.string(),
        newStatus: z.enum(["pending", "in_progress", "resolved"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getFirestore();
      const incidentRef = db.collection("incidents").doc(input.incidentId);
      const incidentDoc = await incidentRef.get();

      if (!incidentDoc.exists) throw new Error("Incident not found");
      const incident = incidentDoc.data()!;

      // Add to status history subcollection
      await incidentRef.collection("statusHistory").add({
        previousStatus: incident.status,
        newStatus: input.newStatus,
        notes: input.notes || null,
        updatedBy: ctx.user.openId,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Update incident
      await incidentRef.update({
        status: input.newStatus,
        updatedAt: FieldValue.serverTimestamp(),
        resolvedAt: input.newStatus === "resolved" ? FieldValue.serverTimestamp() : incident.resolvedAt,
      });

      // Notification
      const statusLabel = input.newStatus === "in_progress" ? "In Progress" : input.newStatus === "resolved" ? "Resolved ✅" : "Pending";
      notifyOwner({
        title: `Incident Status Update`,
        content: `Incident (${incident.incidentType}) status changed: ${incident.status} → ${statusLabel}\n${input.notes ? `Notes: ${input.notes}` : ""}`,
      }).catch(() => { });

      return { success: true };
    }),

  // Update incident priority
  updatePriority: protectedProcedure
    .input(
      z.object({
        incidentId: z.string(),
        priority: z.enum(["low", "medium", "high", "critical"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getFirestore();
      await db.collection("incidents").doc(input.incidentId).update({
        priority: input.priority,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { success: true };
    }),

  // Delete incident (and related subcollections)
  delete: protectedProcedure
    .input(
      z.object({
        incidentId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getFirestore();
      const incidentRef = db.collection("incidents").doc(input.incidentId);
      const incidentDoc = await incidentRef.get();

      if (!incidentDoc.exists) {
        throw new Error("Incident not found");
      }

      const incident = incidentDoc.data()!;
      const isOwner = incident.reporterId === ctx.user.openId;
      const isResponder = ctx.user.userRole === "responder";

      if (!isOwner && !isResponder) {
        throw new Error("You do not have permission to delete this incident");
      }

      const [notesSnapshot, statusHistorySnapshot, mediaSnapshot] = await Promise.all([
        incidentRef.collection("notes").get(),
        incidentRef.collection("statusHistory").get(),
        incidentRef.collection("media").get(),
      ]);

      const batch = db.batch();
      notesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      statusHistorySnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      mediaSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      batch.delete(incidentRef);
      await batch.commit();

      return { success: true };
    }),

  // Add note to incident
  addNote: protectedProcedure
    .input(
      z.object({
        incidentId: z.string(),
        content: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getFirestore();
      await db.collection("incidents").doc(input.incidentId).collection("notes").add({
        content: input.content,
        authorId: ctx.user.openId,
        authorName: ctx.user.name || "Responder",
        createdAt: FieldValue.serverTimestamp(),
      });
      return { success: true };
    }),

  // Get incident notes
  getNotes: protectedProcedure
    .input(z.object({ incidentId: z.string() }))
    .query(async ({ input }) => {
      const db = getFirestore();
      const snapshot = await db.collection("incidents").doc(input.incidentId).collection("notes")
        .orderBy("createdAt", "desc")
        .get();
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          // Notes specific fields
          content: data.content || "",
          authorId: data.authorId || "",
          authorName: data.authorName || "Unknown"
        };
      });
    }),

  // Get case history
  getCaseHistory: protectedProcedure
    .input(z.object({ incidentId: z.string() }))
    .query(async ({ input }) => {
      const db = getFirestore();
      const snapshot = await db.collection("incidents").doc(input.incidentId).collection("statusHistory")
        .orderBy("createdAt", "desc")
        .get();
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          // Status history specific fields
          previousStatus: data.previousStatus || null,
          newStatus: data.newStatus || "pending",
          notes: data.notes || null,
          updatedBy: data.updatedBy || ""
        };
      });
    }),

  // Upload media and attach to incident
  uploadMedia: protectedProcedure
    .input(
      z.object({
        incidentId: z.string(),
        fileBase64: z.string(),
        fileType: z.enum(["photo", "video"]),
        fileName: z.string(),
        mimeType: z.string().default("image/jpeg"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const storage = getStorage();
      const db = getFirestore();

      // Upload to Firebase Storage
      const buffer = Buffer.from(input.fileBase64, "base64");
      const storageKey = `incidents/${input.incidentId}/${Date.now()}_${input.fileName}`;
      const file = storage.bucket().file(storageKey);

      await file.save(buffer, {
        metadata: { contentType: input.mimeType },
        public: true,
      });

      const url = `https://storage.googleapis.com/${storage.bucket().name}/${storageKey}`;

      // Save to Firestore subcollection
      await db.collection("incidents").doc(input.incidentId).collection("media").add({
        fileUrl: url,
        fileType: input.fileType,
        fileName: input.fileName,
        fileSize: buffer.length,
        uploadedBy: ctx.user.openId,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { success: true, url };
    }),

  // Get media for incident
  getMedia: protectedProcedure
    .input(z.object({ incidentId: z.string() }))
    .query(async ({ input }) => {
      const db = getFirestore();
      const snapshot = await db.collection("incidents").doc(input.incidentId).collection("media")
        .orderBy("createdAt", "desc")
        .get();
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          // Media specific fields
          fileUrl: data.fileUrl || "",
          fileType: data.fileType || "photo",
          fileName: data.fileName || "",
          fileSize: data.fileSize || 0,
          uploadedBy: data.uploadedBy || ""
        };
      });
    }),

  // Search incidents
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const db = getFirestore();
      const snapshot = await db.collection("incidents")
        .orderBy("createdAt", "desc")
        .limit(input.limit)
        .get();

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          // Ensure all required fields are present with defaults
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          address: data.address || null,
          status: data.status || "pending",
          priority: data.priority || "medium",
          isPanicAlert: data.isPanicAlert || false,
          incidentType: data.incidentType || "other",
          description: data.description || "",
          reporterId: data.reporterId || "",
          reporterName: data.reporterName || "Unknown",
          mlClassification: data.mlClassification || null
        };
      });
    }),
});
