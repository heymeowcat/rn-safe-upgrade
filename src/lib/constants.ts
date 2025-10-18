export const DEFAULT_APP_NAME = "RnSafeUpgradeApp";
export const DEFAULT_APP_PACKAGE = "com.rnsafeupgradeapp";

export const PACKAGE_NAMES = {
  RN: "react-native",
  RNM: "react-native-macos",
  RNW: "react-native-windows",
} as const;

export const RN_DIFF_REPOSITORIES = {
  [PACKAGE_NAMES.RN]: "react-native-community/rn-diff-purge",
  [PACKAGE_NAMES.RNM]: "microsoft/react-native-macos",
  [PACKAGE_NAMES.RNW]: "microsoft/react-native-windows",
} as const;

export const RN_CHANGELOG_URLS = {
  [PACKAGE_NAMES.RN]:
    "https://github.com/facebook/react-native/blob/main/CHANGELOG.md",
  [PACKAGE_NAMES.RNM]:
    "https://github.com/microsoft/react-native-macos/releases/tag/",
  [PACKAGE_NAMES.RNW]:
    "https://github.com/microsoft/react-native-windows/releases/tag/react-native-windows_",
} as const;
