import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = new URL(
    safeNextPath(request.nextUrl.searchParams.get("next")),
    request.url,
  );

  if (!code) {
    destination.pathname = "/login";
    destination.searchParams.set("error", "callback");
    return NextResponse.redirect(destination);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    destination.pathname = "/login";
    destination.search = "";
    destination.searchParams.set("error", "callback");
  }

  return NextResponse.redirect(destination);
}
