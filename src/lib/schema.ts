/**
 * The structured data of the tool. It describes the application, the person
 * behind it and the repository, so a search engine can tell what the page is
 * and who publishes it.
 */
export const SITE_URL = "https://heymeowcat.is-a.dev";
export const APP_URL = `${SITE_URL}/rn-safe-upgrade/`;
export const REPO_URL = "https://github.com/heymeowcat/rn-safe-upgrade";

export function buildSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${SITE_URL}/#person`,
        name: "Vidura Fernando",
        alternateName: "heymeowcat",
        url: `${SITE_URL}/`,
        image: "https://avatars.githubusercontent.com/u/heymeowcat",
        sameAs: [
          "https://github.com/heymeowcat",
          "https://linkedin.com/in/vidura-fernando",
        ],
        jobTitle: "Software Engineer",
        knowsAbout: [
          "React Native",
          "TypeScript",
          "Android",
          "iOS",
          "Developer tooling",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${APP_URL}#website`,
        url: APP_URL,
        name: "RN Safe Upgrade",
        description:
          "An upgrade assistant for React Native that generates the brief, checks the dependencies and applies the upgrade through a local agent bridge.",
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#person` },
      },
      {
        "@type": "WebPage",
        "@id": `${APP_URL}#webpage`,
        url: APP_URL,
        name: "RN Safe Upgrade - React Native upgrade assistant",
        description:
          "Generate the upgrade brief for any React Native version pair, check the compatibility of every dependency and let a local agent apply the upgrade.",
        isPartOf: { "@id": `${APP_URL}#website` },
        about: { "@id": `${APP_URL}#software` },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${APP_URL}#software`,
        name: "RN Safe Upgrade",
        applicationCategory: "DeveloperApplication",
        applicationSubCategory: "React Native tooling",
        operatingSystem: "Any",
        url: APP_URL,
        description:
          "Reads the React Native releases from their sources, builds the upgrade brief, checks the dependencies of a project and applies the upgrade through a local bridge.",
        softwareVersion: "1.0.0",
        featureList: [
          "Upgrade brief generated from the published release notes",
          "Dependency compatibility against the target release",
          "Template diff between two React Native versions",
          "Local agent bridge that applies the upgrade",
          "Export of the plan as Markdown or a patch",
        ],
        author: { "@id": `${SITE_URL}/#person` },
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      {
        "@type": "SoftwareSourceCode",
        "@id": `${REPO_URL}#source`,
        name: "rn-safe-upgrade",
        codeRepository: REPO_URL,
        url: REPO_URL,
        programmingLanguage: ["TypeScript", "JavaScript"],
        runtimePlatform: "Node.js",
        license: "https://opensource.org/licenses/MIT",
        author: { "@id": `${SITE_URL}/#person` },
        application: { "@id": `${APP_URL}#software` },
      },
    ],
  };
}
