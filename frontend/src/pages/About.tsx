import {
  Wallet,
  Shield,
  Zap,
  TrendingUp,
  RefreshCw,
  Waves,
} from "lucide-react";

export default function About() {
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="brut-card bg-gradient-to-r from-yellow-200 to-orange-200 p-8">
        <div className="flex items-center gap-4 mb-4">
          <img
            src="/piggybank yellow massa.png"
            alt="PiggyBank"
            className="w-16 h-16"
          />
          <div>
            <h1 className="text-4xl font-black">PiggyBank</h1>
            <p className="text-lg font-bold text-gray-700">
              Your Autonomous Savings Vault on Massa
            </p>
          </div>
        </div>
        <p className="text-lg">
          PiggyBank is a decentralized savings and investment platform built on
          Massa blockchain. Create autonomous vaults that automatically split
          your deposits across multiple tokens, set up recurring investments, or
          provide liquidity to earn passive income.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="brut-card bg-gradient-to-br from-lime-100 to-green-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-6 h-6" />
            <h3 className="text-xl font-black">Splitter Vaults</h3>
          </div>
          <p className="text-sm">
            Deposit USDC and automatically split it across multiple tokens
            (WMAS, WETH, WBTC) based on your configured percentages. Perfect for
            diversified savings.
          </p>
        </div>

        <div className="brut-card bg-gradient-to-br from-purple-100 to-indigo-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-6 h-6" />
            <h3 className="text-xl font-black">Multi-Sig Vaults</h3>
          </div>
          <p className="text-sm">
            Create shared vaults with family, friends, or team members. Require
            multiple signatures for withdrawals, perfect for joint savings or
            treasury management.
          </p>
        </div>

        <div className="brut-card bg-gradient-to-br from-blue-100 to-cyan-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-6 h-6" />
            <h3 className="text-xl font-black">Auto Deposits</h3>
          </div>
          <p className="text-sm">
            Set up weekly recurring deposits to your vaults. Automation runs
            on-chain via Massa's Autonomous Smart Contracts - no bots or keepers
            needed.
          </p>
        </div>

        <div className="brut-card bg-gradient-to-br from-orange-100 to-red-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-6 h-6" />
            <h3 className="text-xl font-black">DCA Strategies</h3>
          </div>
          <p className="text-sm">
            Dollar Cost Average into any token automatically. Set your amount,
            frequency, and let the smart contract handle the rest. Reduce timing
            risk with systematic investing.
          </p>
        </div>

        <div className="brut-card bg-gradient-to-br from-pink-100 to-purple-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Waves className="w-6 h-6" />
            <h3 className="text-xl font-black">Liquidity Pools</h3>
          </div>
          <p className="text-sm">
            Provide liquidity to earn trading fees. Add your tokens to pools and
            earn passive income from every swap. Withdraw anytime with your
            share of accumulated fees.
          </p>
        </div>

        <div className="brut-card bg-gradient-to-br from-yellow-100 to-amber-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="w-6 h-6" />
            <h3 className="text-xl font-black">EagleFi Integration</h3>
          </div>
          <p className="text-sm">
            All token swaps happen through EagleFi DEX on Massa. Get the best
            rates with low fees and fast execution on the decentralized
            exchange.
          </p>
        </div>
      </div>

      {/* Why Massa Section */}
      <div className="brut-card bg-gradient-to-r from-blue-200 to-purple-200 p-6">
        <h2 className="text-2xl font-black mb-4">Why Massa Blockchain?</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <h4 className="font-bold mb-2">🌐 DeWeb Hosting</h4>
            <p className="text-sm">
              The entire frontend is hosted on-chain via Massa's Decentralized
              Web. No servers, no downtime, truly decentralized.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-2">🤖 Autonomous Smart Contracts</h4>
            <p className="text-sm">
              Set it and forget it. Massa's ASC technology enables true
              automation without relying on external bots or keeper networks.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-2">⚡ Guaranteed Execution</h4>
            <p className="text-sm">
              Deferred calls ensure your automated actions execute on schedule,
              guaranteed by the blockchain itself.
            </p>
          </div>
        </div>
      </div>

      {/* Use Cases */}
      <div className="brut-card bg-white p-6">
        <h2 className="text-2xl font-black mb-4">Perfect For</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-lime-500 mt-2"></div>
              <div>
                <h4 className="font-bold">Individual Savers</h4>
                <p className="text-sm text-gray-600">
                  Automate your savings and build a diversified crypto portfolio
                  effortlessly
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500 mt-2"></div>
              <div>
                <h4 className="font-bold">Families & Couples</h4>
                <p className="text-sm text-gray-600">
                  Create multi-sig vaults for joint savings with shared control
                  and transparency
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
              <div>
                <h4 className="font-bold">DeFi Investors</h4>
                <p className="text-sm text-gray-600">
                  Implement DCA strategies and provide liquidity to maximize
                  returns
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-orange-500 mt-2"></div>
              <div>
                <h4 className="font-bold">DAOs & Teams</h4>
                <p className="text-sm text-gray-600">
                  Manage treasury funds with multi-signature security and
                  automated strategies
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-pink-500 mt-2"></div>
              <div>
                <h4 className="font-bold">Long-term Holders</h4>
                <p className="text-sm text-gray-600">
                  Build positions systematically with automated recurring
                  purchases
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2"></div>
              <div>
                <h4 className="font-bold">Liquidity Providers</h4>
                <p className="text-sm text-gray-600">
                  Earn passive income by providing liquidity to trading pools
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="brut-card bg-white p-6">
        <h2 className="text-2xl font-black mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <details className="brut-card bg-gray-50 p-4">
            <summary className="font-bold cursor-pointer">
              Is PiggyBank fully decentralized?
            </summary>
            <p className="mt-2 text-sm text-gray-700">
              Yes! The entire application is hosted on Massa's DeWeb
              (Decentralized Web), and all smart contracts run autonomously on
              the blockchain. No centralized servers are involved.
            </p>
          </details>

          <details className="brut-card bg-gray-50 p-4">
            <summary className="font-bold cursor-pointer">
              How does automation work without bots?
            </summary>
            <p className="mt-2 text-sm text-gray-700">
              Massa's Autonomous Smart Contracts (ASC) use deferred calls to
              schedule future executions directly on the blockchain. Once set
              up, your automated deposits or DCA strategies run automatically
              without any external services.
            </p>
          </details>

          <details className="brut-card bg-gray-50 p-4">
            <summary className="font-bold cursor-pointer">
              What tokens can I invest in?
            </summary>
            <p className="mt-2 text-sm text-gray-700">
              Currently, you can split deposits across WMAS (Wrapped Massa),
              USDC, WETH (Wrapped Ethereum), and WBTC (Wrapped Bitcoin). All
              swaps happen through EagleFi DEX on Massa.
            </p>
          </details>

          <details className="brut-card bg-gray-50 p-4">
            <summary className="font-bold cursor-pointer">
              Are my funds safe?
            </summary>
            <p className="mt-2 text-sm text-gray-700">
              You maintain full ownership of your vaults and funds. Smart
              contracts are non-custodial, meaning only you (or your multi-sig
              signers) can withdraw funds. The contracts are deployed on Massa
              buildnet for testing.
            </p>
          </details>

          <details className="brut-card bg-gray-50 p-4">
            <summary className="font-bold cursor-pointer">
              What are the fees?
            </summary>
            <p className="mt-2 text-sm text-gray-700">
              You pay standard Massa network gas fees for transactions, plus a
              0.7% swap fee on EagleFi DEX. Automated features require
              additional MAS for deferred call execution (~0.6 MAS per scheduled
              action).
            </p>
          </details>

          <details className="brut-card bg-gray-50 p-4">
            <summary className="font-bold cursor-pointer">
              Can I cancel automated deposits?
            </summary>
            <p className="mt-2 text-sm text-gray-700">
              Yes! You can disable auto-deposits or DCA strategies anytime from
              your vault details page. The automation will stop immediately.
            </p>
          </details>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="brut-card bg-gradient-to-r from-lime-200 to-green-200 p-6 text-center">
        <h2 className="text-2xl font-black mb-2">Ready to Start Saving?</h2>
        <p className="mb-4">
          Create your first vault and start building your crypto portfolio
          today.
        </p>
        <a href="/vault/create" className="brut-btn bg-white inline-block">
          Create Your First Vault
        </a>
      </div>
    </div>
  );
}
