import { redirect } from "next/navigation";
import { getSession } from "@/lib/cookies";

export default async function BrteLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "brte") redirect("/login");
  return <>{children}</>;
}
