import { Link } from "react-router-dom";
import BentoCard from "../components/BentoCard.tsx";

export default function Landing() {
  return (
    <div className="space-y-8">
      <section className="brut-card bg-white p-8 grid md:grid-cols-2 gap-6 items-center">
        <div>
          <h1 className="text-4xl md:text-6xl font-black leading-tight">
            Automate Your Savings,{" "}
            <span className="underline decoration-ink-950 decoration-8">
              Forever
            </span>
            .
          </h1>
          <p className="mt-4 text-lg">
            Create autonomous vaults powered by Massa's Autonomous Smart
            Contracts. Deposit USDC and automatically split it across multiple
            tokens. No bots. No keepers. Just code that runs.
          </p>
          <div className="mt-6 flex gap-3 flex-wrap">
            <Link to="/vault/create" className="brut-btn bg-lime-300">
              Launch Vault
            </Link>
            <Link to="/dca/create" className="brut-btn bg-blue-300">
              Create DCA
            </Link>
            <Link to="/alm" className="brut-btn bg-purple-300">
              Liquidity Pool
            </Link>
            {/* <Link to="/dashboard" className="brut-btn bg-yellow-300">
              View Dashboard
            </Link> */}
          </div>
          <p className="mt-3 text-sm">Deployed on DeWeb ·</p>
        </div>
        <div className="relative">
          <div className="brut-card bg-accent-primary p-6">
            <img
              src="/piggybank yellow massa.png"
              width={200}
              className="mx-auto"
            />
            <p className="font-bold mt-2">
              Your autonomous savings vault on Massa blockchain.
            </p>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-4">
        <BentoCard title="Autonomous Savings" bg="#FD5A46">
          <p>Set once. Runs forever with Deferred Calls.</p>
        </BentoCard>
        <BentoCard title="Liquidity Pools" bg="#C084FC">
          <p>
            Provide liquidity and earn fees from automated market making.
            Passive income from trading activity.
          </p>
        </BentoCard>
        <BentoCard title="DCA Strategies" bg="#84CC16">
          <p>
            Automate your investments with Dollar Cost Averaging. Buy assets at
            regular intervals.
          </p>
        </BentoCard>
        <BentoCard title="Splitter Vaults" bg="#F59E0B">
          <p>
            Deposit USDC and automatically split into MAS, ETH, and more via
            EagleFi DEX.
          </p>
        </BentoCard>
      </section>

      <section className="brut-card bg-white p-8">
        <h2 className="text-3xl font-black">Why Massa?</h2>
        <ul className="list-disc pl-6 mt-4 font-semibold">
          <li>No IPFS or servers — DeWeb hosts the app.</li>
          <li>Autonomous Smart Contracts mean no Gelato/Chainlink.</li>
          <li>Fully trustless savings automation.</li>
        </ul>
      </section>
    </div>
  );
}
