import { redirect } from "next/navigation";

export default function Page() {
  redirect("/visual/screenshots?tab=compare");
}
