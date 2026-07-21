import JsonLd from "./JsonLd"
import { SITE_URL, absoluteUrl } from "@/lib/seo"

const ORGANIZATION_DESCRIPTION =
  "Handmade anime, gaming, and movie decor from Georgia."

/** Global Organization schema for the homepage (and optionally sitewide). */
export default function OrganizationJsonLd() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Koleqcia",
    url: SITE_URL,
    logo: absoluteUrl("/images/logo.png"),
    description: ORGANIZATION_DESCRIPTION,
    sameAs: [] as string[],
  }

  return <JsonLd data={organizationSchema} />
}
