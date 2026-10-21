/**
 * Turns a release note into a concrete instruction: which file usually has to
 * change and what has to be done there.
 *
 * The release notes say what the React Native team changed, this says what
 * that means for the project that is being upgraded.
 */

export interface ChangeGuidance {
  /** The file that usually has to change. */
  file?: string;
  /** What has to be done there. */
  action: string;
}

const AREA_RULES: Array<{
  match: RegExp;
  file: string;
  action: string;
}> = [
  {
    match: /babel/i,
    file: "babel.config.js",
    action:
      "Update the @react-native/babel-preset options in babel.config.js to match the new template.",
  },
  {
    match: /metro|bundler/i,
    file: "metro.config.js",
    action:
      "Update the metro config, the new template uses @react-native/metro-config.",
  },
  {
    match: /gradle|android/i,
    file: "android/build.gradle",
    action:
      "Update the gradle build, the plugin and the sdk versions moved with the release.",
  },
  {
    match: /hermes/i,
    file: "android/gradle.properties",
    action:
      "Check the hermes flags in android/gradle.properties, they changed with the release.",
  },
  {
    match: /pod|cocoapods|ios/i,
    file: "ios/Podfile",
    action: "Update the Podfile to the version of the new template.",
  },
  {
    match: /codegen/i,
    file: "package.json",
    action:
      "Update the codegenConfig in package.json, the generated code moved.",
  },
  {
    match: /new architecture|fabric|turbo ?module|bridgeless/i,
    file: "android/gradle.properties",
    action:
      "Update the new architecture flags in android/gradle.properties.",
  },
  {
    match: /typescript|type definition/i,
    file: "tsconfig.json",
    action: "Update the tsconfig, the compiler options moved with the release.",
  },
  {
    match: /appdelegate/i,
    file: "ios/AppDelegate.swift",
    action:
      "Update the app delegate, the entry point of the iOS app changed.",
  },
  {
    match: /eslint|prettier|typescript config/i,
    file: "eslint.config.mjs",
    action: "Update the lint configuration to the version of the new template.",
  },
];

const TEXT_RULES: Array<{
  match: RegExp;
  file: string;
  action: string;
}> = [
  {
    match: /inlinePlatform/i,
    file: "babel.config.js",
    action:
      "Add the inlinePlatform option to the babel preset, the option is required now.",
  },
  {
    match: /removed?\b/i,
    file: "",
    action: "Remove the usage of the API that no longer exists.",
  },
  {
    match: /renamed?\b/i,
    file: "",
    action: "Rename the usage of the API to its new name.",
  },
  {
    match: /no longer\b/i,
    file: "",
    action:
      "Update the code that relied on the old behaviour, it works differently now.",
  },
  {
    match: /deprecated\b/i,
    file: "",
    action: "Move the usage to the replacement that the release points at.",
  },
  {
    match: /requires? (a )?(new|higher|node)/i,
    file: "",
    action: "Update the toolchain the release requires.",
  },
];

export function guidanceFor(text: string, area?: string): ChangeGuidance {
  const haystack = `${area ?? ""} ${text}`;

  for (const rule of AREA_RULES) {
    if (rule.match.test(haystack)) {
      return { file: rule.file || undefined, action: rule.action };
    }
  }

  for (const rule of TEXT_RULES) {
    if (rule.match.test(text)) {
      return { file: rule.file || undefined, action: rule.action };
    }
  }

  return {
    action:
      "Search the project for the API that is named in the note and update the usage.",
  };
}
