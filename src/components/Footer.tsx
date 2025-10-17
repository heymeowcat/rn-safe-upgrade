import { Github, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 mt-20">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
              About
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              A tool to help React Native developers safely upgrade dependencies
              with automatic compatibility checking.
            </p>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Resources
            </h3>
            <ul className="space-y-2">
              <FooterLink href="https://reactnative.dev/docs/upgrading">
                RN Upgrade Guide
              </FooterLink>
              <FooterLink href="https://react-native-community.github.io/upgrade-helper/">
                Upgrade Helper
              </FooterLink>
              <FooterLink href="https://reactnative.directory">
                RN Directory
              </FooterLink>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Connect
            </h3>
            <a
              href="https://github.com/heymeowcat/rn-safe-upgrade"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <Github className="w-5 h-5" />
              View on GitHub
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600 dark:text-gray-400">
          <p className="flex items-center gap-2">
            Made with <Heart className="w-4 h-4 text-red-500 fill-current" />{" "}
            for the RN community
          </p>
          <p>© {new Date().getFullYear()} RN Safe Upgrade</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        {children}
      </a>
    </li>
  );
}
