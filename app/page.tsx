import { HomePage } from "@/components/home-page"
import { getPublicClinic, whatsappHref } from "@/lib/clinic"

export default function Page() {
  const clinic = getPublicClinic()
  return <HomePage whatsappHref={whatsappHref(clinic)} />
}
