import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getFirestore } from "../firebase";
import * as crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "emergency-salt-2024").digest("hex");
}

export const authRouter = router({
  // Register a new user
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        password: z.string().min(6),
        userRole: z.enum(["civilian", "responder"]),
        phoneNumber: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getFirestore();

      // Check if email already exists
      const existing = await db.collection("users").where("email", "==", input.email).limit(1).get();
      if (!existing.empty) {
        throw new Error("An account with this email already exists");
      }

      const hashedPassword = hashPassword(input.password);
      const userId = crypto.randomUUID();

      const userData = {
        id: userId,
        openId: `local_${userId}`,
        name: input.name,
        email: input.email,
        passwordHash: hashedPassword,
        userRole: input.userRole,
        role: "user",
        phoneNumber: input.phoneNumber || null,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastSignedIn: FieldValue.serverTimestamp(),
      };

      await db.collection("users").doc(userId).set(userData);

      return {
        success: true,
        user: {
          id: userId,
          openId: userData.openId,
          name: input.name,
          email: input.email,
          userRole: input.userRole,
          role: "user",
          lastSignedIn: new Date(),
        },
      };
    }),

  // Login with email + password
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getFirestore();
      const hashedPassword = hashPassword(input.password);

      const snapshot = await db.collection("users").where("email", "==", input.email).limit(1).get();
      if (snapshot.empty) {
        throw new Error("No account found with this email");
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      if (userData.passwordHash !== hashedPassword) {
        throw new Error("Incorrect password");
      }

      // Update last signed in
      await userDoc.ref.update({ lastSignedIn: FieldValue.serverTimestamp() });

      return {
        success: true,
        user: {
          id: userDoc.id,
          openId: userData.openId,
          name: userData.name,
          email: userData.email,
          userRole: userData.userRole,
          role: userData.role,
          lastSignedIn: new Date(),
        },
      };
    }),

  // Get current user profile
  me: protectedProcedure.query(async ({ ctx }) => {
    const db = getFirestore();
    // ctx.user.id is the Firestore doc ID stored as openId in legacy format
    // For Firestore users, we look up by openId
    const snapshot = await db.collection("users").where("openId", "==", ctx.user.openId).limit(1).get();
    if (snapshot.empty) return ctx.user;
    const data = snapshot.docs[0].data();
    return { ...data, id: snapshot.docs[0].id };
  }),

  // Update user role
  updateRole: protectedProcedure
    .input(z.object({ userRole: z.enum(["civilian", "responder"]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getFirestore();
      const snapshot = await db.collection("users").where("openId", "==", ctx.user.openId).limit(1).get();
      if (!snapshot.empty) {
        await snapshot.docs[0].ref.update({ userRole: input.userRole, updatedAt: FieldValue.serverTimestamp() });
      }
      return { success: true };
    }),

  // Logout
  logout: protectedProcedure.mutation(async () => {
    // In a real app, you might invalidate tokens or clear sessions
    // For now, just return success as the client handles token removal
    return { success: true };
  }),
});
