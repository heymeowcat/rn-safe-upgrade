import { UpgradeSessionProvider } from "@/lib/hooks/useUpgradeSession";
import Workspace from "@/components/Workspace";

/**
 * The page is rendered on the server with the version pair that is shown by
 * default, so the first paint already contains the content instead of a
 * placeholder. The data is refreshed in the browser afterwards.
 */
export default function Home() {
  return (
    <UpgradeSessionProvider>
      <Workspace />
    </UpgradeSessionProvider>
  );
}
