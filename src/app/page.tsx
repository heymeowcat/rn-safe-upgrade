import { UpgradeSessionProvider } from "@/lib/hooks/useUpgradeSession";
import Workspace from "@/components/Workspace";

export default function Home() {
  return (
    <UpgradeSessionProvider>
      <Workspace />
    </UpgradeSessionProvider>
  );
}
