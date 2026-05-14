import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "./_components/admin-shell";

export const dynamic = "force-dynamic";

const SIDEBAR_COOKIE = "speetch_admin_sidebar_collapsed";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin");
  }

  // Lecture du cookie côté serveur → pas de flash à l'hydratation.
  const cookieStore = await cookies();
  const initialCollapsed =
    cookieStore.get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <AdminShell
      email={user.email ?? "Session active"}
      initialCollapsed={initialCollapsed}
    >
      {children}
    </AdminShell>
  );
}
