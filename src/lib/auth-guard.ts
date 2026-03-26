import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logAction } from "./audit";

/**
 * Verifies that the request comes from an authenticated user.
 * Returns the user ID if authenticated, or a 401 NextResponse if not.
 *
 * @param request - Optional Request object. When provided, failed auth
 *                  attempts are logged with IP/user-agent for security monitoring.
 */
export async function requireAuth(request?: Request): Promise<
  { userId: string } | { error: NextResponse }
> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored in read-only context
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Audit: log failed authentication attempt with IP/user-agent
    logAction({
      userId: "anonymous",
      action: "failed_auth",
      request,
      metadata: {
        path: request?.url ? new URL(request.url).pathname : "unknown",
      },
    });

    return {
      error: NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  return { userId: user.id };
}
