import { json } from "@/lib/json-response";
import {
  registerUser,
  loginUser,
  logout,
  getCurrentUser,
  validateToken,
  getOAuthConfig,
} from "@/lib/auth";

function getTokenFromHeader(req: Request): string | null {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, password, name } = body;

    if (action === "register") {
      if (!email || !password || !name) {
        return json({ error: "email, password, and name are required" }, 400);
      }
      if (password.length < 6) {
        return json({ error: "Password must be at least 6 characters" }, 400);
      }
      const token = await registerUser(email, password, name);
      return json({
        success: true,
        token: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
      });
    }

    if (action === "login") {
      if (!email || !password) {
        return json({ error: "email and password are required" }, 400);
      }
      const token = await loginUser(email, password);
      return json({
        success: true,
        token: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
      });
    }

    if (action === "logout") {
      logout();
      return json({ success: true, message: "Logged out" });
    }

    return json({ error: "Invalid action. Use: register, login, or logout" }, 400);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal auth error";
    return json({ error: msg }, msg.includes("already exists") ? 409 : 401);
  }
}

export async function GET(req: Request) {
  try {
    const tokenStr = getTokenFromHeader(req);
    if (!tokenStr) {
      return json({ error: "Authorization header required" }, 401);
    }

    const config = getOAuthConfig();
    const payload = validateToken(tokenStr, config.jwtSecret);
    if (!payload) {
      return json({ error: "Invalid or expired token" }, 401);
    }

    // Server-side: get user from in-memory list (we can't use localStorage on server)
    // Return info from the token itself
    const user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      authenticated: true,
    };

    return json({ user });
  } catch {
    return json({ error: "Authentication failed" }, 401);
  }
}