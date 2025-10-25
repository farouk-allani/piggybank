import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAccountStore } from "@massalabs/react-ui-kit";
import Stepper from "../components/Stepper.tsx";
import { AVAILABLE_TOKENS, WMAS_TOKEN_ADDRESS } from "../lib/types";
import { startDCA, approveTokenForDCA, getUserTokenBalance } from "../lib/dca";
import {
  validateTokenPath,
  validateInterval,
  validateSlippage,
  WMAS_ADDRESS,
  USDC_ADDRESS,
} from "../lib/dca-types";

// Time unit options - DUSA Protocol requires minimum 1 hour
const TIME_UNITS = [
  { label: "Hours", value: 3600, min: 1, max: 23 }, // 1-23 hours
  { label: "Days", value: 86400, min: 1, max: 60 }, // 1-60 days
  { label: "Weeks", value: 604800, min: 1, max: 8 }, // 1-8 weeks
];

export default function CreateDCA() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userBalanceFrom, setUserBalanceFrom] = useState("0");

  // DCA Configuration - Token Selection
  const [tokenFrom, setTokenFrom] = useState(AVAILABLE_TOKENS[1].address); // USDC default
  const [tokenTo, setTokenTo] = useState(AVAILABLE_TOKENS[0].address); // WMAS default

  // DCA Configuration - Amounts and Timing
  const [amountPerTrade, setAmountPerTrade] = useState("");
  const [intervalValue, setIntervalValue] = useState("1");
  const [intervalUnit, setIntervalUnit] = useState(1); // Days by default (index 1, since we removed Minutes)
  const [hasEndTime, setHasEndTime] = useState(false);
  const [numberOfTrades, setNumberOfTrades] = useState("10");
  const [slippageTolerance, setSlippageTolerance] = useState("2"); // 2% default (must be > 1% per DUSA)
  const [useMoreGas, setUseMoreGas] = useState(false);
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  const { connectedAccount } = useAccountStore();
  const navigate = useNavigate();
  const fromDropdownRef = useRef<HTMLDivElement>(null);
  const toDropdownRef = useRef<HTMLDivElement>(null);

  // Get token info
  const getTokenInfo = (address: string) => {
    return AVAILABLE_TOKENS.find((t) => t.address === address);
  };

  const tokenFromInfo = getTokenInfo(tokenFrom);
  const tokenToInfo = getTokenInfo(tokenTo);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        fromDropdownRef.current &&
        !fromDropdownRef.current.contains(event.target as Node)
      ) {
        setShowFromDropdown(false);
      }
      if (
        toDropdownRef.current &&
        !toDropdownRef.current.contains(event.target as Node)
      ) {
        setShowToDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate interval in seconds
  const intervalInSeconds =
    parseInt(intervalValue || "0") * TIME_UNITS[intervalUnit].value;

  // Fetch user balance when token changes
  useEffect(() => {
    const fetchBalance = async () => {
      if (connectedAccount && tokenFrom) {
        const balance = await getUserTokenBalance(
          connectedAccount,
          connectedAccount.address,
          tokenFrom
        );
        setUserBalanceFrom(balance);
      }
    };
    fetchBalance();
  }, [connectedAccount, tokenFrom]);

  // Calculate total investment
  const totalInvestment =
    amountPerTrade && numberOfTrades && hasEndTime
      ? (parseFloat(amountPerTrade) * parseInt(numberOfTrades)).toFixed(6)
      : hasEndTime
      ? (
          parseFloat(amountPerTrade || "0") * parseInt(numberOfTrades || "0")
        ).toFixed(6)
      : "Unlimited (until stopped)";

  // Calculate estimated duration
  const estimatedDuration =
    hasEndTime && numberOfTrades && intervalValue
      ? (() => {
          const totalSeconds = intervalInSeconds * parseInt(numberOfTrades);
          const days = Math.floor(totalSeconds / 86400);
          const hours = Math.floor((totalSeconds % 86400) / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);

          if (days > 0) return `${days} day${days > 1 ? "s" : ""}`;
          if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
          if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
          return "Less than 1 minute";
        })()
      : "Infinite (until manual stop)";

  // Validation
  const isValidTokenPair = tokenFrom !== tokenTo;
  const isValidAmount = parseFloat(amountPerTrade || "0") > 0;
  const isValidInterval =
    parseInt(intervalValue || "0") >= TIME_UNITS[intervalUnit].min &&
    parseInt(intervalValue || "0") <= TIME_UNITS[intervalUnit].max;
  const isValidTrades = !hasEndTime || parseInt(numberOfTrades || "0") > 0;
  const isValidSlippage = parseFloat(slippageTolerance || "0") > 1; // Must be > 1% per DUSA
  const hasBalanceForFirst =
    parseFloat(amountPerTrade || "0") <= parseFloat(userBalanceFrom);
  const isNotMAS = tokenFrom !== WMAS_TOKEN_ADDRESS; // MAS must be wrapped first
  const isValidConfig =
    isValidTokenPair &&
    isValidAmount &&
    isValidInterval &&
    isValidTrades &&
    isValidSlippage &&
    hasBalanceForFirst &&
    isNotMAS;

  const handleCreateDCA = async () => {
    if (!connectedAccount || !isValidConfig) {
      return;
    }

    setLoading(true);

    try {
      // Build token path (max 4 tokens per DUSA)
      const tokenPath = [tokenFrom, tokenTo];

      // Validate token path according to DUSA requirements
      try {
        validateTokenPath(tokenPath);
        validateInterval(intervalInSeconds);
        validateSlippage(parseFloat(slippageTolerance));
      } catch (validationError: any) {
        alert(validationError.message);
        setLoading(false);
        return;
      }

      // Approve total amount if has end time, otherwise approve a large amount
      const approvalAmount = hasEndTime
        ? (parseFloat(amountPerTrade) * parseInt(numberOfTrades)).toString()
        : (parseFloat(amountPerTrade) * 1000).toString(); // Approve for ~1000 trades for infinite

      const approveResult = await approveTokenForDCA(
        connectedAccount,
        tokenFrom,
        approvalAmount
      );

      if (!approveResult.success) {
        setLoading(false);
        return;
      }

      // Calculate parameters
      // DUSA expects interval in milliseconds, not seconds
      const intervalMilliseconds = BigInt(intervalInSeconds * 1000);
      const executions = hasEndTime ? BigInt(numberOfTrades) : BigInt(999999); // Large number for infinite
      const threshold = BigInt(Math.floor(parseFloat(slippageTolerance) * 100)); // Convert % to basis points

      // Calculate MAS needed: ~0.6 MAS per trade for deferred execution + gas (per DUSA docs)
      const masPerTrade = 0.6;
      const totalMasNeeded = hasEndTime
        ? (masPerTrade * parseInt(numberOfTrades)).toString()
        : (masPerTrade * 100).toString(); // For infinite DCAs, send enough for 100 trades initially

      console.log(
        `Sending ${totalMasNeeded} MAS for ${
          hasEndTime ? numberOfTrades : "100"
        } trades`
      );

      const result = await startDCA(
        connectedAccount,
        amountPerTrade,
        intervalMilliseconds,
        executions,
        tokenPath,
        threshold,
        useMoreGas,
        0n, // Start immediately
        totalMasNeeded
      );

      if (result.success) {
        console.log("DCA created successfully:", result.dcaId);
        navigate("/dca/dashboard");
      }
    } catch (err) {
      console.error("Error creating DCA:", err);
    } finally {
      setLoading(false);
    }
  };

  const next = () => setStep((s) => Math.min(2, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="brut-card bg-white p-6 max-w-4xl">
      <h1 className="text-3xl font-black mb-4">Create DCA Strategy</h1>
      <Stepper steps={["Token Pair", "Configure", "Review"]} current={step} />

      {/* Step 1: Select Token Pair */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="brut-card bg-blue-50 p-4">
            <h3 className="font-bold mb-2">
              💡 What is Dollar Cost Averaging?
            </h3>
            <p className="text-sm">
              DCA is an automated investment strategy where you buy a fixed
              amount of an asset at regular intervals, regardless of price. This
              helps reduce the impact of volatility by averaging your entry
              price over time.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* From Token */}
            <div>
              <label className="block mb-2">
                <span className="font-bold text-lg">From Token (Pay With)</span>
              </label>

              <div className="relative" ref={fromDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowFromDropdown(!showFromDropdown);
                    setShowToDropdown(false);
                  }}
                  className="w-full brut-card bg-white p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  {tokenFromInfo && (
                    <div className="flex items-center space-x-3">
                      <img
                        src={tokenFromInfo.logo}
                        alt={tokenFromInfo.symbol}
                        className="w-8 h-8 rounded-full"
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                      <div className="text-left">
                        <div className="font-bold text-lg">
                          {tokenFromInfo.symbol}
                        </div>
                        <div className="text-sm text-gray-600">
                          {tokenFromInfo.name}
                        </div>
                      </div>
                    </div>
                  )}
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showFromDropdown && (
                  <div className="absolute z-50 w-full mt-2 brut-card bg-white max-h-74 overflow-y-auto">
                    {AVAILABLE_TOKENS.map((token) => (
                      <button
                        key={token.address}
                        type="button"
                        onClick={() => {
                          setTokenFrom(token.address);
                          setShowFromDropdown(false);
                        }}
                        className={`w-full p-3 flex items-center space-x-3 hover:bg-lime-200 transition-colors border-b-3 border-ink-950 last:border-b-0 ${
                          tokenFrom === token.address ? "bg-lime-100" : ""
                        }`}
                      >
                        <img
                          src={token.logo}
                          alt={token.symbol}
                          className="w-8 h-8 rounded-full"
                          onError={(e) =>
                            (e.currentTarget.style.display = "none")
                          }
                        />
                        <div className="text-left flex-1">
                          <div className="font-bold">{token.symbol}</div>
                          <div className="text-sm text-gray-600">
                            {token.name}
                          </div>
                        </div>
                        {tokenFrom === token.address && (
                          <svg
                            className="w-5 h-5 text-lime-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* {tokenFromInfo && connectedAccount && (
                <div className="mt-3 p-3 bg-lime-50 rounded-xl border-2 border-lime-300">
                  <div className="text-sm">
                    <span className="text-gray-600">Your Balance: </span>
                    <span className="font-bold">
                      {userBalanceFrom} {tokenFromInfo.symbol}
                    </span>
                  </div>
                </div>
              )} */}
            </div>

            {/* To Token */}
            <div>
              <label className="block mb-2">
                <span className="font-bold text-lg">To Token (Buy)</span>
              </label>

              <div className="relative" ref={toDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowToDropdown(!showToDropdown);
                    setShowFromDropdown(false);
                  }}
                  className="w-full brut-card bg-white p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  {tokenToInfo && (
                    <div className="flex items-center space-x-3">
                      <img
                        src={tokenToInfo.logo}
                        alt={tokenToInfo.symbol}
                        className="w-8 h-8 rounded-full"
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                      <div className="text-left">
                        <div className="font-bold text-lg">
                          {tokenToInfo.symbol}
                        </div>
                        <div className="text-sm text-gray-600">
                          {tokenToInfo.name}
                        </div>
                      </div>
                    </div>
                  )}
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showToDropdown && (
                  <div className="absolute z-50 w-full mt-2 brut-card bg-white max-h-74 overflow-y-auto">
                    {AVAILABLE_TOKENS.map((token) => (
                      <button
                        key={token.address}
                        type="button"
                        onClick={() => {
                          setTokenTo(token.address);
                          setShowToDropdown(false);
                        }}
                        className={`w-full p-3 flex items-center space-x-3 hover:bg-blue-200 transition-colors border-b-3 border-ink-950 last:border-b-0 ${
                          tokenTo === token.address ? "bg-blue-100" : ""
                        }`}
                      >
                        <img
                          src={token.logo}
                          alt={token.symbol}
                          className="w-8 h-8 rounded-full"
                          onError={(e) =>
                            (e.currentTarget.style.display = "none")
                          }
                        />
                        <div className="text-left flex-1">
                          <div className="font-bold">{token.symbol}</div>
                          <div className="text-sm text-gray-600">
                            {token.name}
                          </div>
                        </div>
                        {tokenTo === token.address && (
                          <svg
                            className="w-5 h-5 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* {tokenToInfo && (
                <div className="mt-3 p-3 bg-blue-50 rounded-xl border-2 border-blue-300">
                  <p className="text-xs text-gray-600">
                    You will accumulate this token
                  </p>
                </div>
              )} */}
            </div>
          </div>

          {!isValidTokenPair && (
            <div className="brut-card bg-red-100 border-red-500 p-4">
              <p className="text-red-700 font-bold">
                ⚠️ Please select different tokens. You cannot swap a token to
                itself.
              </p>
            </div>
          )}

          {!isNotMAS && (
            <div className="brut-card bg-yellow-100 border-yellow-500 p-4">
              <p className="text-yellow-800 font-bold">
                ⚠️ MAS tokens must be wrapped to WMAS before creating a DCA.
                Please wrap your MAS first.
              </p>
            </div>
          )}

          <div className="brut-card bg-yellow-50 p-4">
            <h4 className="font-bold mb-2">
              💰 Fee Information (DUSA Protocol)
            </h4>
            <ul className="text-sm space-y-1">
              <li>
                • <strong>0.7%</strong> swap fee per trade
              </li>
              <li>
                • <strong>~0.6 MAS</strong> gas fee per trade (for deferred
                execution)
              </li>
              <li>• Fees are automatically deducted from each trade</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 2: Configure DCA Parameters */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block mb-2">
              <span className="font-bold">Amount Per Trade</span>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={amountPerTrade}
                  onChange={(e) => setAmountPerTrade(e.target.value)}
                  className="flex-1 border-3 border-ink-950 rounded-2xl p-3"
                  placeholder={`Amount in ${tokenFromInfo?.symbol}`}
                />
                <div className="brut-btn bg-gray-100 pointer-events-none">
                  {tokenFromInfo?.symbol}
                </div>
              </div>
            </label>
            {!hasBalanceForFirst && parseFloat(amountPerTrade || "0") > 0 && (
              <p className="text-sm text-red-600 mt-1">
                ⚠️ Insufficient balance for first trade
              </p>
            )}
          </div>

          <div>
            <label className="block mb-2">
              <span className="font-bold">Trade Frequency</span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <input
                  type="number"
                  min={TIME_UNITS[intervalUnit].min}
                  max={TIME_UNITS[intervalUnit].max}
                  value={intervalValue}
                  onChange={(e) => setIntervalValue(e.target.value)}
                  className="col-span-1 border-3 border-ink-950 rounded-2xl p-3"
                  placeholder="Value"
                />
                <select
                  value={intervalUnit}
                  onChange={(e) => {
                    setIntervalUnit(parseInt(e.target.value));
                    setIntervalValue("1"); // Reset to 1 when changing unit
                  }}
                  className="col-span-2 border-3 border-ink-950 rounded-2xl p-3"
                >
                  {TIME_UNITS.map((unit, index) => (
                    <option key={index} value={index}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <p className="text-xs text-gray-600 mt-1">
              Valid range: {TIME_UNITS[intervalUnit].min} -{" "}
              {TIME_UNITS[intervalUnit].max}{" "}
              {TIME_UNITS[intervalUnit].label.toLowerCase()}
              <span className="block text-amber-600 font-semibold mt-1">
                ⚠️ Contract minimum: 1 day (86400 seconds) - DCA is for
                long-term strategies
              </span>
              {!isValidInterval && (
                <span className="text-red-600 block font-semibold mt-1">
                  ⚠️ Interval must be between {TIME_UNITS[intervalUnit].min} and{" "}
                  {TIME_UNITS[intervalUnit].max}
                </span>
              )}
            </p>
          </div>

          <div className="brut-card bg-gray-50 p-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <div className="relative flex-shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={hasEndTime}
                  onChange={(e) => setHasEndTime(e.target.checked)}
                  className="sr-only peer"
                />
                <div
                  className={`w-6 h-6 border-3 border-ink-950 rounded-lg transition-all ${
                    hasEndTime ? "bg-lime-300" : "bg-white"
                  }`}
                >
                  {hasEndTime && (
                    <svg
                      className="w-full h-full p-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={4}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg">
                  Want to specify an end time?
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {hasEndTime
                    ? "DCA will stop after a specific number of trades"
                    : "DCA will run indefinitely until you manually stop it"}
                </div>
              </div>
            </label>
          </div>

          {hasEndTime && (
            <div>
              <label className="block mb-2">
                <span className="font-bold">Number of Trades</span>
                <input
                  type="number"
                  min="1"
                  value={numberOfTrades}
                  onChange={(e) => setNumberOfTrades(e.target.value)}
                  className="mt-1 w-full border-3 border-ink-950 rounded-2xl p-3"
                  placeholder="How many trades to execute"
                />
              </label>
              <p className="text-xs text-gray-600 mt-1">
                Total trades that will be executed before DCA stops
              </p>
            </div>
          )}

          <div>
            <label className="block mb-2">
              <span className="font-bold">Slippage Tolerance (%)</span>
              <input
                type="number"
                step="0.1"
                min="1.1"
                max="50"
                value={slippageTolerance}
                onChange={(e) => setSlippageTolerance(e.target.value)}
                className="mt-1 w-full border-3 border-ink-950 rounded-2xl p-3"
                placeholder="Must be greater than 1%"
              />
            </label>
            <p className="text-xs text-gray-600 mt-1">
              Maximum acceptable price deviation. Must be{" "}
              <strong>greater than 1%</strong> (DUSA requirement). Trades are
              checked against on-chain oracle.
              {!isValidSlippage && (
                <span className="text-red-600 block font-semibold">
                  ⚠️ Slippage must be at least 1%
                </span>
              )}
            </p>
          </div>

          <div className="brut-card bg-gray-50 p-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={useMoreGas}
                  onChange={(e) => setUseMoreGas(e.target.checked)}
                  className="sr-only peer"
                />
                <div
                  className={`w-6 h-6 border-3 border-ink-950 rounded-lg transition-all ${
                    useMoreGas ? "bg-blue-300" : "bg-white"
                  }`}
                >
                  {useMoreGas && (
                    <svg
                      className="w-full h-full p-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={4}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <div>
                <div className="font-bold">Use More Gas</div>
                <div className="text-sm text-gray-600">
                  Recommended for complex swaps or volatile markets (~0.6 MAS
                  per trade)
                </div>
              </div>
            </label>
          </div>

          <div className="brut-card bg-blue-100 p-4">
            <h3 className="font-bold mb-2">Strategy Summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Trade Amount:</span>
                <span className="font-bold">
                  {amountPerTrade || "0"} {tokenFromInfo?.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Frequency:</span>
                <span className="font-bold">
                  Every {intervalValue}{" "}
                  {TIME_UNITS[intervalUnit].label.toLowerCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Investment:</span>
                <span className="font-bold">{totalInvestment}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-bold">{estimatedDuration}</span>
              </div>
              <div className="flex justify-between">
                <span>Buying:</span>
                <span className="font-bold">{tokenToInfo?.symbol}</span>
              </div>
            </div>
          </div>

          <div className="brut-card bg-red-50 border-2 border-red-300 p-4">
            <h4 className="font-bold text-red-800 mb-2">
              ⚠️ Important: Balance Requirements
            </h4>
            <p className="text-sm text-red-700">
              Your DCA will be <strong>permanently canceled</strong> if your
              account lacks sufficient token balance or allowance when a trade
              executes. Make sure to maintain enough {tokenFromInfo?.symbol} in
              your wallet for all scheduled trades.
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Review and Deploy */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="brut-card bg-gradient-to-r from-lime-100 to-yellow-100 p-6">
            <h3 className="text-xl font-bold mb-4">📊 DCA Strategy Overview</h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-300">
                <span className="font-semibold">Trading Pair:</span>
                <span className="font-bold text-lg">
                  {tokenFromInfo?.symbol} → {tokenToInfo?.symbol}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-300">
                <span className="font-semibold">Amount Per Trade:</span>
                <span className="font-bold">
                  {amountPerTrade} {tokenFromInfo?.symbol}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-300">
                <span className="font-semibold">
                  MAS Required for Execution:
                </span>
                <span className="font-bold text-orange-600">
                  ~
                  {hasEndTime
                    ? (0.5 * parseInt(numberOfTrades)).toFixed(1)
                    : "50"}{" "}
                  MAS
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-300">
                <span className="font-semibold">Trade Frequency:</span>
                <span className="font-bold">
                  Every {intervalValue}{" "}
                  {TIME_UNITS[intervalUnit].label.toLowerCase()}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-300">
                <span className="font-semibold">Duration:</span>
                <span className="font-bold">
                  {hasEndTime
                    ? `${numberOfTrades} trades (${estimatedDuration})`
                    : "Infinite (until stopped)"}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-300">
                <span className="font-semibold">Total Investment:</span>
                <span className="font-bold text-lg text-green-700">
                  {totalInvestment}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-300">
                <span className="font-semibold">Slippage Tolerance:</span>
                <span className="font-bold">{slippageTolerance}%</span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="font-semibold">More Gas:</span>
                <span className="font-bold">{useMoreGas ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>

          <div className="brut-card bg-yellow-100 p-4">
            <h3 className="font-bold mb-2">⚠️ Important Information</h3>
            <ul className="text-sm space-y-1">
              <li>
                • This creates an automated DCA strategy on Massa blockchain
                using Dusa protocol
              </li>
              <li>
                • Token approval required for{" "}
                {hasEndTime ? "total investment" : "large amount"}
              </li>
              <li>• Initial cost: ~1 MAS + gas fees (~0.6 MAS per trade)</li>
              <li>
                • Trades execute automatically via smart contract deferred calls
              </li>
              <li>• Price checks against on-chain oracle before each trade</li>
              <li>
                • If conditions aren't favorable, trades are automatically
                rescheduled
              </li>
              <li>• Token path limited to max 4 tokens (you're using 2)</li>
              <li>• Must include WMAS or USDC in path (requirement met)</li>
              <li>• You can update or stop the strategy at any time</li>
              <li>
                • Maintain sufficient {tokenFromInfo?.symbol} balance for
                upcoming trades
              </li>
            </ul>
          </div>

          {!connectedAccount && (
            <div className="brut-card bg-red-100 p-4">
              <p className="text-red-700 font-bold">
                Please connect your wallet to create the DCA strategy
              </p>
            </div>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={prev}
          className="brut-btn bg-white"
          disabled={step === 0 || loading}
        >
          Back
        </button>

        {step < 2 ? (
          <button
            onClick={next}
            className="brut-btn bg-lime-300"
            disabled={
              (step === 0 && !isValidTokenPair) ||
              (step === 1 && !isValidConfig) ||
              loading
            }
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleCreateDCA}
            className="brut-btn bg-yellow-300"
            disabled={!connectedAccount || !isValidConfig || loading}
          >
            {loading ? "Creating Strategy..." : "Create DCA Strategy"}
          </button>
        )}
      </div>

      {/* Powered by DUSA */}
      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-600">
        <span>Powered by</span>
        <a
          href="https://beta.dusa.io"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-1.5 py-1 bg-ink-950 rounded-xl hover:opacity-80 transition-opacity"
        >
          <img
            src="https://beta.dusa.io/assets/logo_white-179adecd.png"
            alt="DUSA Protocol"
            className="h-8"
          />
        </a>
      </div>
    </div>
  );
}
