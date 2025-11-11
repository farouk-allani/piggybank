import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import WalletConnect from "./WalletConnect.tsx";
import { clsx } from "clsx";

interface NavLinkProps {
  to: string;
  children: ReactNode;
}

const NavLink = ({ to, children }: NavLinkProps) => {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={clsx(
        "brut-btn bg-white text-ink-950 no-underline",
        active && "bg-accent-yellow"
      )}
    >
      {children}
    </Link>
  );
};

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-accent-primary/10">
      <header className="sticky top-0 z-50 bg-accent-primary text-ink-950 border-b-3 border-ink-950">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="brut-btn bg-white flex items-center gap-2">
            <img src="/piggybank yellow massa.png" className="w-auto h-6" />{" "}
            PiggyBank
          </Link>
          <nav className="hidden md:flex items-center gap-3">
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/vault/create">Create Vault</NavLink>
            {/* <NavLink to="/vault/multisig/create">Multi-Sig</NavLink> */}
            <NavLink to="/dca/dashboard">DCA</NavLink>
            {/* <NavLink to="/analytics">Analytics</NavLink> */}
            <NavLink to="/about">About</NavLink>
            {/* <NavLink to="/settings">Settings</NavLink> */}
          </nav>
          <div className="ml-auto">
            <WalletConnect />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      <footer className="max-w-6xl mx-auto px-4 py-10">
        <div className="brut-card p-6 bg-white">
          <p className="font-bold">
            Built for Massa DeWeb · Autonomous by design
          </p>
          <p className="text-sm mt-1">
            This app is under developement and working on buildnet network for
            now.
          </p>
        </div>
      </footer>
    </div>
  );
}
