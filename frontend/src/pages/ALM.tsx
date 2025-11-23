import { useAccountStore } from "@massalabs/react-ui-kit";
import { useEffect, useState } from "react";
import {
  approveToken,
  deposit,
  fetchSpotPrice,
  getLiqShares,
  getTotalSupply,
  getVaultTokensDetails,
  TokenDetails,
  withdraw,
} from "../lib/liqManager";
import { AVAILABLE_TOKENS } from "../lib/types";
import {
  Waves,
  RefreshCw,
  TrendingUp,
  Wallet,
  Target,
  DollarSign,
  ArrowDownToLine,
  Sparkles,
  AlertTriangle,
  HandCoins,
  Unlock,
} from "lucide-react";

export default function ALM() {
  const { connectedAccount } = useAccountStore();
  const [spotPrice, setSpotPrice] = useState<string | null>(null);
  const [tokenXDetails, setTokenXDetails] = useState<TokenDetails | null>(null);
  const [tokenYDetails, setTokenYDetails] = useState<TokenDetails | null>(null);
  const [liqShares, setLiqShares] = useState<string | null>(null);
  const [liqSharesRaw, setLiqSharesRaw] = useState<string | null>(null); // Store raw value for calculations
  const [totalSupply, setTotalSupply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Deposit form state
  const [depositAmountX, setDepositAmountX] = useState("");
  const [depositAmountY, setDepositAmountY] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);

  // Withdraw form state
  const [withdrawShares, setWithdrawShares] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // Get token logo from AVAILABLE_TOKENS
  const getTokenLogo = (symbol: string): string => {
    const token = AVAILABLE_TOKENS.find((t) => t.symbol === symbol);
    return token?.logo || "https://via.placeholder.com/40";
  };

  const initFetches = async (showRefreshing = false) => {
    if (!connectedAccount) {
      console.log("⚠️ initFetches - No connected account");
      return;
    }

    console.log("🔄 initFetches - Starting data fetch...");

    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      console.log(
        "📊 Fetching liquidity shares, spot price, and token details..."
      );

      const [liqSharesData, priceData, vaultTokensDetails, totalSupplyData] =
        await Promise.all([
          getLiqShares(connectedAccount),
          fetchSpotPrice(connectedAccount),
          getVaultTokensDetails(connectedAccount),
          getTotalSupply(connectedAccount),
        ]);

      console.log("✅ Data fetched:");
      console.log("  - Liquidity Shares:", liqSharesData);
      console.log("  - Spot Price:", priceData);
      console.log("  - Token Details:", vaultTokensDetails);
      console.log("  - Total Supply:", totalSupplyData);

      if (vaultTokensDetails.length >= 2) {
        setLiqShares(liqSharesData.formatted);
        setLiqSharesRaw(liqSharesData.raw);
        setTotalSupply(totalSupplyData);
        setSpotPrice(priceData);
        setTokenXDetails(vaultTokensDetails[0]);
        setTokenYDetails(vaultTokensDetails[1]);
        console.log("✅ State updated successfully");
      } else {
        console.warn("⚠️ Insufficient token details:", vaultTokensDetails);
      }
    } catch (error) {
      console.error("❌ Error fetching pool data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeposit = async () => {
    if (!connectedAccount || !tokenXDetails || !tokenYDetails) {
      return;
    }

    if (
      !depositAmountX ||
      !depositAmountY ||
      parseFloat(depositAmountX) <= 0 ||
      parseFloat(depositAmountY) <= 0
    ) {
      return;
    }

    setDepositLoading(true);

    try {
      await approveToken(connectedAccount, tokenXDetails, depositAmountX);
      await approveToken(connectedAccount, tokenYDetails, depositAmountY);

      const result = await deposit(
        connectedAccount,
        depositAmountX,
        depositAmountY,
        tokenXDetails.decimals,
        tokenYDetails.decimals
      );

      console.log("💰 Deposit result:", result);

      if (result.success) {
        console.log(
          "✅ Deposit successful! Clearing form and refreshing data..."
        );
        setDepositAmountX("");
        setDepositAmountY("");

        // Wait a bit for blockchain to update
        console.log("⏳ Waiting 2 seconds before refreshing...");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        await initFetches(true);
      } else {
        console.error("❌ Deposit failed:", result.error);
      }
    } catch (error) {
      console.error("Error during deposit:", error);
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (
      !connectedAccount ||
      !withdrawShares ||
      parseFloat(withdrawShares) <= 0
    ) {
      return;
    }

    setWithdrawLoading(true);

    try {
      const result = await withdraw(
        connectedAccount,
        parseFloat(withdrawShares)
      );

      if (result.success) {
        setWithdrawShares("");
        await initFetches(true);
      }
    } catch (error) {
      console.error("Error during withdrawal:", error);
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleMaxShares = () => {
    if (liqShares && liqSharesRaw) {
      // Use the full precision value
      const formatted = (Number(liqSharesRaw) / 1e18).toFixed(18);
      setWithdrawShares(formatted);
    }
  };

  useEffect(() => {
    initFetches();
  }, [connectedAccount]);

  if (!connectedAccount) {
    return (
      <div className="space-y-6">
        <div className="brut-card bg-yellow-100 p-6 text-center">
          <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-gray-700">
            Please connect your Massa wallet to access the Automated Liquidity
            Manager.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="brut-card bg-white p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
          </div>
          <p className="text-gray-600 mt-4">Loading pool data...</p>
        </div>
      </div>
    );
  }

  // Calculate actual share of pool
  const shareOfPool =
    liqSharesRaw && totalSupply && BigInt(totalSupply) > 0
      ? ((Number(liqSharesRaw) / Number(totalSupply)) * 100).toFixed(2)
      : "0";
  const hasLiquidity = liqShares && parseFloat(liqShares) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="brut-card bg-gradient-to-r from-purple-200 to-pink-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl border-3 border-ink-950">
                <Waves className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-black">
                  Automated Liquidity Manager
                </h1>
                <p className="text-sm text-gray-700 mt-1">
                  Provide liquidity and earn fees from automated market making
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => initFetches(true)}
            className="brut-btn bg-white flex items-center gap-2"
            disabled={refreshing}
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* First-time user banner */}
      {!hasLiquidity && (
        <div className="brut-card bg-gradient-to-r from-yellow-100 to-orange-100 p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-white rounded-xl border-3 border-ink-950">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black mb-2">Welcome to ALM!</h3>
              <p className="text-gray-700 mb-3">
                You haven't provided liquidity yet. Add both tokens below to
                start earning fees from swaps in this pool.
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="brut-btn bg-white text-sm px-3 py-1 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Earn Trading Fees
                </span>
                <span className="brut-btn bg-white text-sm px-3 py-1 flex items-center gap-1">
                  <RefreshCw className="w-4 h-4" />
                  Automated Market Making
                </span>
                <span className="brut-btn bg-white text-sm px-3 py-1 flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  Passive Income
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pool Overview */}
      <div className="brut-card bg-gradient-to-br from-purple-100 to-blue-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Waves className="w-6 h-6" />
            <h2 className="text-xl font-bold">Liquidity Pool</h2>
          </div>
          <div className="flex items-center gap-2">
            {tokenXDetails && (
              <div className="flex items-center gap-2 brut-btn bg-white px-4 py-2 shadow-lg">
                <img
                  src={getTokenLogo(tokenXDetails.symbol)}
                  alt={tokenXDetails.symbol}
                  className="w-7 h-7 rounded-full border-2 border-ink-950"
                  onError={(e) => {
                    e.currentTarget.src = "https://via.placeholder.com/28";
                  }}
                />
                <span className="font-bold text-lg">
                  {tokenXDetails.symbol}
                </span>
              </div>
            )}
            <span className="text-3xl font-bold">⇄</span>
            {tokenYDetails && (
              <div className="flex items-center gap-2 brut-btn bg-white px-4 py-2 shadow-lg">
                <img
                  src={getTokenLogo(tokenYDetails.symbol)}
                  alt={tokenYDetails.symbol}
                  className="w-7 h-7 rounded-full border-2 border-ink-950"
                  onError={(e) => {
                    e.currentTarget.src = "https://via.placeholder.com/28";
                  }}
                />
                <span className="font-bold text-lg">
                  {tokenYDetails.symbol}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="brut-card bg-white p-5 hover:translate-y-[-2px] transition-transform">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <p className="text-sm font-bold text-gray-600">Current Price</p>
            </div>
            <p className="text-3xl font-black text-purple-600">
              {spotPrice ? parseFloat(spotPrice).toFixed(6) : "0.000000"}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {tokenXDetails?.symbol} per {tokenYDetails?.symbol}
            </p>
          </div>

          <div className="brut-card bg-white p-5 hover:translate-y-[-2px] transition-transform">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-bold text-gray-600">Your Liquidity</p>
            </div>
            {liqShares && parseFloat(liqShares) > 0 ? (
              parseFloat(liqShares) < 0.0001 ? (
                <div>
                  <p className="text-2xl font-black text-blue-600">
                    {parseFloat(liqShares)
                      .toFixed(12)
                      .replace(/\.?0+$/, "")}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    LP Tokens (small amount)
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-3xl font-black text-blue-600">
                    {parseFloat(liqShares).toFixed(4)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">LP Tokens</p>
                </div>
              )
            ) : (
              <div>
                <p className="text-3xl font-black text-blue-600">0.0000</p>
                <p className="text-xs text-gray-500 mt-2">LP Tokens</p>
              </div>
            )}
          </div>

          <div className="brut-card bg-white p-5 hover:translate-y-[-2px] transition-transform">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-green-600" />
              <p className="text-sm font-bold text-gray-600">Share of Pool</p>
            </div>
            <p className="text-3xl font-black text-green-600">{shareOfPool}%</p>
            <p className="text-xs text-gray-500 mt-2">Your contribution</p>
          </div>
        </div>
      </div>

      {/* Main Actions Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Deposit Section */}
        <div className="brut-card bg-gradient-to-br from-green-50 to-lime-50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <HandCoins className="w-8 h-8" />
            <h3 className="text-2xl font-black">Add Liquidity</h3>
          </div>

          <div className="space-y-4">
            {/* Token X Input */}
            <div className="brut-card bg-white p-4">
              <label className="block">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold">
                    {tokenXDetails?.symbol || "Token X"} Amount
                  </span>
                  {tokenXDetails && (
                    <div className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded-lg">
                      <img
                        src={getTokenLogo(tokenXDetails.symbol)}
                        alt={tokenXDetails.symbol}
                        className="w-5 h-5 rounded-full"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://via.placeholder.com/20";
                        }}
                      />
                      <span className="text-sm font-bold text-gray-700">
                        {tokenXDetails.symbol}
                      </span>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={depositAmountX}
                    onChange={(e) => setDepositAmountX(e.target.value)}
                    placeholder="0.0"
                    className="w-full border-3 border-ink-950 rounded-xl p-4 text-2xl font-black pr-16"
                    min="0"
                    step="0.01"
                  />
                  {tokenXDetails && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <img
                        src={getTokenLogo(tokenXDetails.symbol)}
                        alt={tokenXDetails.symbol}
                        className="w-8 h-8 rounded-full border-2 border-ink-950"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://via.placeholder.com/32";
                        }}
                      />
                    </div>
                  )}
                </div>
              </label>
            </div>

            {/* Token Y Input */}
            <div className="brut-card bg-white p-4">
              <label className="block">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold">
                    {tokenYDetails?.symbol || "Token Y"} Amount
                  </span>
                  {tokenYDetails && (
                    <div className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded-lg">
                      <img
                        src={getTokenLogo(tokenYDetails.symbol)}
                        alt={tokenYDetails.symbol}
                        className="w-5 h-5 rounded-full"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://via.placeholder.com/20";
                        }}
                      />
                      <span className="text-sm font-bold text-gray-700">
                        {tokenYDetails.symbol}
                      </span>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={depositAmountY}
                    onChange={(e) => setDepositAmountY(e.target.value)}
                    placeholder="0.0"
                    className="w-full border-3 border-ink-950 rounded-xl p-4 text-2xl font-black pr-16"
                    min="0"
                    step="0.01"
                  />
                  {tokenYDetails && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <img
                        src={getTokenLogo(tokenYDetails.symbol)}
                        alt={tokenYDetails.symbol}
                        className="w-8 h-8 rounded-full border-2 border-ink-950"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://via.placeholder.com/32";
                        }}
                      />
                    </div>
                  )}
                </div>
              </label>
            </div>

            <button
              onClick={handleDeposit}
              disabled={
                !depositAmountX ||
                !depositAmountY ||
                parseFloat(depositAmountX) <= 0 ||
                parseFloat(depositAmountY) <= 0 ||
                depositLoading
              }
              className="w-full brut-btn bg-lime-300 disabled:bg-gray-300 disabled:cursor-not-allowed text-lg py-4 flex items-center justify-center gap-2"
            >
              {depositLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <HandCoins className="w-5 h-5" />
                  Add Liquidity
                </>
              )}
            </button>

            <div className="text-xs text-gray-600 space-y-1 mt-3">
              <p>• Provide both tokens</p>
              <p>• You'll receive LP tokens representing your share</p>
              <p>• Earn fees from all swaps in this pool</p>
            </div>
          </div>
        </div>

        {/* Withdraw Section */}
        <div className="brut-card bg-gradient-to-br from-orange-50 to-yellow-50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowDownToLine className="w-8 h-8" />
            <h3 className="text-2xl font-black">Remove Liquidity</h3>
          </div>

          <div className="space-y-4">
            {/* LP Shares Display */}
            <div className="brut-card bg-blue-50 p-4">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-bold">Your LP Tokens:</span>
                  <div className="text-right">
                    <span className="text-lg font-black text-blue-600 block">
                      {liqShares
                        ? parseFloat(liqShares) < 0.0001
                          ? parseFloat(liqShares)
                              .toFixed(12)
                              .replace(/\.?0+$/, "")
                          : parseFloat(liqShares).toFixed(4)
                        : "0.0000"}
                    </span>
                    {liqShares &&
                      parseFloat(liqShares) > 0 &&
                      parseFloat(liqShares) < 0.0001 && (
                        <span className="text-xs text-gray-600">
                          (very small amount)
                        </span>
                      )}
                  </div>
                </div>
              </div>
            </div>

            {/* Shares Input */}
            <div className="brut-card bg-white p-4">
              <label className="block">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold">LP Tokens to Remove</span>
                  <button
                    onClick={handleMaxShares}
                    className="brut-btn bg-blue-200 px-3 py-1 text-sm"
                    disabled={!liqShares || parseFloat(liqShares) === 0}
                  >
                    MAX
                  </button>
                </div>
                <input
                  type="number"
                  value={withdrawShares}
                  onChange={(e) => setWithdrawShares(e.target.value)}
                  placeholder="0.0"
                  className="w-full border-3 border-ink-950 rounded-xl p-4 text-2xl font-black"
                  min="0"
                  step="0.01"
                  max={liqShares || "0"}
                />
              </label>
            </div>

            {/* Percentage Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((percent) => (
                <button
                  key={percent}
                  onClick={() => {
                    if (liqShares && liqSharesRaw) {
                      // Use raw value for calculation to avoid precision loss
                      const rawAmount = BigInt(liqSharesRaw);
                      const percentAmount =
                        (rawAmount * BigInt(percent)) / BigInt(100);
                      // Convert back to formatted string with 18 decimals
                      const formatted = (Number(percentAmount) / 1e18).toFixed(
                        18
                      );
                      setWithdrawShares(formatted);
                    }
                  }}
                  className="brut-btn bg-purple-100 text-sm py-2"
                  disabled={!liqShares || parseFloat(liqShares) === 0}
                >
                  {percent}%
                </button>
              ))}
            </div>

            <button
              onClick={handleWithdraw}
              disabled={
                !withdrawShares ||
                parseFloat(withdrawShares) <= 0 ||
                !liqShares ||
                parseFloat(withdrawShares) > parseFloat(liqShares) ||
                withdrawLoading
              }
              className="w-full brut-btn bg-orange-300 disabled:bg-gray-300 disabled:cursor-not-allowed text-lg py-4 flex items-center justify-center gap-2"
            >
              {withdrawLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Unlock className="w-5 h-5" />
                  Remove Liquidity
                </>
              )}
            </button>

            <div className="text-xs text-gray-600 space-y-1 mt-3">
              <p>• Burn LP tokens to withdraw your liquidity</p>
              <p>• You'll receive both tokens proportionally</p>
              <p>• Includes your share of accumulated fees</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="brut-card bg-gradient-to-br from-green-50 to-emerald-50 p-6">
          <h3 className="font-black text-lg mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> How It Works
          </h3>
          <ul className="text-sm space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">1.</span>
              <span>Deposit equal value of both tokens to the pool</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">2.</span>
              <span>Receive LP tokens representing your pool share</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">3.</span>
              <span>Earn fees from every swap in the pool</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">4.</span>
              <span>Withdraw anytime by burning your LP tokens</span>
            </li>
          </ul>
        </div>

        <div className="brut-card bg-gradient-to-br from-yellow-50 to-orange-50 p-6">
          <h3 className="font-black text-lg mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Important Notes
          </h3>
          <ul className="text-sm space-y-2">
            <li className="flex items-start gap-2">
              <div className="mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-600"></div>
              </div>
              <span>Impermanent loss may occur with price changes</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-600"></div>
              </div>
              <span>Always provide liquidity in the correct ratio</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-600"></div>
              </div>
              <span>Two approvals required for deposits</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-600"></div>
              </div>
              <span>Gas fees apply to all transactions</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
