import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ThemePicker, LanguageToggle } from "./ThemePicker";

interface HeaderProps {
  /** Extra elements rendered between the branding and the language/theme toggles */
  children?: ReactNode;
  /** Content rendered below the nav bar but still inside the header (e.g. progress bar) */
  bottomSlot?: ReactNode;
  /** Additional CSS classes for the header element */
  className?: string;
}

/**
 * Shared sticky header with iSAQB branding, language toggle, and theme picker.
 * On non-start pages, branding links back to /.
 * Pass children to insert page-specific controls (timer, flag button, etc.) before the toggles.
 */
export function Header({ children, bottomSlot, className = "" }: HeaderProps) {
  const [location, navigate] = useLocation();
  const isStartPage = location === "/";

  return (
    <header
      className={`sticky top-0 z-40 bg-bg/80 backdrop-blur-lg border-b border-border ${className}`}
    >
      <div className="max-w-4xl mx-auto px-4">
        <div className="h-14 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="font-heading font-bold text-lg hover:text-primary transition-colors cursor-pointer"
          >
            Mock Exam
          </button>
          <div className="flex items-center gap-1.5 sm:gap-3">
            {children}
            <LanguageToggle />
            <ThemePicker />
          </div>
        </div>
        {bottomSlot}
      </div>
    </header>
  );
}

interface PageLayoutProps {
  /** Page content */
  children: ReactNode;
  /** Optional extra className on the root div */
  className?: string;
  /** Optional header className (e.g. print:hidden) */
  headerClassName?: string;
  /** Extra header controls (timer, flag button, etc.) */
  headerChildren?: ReactNode;
  /** Content below the header bar within the <header> element (e.g. progress bar) */
  headerSlot?: ReactNode;
}

/**
 * Shared page layout: sticky header + scrollable content area.
 * Provides consistent structure across all pages.
 */
export function PageLayout({
  children,
  className = "",
  headerClassName = "",
  headerChildren,
  headerSlot,
}: PageLayoutProps) {
  return (
    <div className={`min-h-dvh flex flex-col ${className}`}>
      <Header className={headerClassName} bottomSlot={headerSlot}>
        {headerChildren}
      </Header>
      {children}
    </div>
  );
}
