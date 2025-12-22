import { Rocket, Github } from "lucide-react";
import Link from "next/link";

export default function Header() {
  return (
    <header className="w-full transition-all">
      <div className="px-6 h-16 flex items-center justify-between pointer-events-none">
        <div className="sticky top-0 left-0 pt-4 z-[60] pointer-events-auto">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                RN Safe Upgrade
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex items-center gap-6 pointer-events-auto">
          <a
            href="https://github.com/heymeowcat/rn-safe-upgrade"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <Github className="w-5 h-5" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
