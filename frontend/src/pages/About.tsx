export default function About() {
  return (
    <div className="space-y-6">
      <div className="brut-card bg-white p-6">
        <h1 className="text-3xl font-black">About Massa Piggybank</h1>
        <p className="mt-2">
          Autonomous micro‑savings powered by Massa's Autonomous Smart Contracts
          (ASC) and DeWeb frontends. Deposit USDC and automatically split it across
          multiple tokens based on your configured percentages.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="brut-card bg-lime-200 p-6">
          <h3 className="text-xl font-black">Why Massa?</h3>
          <ul className="list-disc pl-6 mt-2">
            <li>DeWeb: UI on‑chain, no servers.</li>
            <li>ASC: automation without keepers.</li>
            <li>Guaranteed execution via deferred calls.</li>
          </ul>
        </div>
        <div className="brut-card bg-yellow-200 p-6">
          <h3 className="text-xl font-black">Use Cases</h3>
          <ul className="list-disc pl-6 mt-2">
            <li>DCA strategies on autopilot using USDC</li>
            <li>Automated portfolio rebalancing</li>
            <li>Split purchases across MAS, ETH, BTC (via WETH, WMAS)</li>
            <li>Savings with time‑locks and splits</li>
          </ul>
        </div>
      </div>
      <div className="brut-card bg-white p-6">
        <h3 className="text-xl font-black">FAQ</h3>
        <details className="mt-3">
          <summary className="font-bold">Is this fully on‑chain?</summary>
          <p>Demo UI yes; wire contracts to go end‑to‑end decentralized.</p>
        </details>
        <details className="mt-3">
          <summary className="font-bold">Can it run without me?</summary>
          <p>
            Yes — that’s the point of ASC. Once deployed, it runs autonomously.
          </p>
        </details>
      </div>
    </div>
  );
}
