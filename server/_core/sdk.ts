import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { ForbiddenError } from "../../shared/_core/errors.js";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { getFirestore } from "../firebase";
import { FieldValue } from "firebase-admin/firestore";
import { ENV } from "./env";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";

// User type backed by Firestore
export type FirestoreUser = {
  id: string;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: string;
  userRole: "civilian" | "responder" | null;
  lastSignedIn: Date;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {}

  private decodeState(state: string): string {
    return atob(state);
  }

  async getTokenByCode(code: string, state: string): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };
    const { data } = await this.client.post<ExchangeTokenResponse>(EXCHANGE_TOKEN_PATH, payload);
    return data;
  }

  async getUserInfoByToken(token: ExchangeTokenResponse): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(GET_USER_INFO_PATH, {
      accessToken: token.accessToken,
    });
    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({ baseURL: ENV.oAuthServerUrl, timeout: AXIOS_TIMEOUT_MS });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(platforms: unknown, fallback: string | null | undefined): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(platforms.filter((p): p is string => typeof p === "string"));
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE")) return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  async exchangeCodeForToken(code: string, state: string): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({ accessToken } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod((data as any)?.platforms, (data as any)?.platform ?? data.platform ?? null);
    return { ...(data as any), platform: loginMethod, loginMethod } as GetUserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) return new Map<string, string>();
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSessionToken(openId: string, options: { expiresInMs?: number; name?: string } = {}): Promise<string> {
    return this.signSession({ openId, appId: ENV.appId, name: options.name || "" }, options);
  }

  async signSession(payload: SessionPayload, options: { expiresInMs?: number } = {}): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({ openId: payload.openId, appId: payload.appId, name: payload.name })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(cookieValue: string | undefined | null): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) return null;
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, { algorithms: ["HS256"] });
      const { openId, appId, name } = payload as Record<string, unknown>;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) return null;
      return { openId, appId, name };
    } catch {
      return null;
    }
  }

  async getUserInfoWithJwt(jwtToken: string): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = { jwtToken, projectId: ENV.appId };
    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(GET_USER_INFO_WITH_JWT_PATH, payload);
    const loginMethod = this.deriveLoginMethod((data as any)?.platforms, (data as any)?.platform ?? data.platform ?? null);
    return { ...(data as any), platform: loginMethod, loginMethod } as GetUserInfoWithJwtResponse;
  }

  async authenticateRequest(req: Request): Promise<FirestoreUser> {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token: string | undefined;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }

    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = token || cookies.get(COOKIE_NAME);

    // Dev mock sessions (for testing without real auth)
    if (sessionCookie?.startsWith("mock_session_")) {
      const role = sessionCookie.replace("mock_session_", "") as "civilian" | "responder";
      return {
        id: `mock_${role}`,
        openId: `mock_${role}_openid`,
        name: role === "responder" ? "Jane Responder" : "John Civilian",
        email: "demo@emergency.app",
        loginMethod: "mock",
        role: "user",
        userRole: role,
        lastSignedIn: new Date(),
      };
    }

    // Firestore email/password session - base64 "email:password" token or "raw:email:password"
    if (sessionCookie && !sessionCookie.includes(".")) {
      try {
        let email: string | undefined;
        let passwordStr: string | undefined;

        if (sessionCookie.startsWith("raw:")) {
          [email, passwordStr] = sessionCookie.replace("raw:", "").split(":");
        } else {
          const decoded = Buffer.from(sessionCookie, "base64").toString("utf-8");
          [email, passwordStr] = decoded.split(":");
        }

        if (email && email.includes("@")) {
          const db = getFirestore();
          const snapshot = await db.collection("users").where("email", "==", email).limit(1).get();
          if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            await snapshot.docs[0].ref.update({ lastSignedIn: FieldValue.serverTimestamp() });
            return {
              id: snapshot.docs[0].id,
              openId: data.openId,
              name: data.name || null,
              email: data.email || null,
              loginMethod: "email",
              role: data.role || "user",
              userRole: data.userRole || null,
              lastSignedIn: new Date(),
            };
          }
        }
      } catch {
        // Fall through to JWT
      }
    }

    // Standard JWT session (web)
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session");
    }

    const db = getFirestore();
    const signedInAt = new Date();
    const snapshot = await db.collection("users").where("openId", "==", session.openId).limit(1).get();

    if (snapshot.empty) {
      // Auto-create from OAuth
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        const userData = {
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? null,
          role: "user",
          userRole: null,
          isActive: true,
          lastSignedIn: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        };
        await db.collection("users").doc(userInfo.openId).set(userData, { merge: true });
        return {
          id: userInfo.openId,
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email || null,
          loginMethod: userInfo.loginMethod || null,
          role: "user",
          userRole: null,
          lastSignedIn: signedInAt,
        };
      } catch (error) {
        console.error("[Auth] Failed to sync user:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    await userDoc.ref.update({ lastSignedIn: FieldValue.serverTimestamp() });

    return {
      id: userDoc.id,
      openId: userData.openId,
      name: userData.name || null,
      email: userData.email || null,
      loginMethod: userData.loginMethod || null,
      role: userData.role || "user",
      userRole: userData.userRole || null,
      lastSignedIn: signedInAt,
    };
  }
}

export const sdk = new SDKServer();
