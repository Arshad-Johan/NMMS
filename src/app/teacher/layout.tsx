import { redirect } from "next/navigation";
import { getSession } from "@/lib/cookies";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    redirect("/login");
  }
  return <>{children}</>;
}
