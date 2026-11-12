import { redirect } from "next/navigation";

export default function Page() {
  redirect("/audits?tab=seo");
}
