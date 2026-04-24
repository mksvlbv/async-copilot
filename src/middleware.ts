import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
          headers?: Record<string, string>,
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
          if (headers) {
            Object.entries(headers).forEach(([key, value]) => {
              supabaseResponse.headers.set(key, String(value));
            });
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user && pathname.startsWith("/app")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";

    const next = `${pathname}${request.nextUrl.search}`;
    if (next && next !== "/login") {
      url.searchParams.set("next", next);
    }

    return redirectWithCookies(url, supabaseResponse);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return redirectWithCookies(url, supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

function redirectWithCookies(url: URL, sourceResponse: NextResponse) {
  const response = NextResponse.redirect(url);

  sourceResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    response.cookies.set(name, value, options);
  });

  sourceResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "content-length") {
      response.headers.set(key, value);
    }
  });

  return response;
}
