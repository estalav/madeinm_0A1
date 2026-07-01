import { redirect } from "next/navigation";

export const metadata = {
  title: "Art | Estala",
  description: "Redirecting to estala.com.",
};

export default function ArtPage() {
  redirect("https://estala.com");
}
