import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccountStore } from "@massalabs/react-ui-kit";
import Stepper from "../components/Stepper.tsx";
import CountdownTimer from "../components/CountdownTimer.tsx";
import {
  TokenSelection,
  AVAILABLE_TOKENS,
  TokenWithPercentage,
} from "../lib/types";
import {
  createSplitterVault,
  enableAutoDeposit,
  approveUSDCSpending,
} from "../lib/massa";
import { createMultiSigVault } from "../lib/multiSigVault";

export default function CreateVault() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [vaultName, setVaultName] = useState("My Splitter Vault");
  const [tokens, setTokens] = useState<TokenSelection[]>(() =>
    AVAILABLE_TOKENS.map((token) => ({
      ...token,
      percentage: 0,
      isSelected: false,
    }))
  );

  // Multi-sig state
  const [isMultiSig, setIsMultiSig] = useState(false);
  const [signers, setSigners] = useState<string[]>(['', '']);
  const [threshold, setThreshold] = useState(2);

  // Auto deposit state
  const [enableAutoDepositFeature, setEnableAutoDepositFeature] =
    useState(false);
  const [autoDepositAmount, setAutoDepositAmount] = useState("");
  const [autoDepositNextExecution, setAutoDepositNextExecution] = useState<
    number | null
  >(null);

  // Auto deposit constants
  const AUTO_DEPOSIT_PERIOD = 37675; // Fixed period for Massa blockchain
  const AUTO_DEPOSIT_INTERVAL_SECONDS = 602800; // 37675 * 16 = 602,800 seconds (1 week minus 1 second)

  const { connectedAccount } = useAccountStore();
  const navigate = useNavigate();

  // Calculate total percentage
  const totalPercentage = tokens
    .filter((token) => token.isSelected)
    .reduce((sum, token) => sum + token.percentage, 0);

  const isValidPercentages = totalPercentage === 100;
  const hasSelectedTokens = tokens.some((token) => token.isSelected);
  const selectedTokenCount = tokens.filter((token) => token.isSelected).length;
  const MAX_TOKENS = 2; // Limit due to event limits

  const handleTokenToggle = (index: number) => {
    setTokens((prev) => {
      const token = prev[index];

      // If trying to select a new token and already at max limit, prevent selection
      if (!token.isSelected && selectedTokenCount >= MAX_TOKENS) {
        return prev;
      }

      return prev.map((token, i) =>
        i === index
          ? {
              ...token,
              isSelected: !token.isSelected,
              percentage: token.isSelected ? 0 : 50, // Changed to 50 for 2 tokens
            }
          : token
      );
    });
  };

  const handlePercentageChange = (index: number, percentage: number) => {
    if (percentage < 0 || percentage > 100) return;

    setTokens((prev) =>
      prev.map((token, i) => (i === index ? { ...token, percentage } : token))
    );
  };

  const autoBalancePercentages = () => {
    const selectedTokens = tokens.filter((token) => token.isSelected);
    if (selectedTokens.length === 0) return;

    const equalPercentage = Math.floor(100 / selectedTokens.length);
    const remainder = 100 % selectedTokens.length;

    setTokens((prev) =>
      prev.map((token) => {
        if (!token.isSelected) return token;

        const index = selectedTokens.findIndex(
          (st) => st.address === token.address
        );
        const percentage = equalPercentage + (index < remainder ? 1 : 0);

        return { ...token, percentage };
      })
    );
  };

  const handleCreateVault = async () => {
    if (!connectedAccount || !hasSelectedTokens || !isValidPercentages) {
      return;
    }

    setLoading(true);

    try {
      // Convert selected tokens to TokenWithPercentage format for smart contract
      const tokensWithPercentage = tokens
        .filter((token) => token.isSelected)
        .map(
          (token) =>
            new TokenWithPercentage(token.address, BigInt(token.percentage))
        );

      let result;

      if (isMultiSig) {
        // Create multi-sig vault
        result = await createMultiSigVault(
          connectedAccount,
          signers.filter(s => s.trim().length > 0),
          threshold,
          tokensWithPercentage,
          vaultName
        );
      } else {
        // Create regular splitter vault
        result = await createSplitterVault(
          connectedAccount,
          tokensWithPercentage,
          vaultName
        );
      }

      if (result.success && result.vaultAddress) {
        console.log("Vault created successfully:", result.vaultAddress);

        // Enable auto deposit if requested
        if (
          enableAutoDepositFeature &&
          autoDepositAmount &&
          parseFloat(autoDepositAmount) > 0
        ) {
          console.log("Enabling auto deposit...");

          // Approve USDC spending for auto deposits (large amount for recurring deposits)
          const totalAmount = (parseFloat(autoDepositAmount) * 1000).toString();
          const approveResult = await approveUSDCSpending(
            connectedAccount,
            result.vaultAddress,
            totalAmount
          );

          if (approveResult.success) {
            // Enable auto deposit
            const autoDepositResult = await enableAutoDeposit(
              connectedAccount,
              result.vaultAddress,
              autoDepositAmount,
              AUTO_DEPOSIT_INTERVAL_SECONDS,
              connectedAccount.address
            );

            if (autoDepositResult.success) {
              console.log("Auto deposit enabled successfully");
            }
          }
        }

        // Navigate to the vault
        navigate(`/vault/${result.vaultAddress}`);
      } else if (result.success) {
        // Fallback to dashboard if no vault address
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Error creating vault:", err);
    } finally {
      setLoading(false);
    }
  };

  const next = () => setStep((s) => Math.min(2, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="brut-card bg-white p-6 max-w-4xl">
      <h1 className="text-3xl font-black mb-4">Create Splitter Vault</h1>
      <Stepper steps={["Setup", "Configure", "Deploy"]} current={step} />

      {/* Step 1: Basic Setup */}
      {step === 0 && (
        <div className="space-y-4">
          <label className="block">
            <span className="font-bold">Vault Name</span>
            <input
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              className="mt-1 w-full border-3 border-ink-950 rounded-2xl p-3"
              placeholder="Enter vault name"
            />
          </label>

          {/* Multi-Sig Toggle */}
          <div className="brut-card bg-purple-50 p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isMultiSig}
                onChange={(e) => setIsMultiSig(e.target.checked)}
                className="w-5 h-5 border-3 border-ink-950 rounded"
              />
              <div>
                <span className="font-bold">Enable Multi-Signature</span>
                <p className="text-xs text-gray-600">
                  Require multiple approvals for withdrawals (perfect for families, couples, or teams)
                </p>
              </div>
            </label>
          </div>

          {/* Multi-Sig Configuration */}
          {isMultiSig && (
            <div className="brut-card bg-purple-100 p-4 space-y-3">
              <h3 className="font-bold">Multi-Sig Configuration</h3>

              <div>
                <label className="block mb-2">
                  <span className="font-bold text-sm">Signers (2-5 addresses)</span>
                </label>
                {signers.map((signer, index) => (
                  <div key={index} className="mb-2">
                    <input
                      value={signer}
                      onChange={(e) => {
                        const newSigners = [...signers];
                        newSigners[index] = e.target.value;
                        setSigners(newSigners);
                      }}
                      className="w-full border-2 border-ink-950 rounded-lg p-2 text-sm"
                      placeholder={`Signer ${index + 1} address`}
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  {signers.length < 5 && (
                    <button
                      onClick={() => setSigners([...signers, ''])}
                      className="brut-btn bg-purple-200 text-sm"
                    >
                      + Add Signer
                    </button>
                  )}
                  {signers.length > 2 && (
                    <button
                      onClick={() => setSigners(signers.slice(0, -1))}
                      className="brut-btn bg-red-200 text-sm"
                    >
                      - Remove
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block mb-2">
                  <span className="font-bold text-sm">Approval Threshold</span>
                  <p className="text-xs text-gray-600">
                    Number of signatures required for withdrawals
                  </p>
                </label>
                <select
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full border-2 border-ink-950 rounded-lg p-2"
                >
                  {Array.from({ length: signers.filter(s => s.trim()).length }, (_, i) => i + 1)
                    .filter(n => n >= 2)
                    .map(n => (
                      <option key={n} value={n}>
                        {n} of {signers.filter(s => s.trim()).length}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          <div className="brut-card bg-blue-50 p-4">
            <h3 className="font-bold mb-2">About Splitter Vaults</h3>
            <p className="text-sm mb-2">
              A splitter vault automatically distributes your USDC deposits
              across multiple tokens based on the percentages you configure.
              Each deposit will be split and swapped into your chosen tokens via
              EagleFi DEX.
            </p>
            {isMultiSig && (
              <p className="text-sm mb-2 text-purple-700 font-semibold">
                🔐 With multi-sig enabled, withdrawals will require {threshold} approvals from the signers.
              </p>
            )}
            <p className="text-xs text-blue-600 font-semibold">
              💡 You'll need USDC to deposit into your vault. Make sure to
              bridge USDC to Massa network.
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Token Selection and Percentage Allocation */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-bold">Select Tokens & Set Percentages</span>
            <button
              onClick={autoBalancePercentages}
              className="brut-btn bg-blue-200 text-sm"
              disabled={!hasSelectedTokens}
            >
              Auto Balance
            </button>
          </div>

          {/* Warning Message */}
          <div className="brut-card bg-yellow-50 border-2 border-yellow-400 p-3">
            <div className="flex items-start gap-2">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-yellow-900 mb-1">
                  Token Selection Limit
                </p>
                <p className="text-xs text-yellow-800">
                  Due to event limits, you can currently select a maximum of{" "}
                  <strong>2 tokens</strong>. We're working on fixing this
                  limitation soon. Thank you for your patience!
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {tokens.map((token, index) => {
              const isDisabled =
                !token.isSelected && selectedTokenCount >= MAX_TOKENS;

              return (
                <div
                  key={token.address}
                  className={`brut-card p-4 ${
                    isDisabled ? "bg-gray-100 opacity-60" : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <label
                        className={
                          isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                        }
                      >
                        <input
                          type="checkbox"
                          checked={token.isSelected}
                          onChange={() => handleTokenToggle(index)}
                          disabled={isDisabled}
                          className="sr-only peer"
                        />
                        <div
                          className={`w-6 h-6 border-3 border-ink-950 rounded-lg transition-all ${
                            token.isSelected
                              ? "bg-lime-300"
                              : isDisabled
                              ? "bg-gray-200"
                              : "bg-white"
                          }`}
                        >
                          {token.isSelected && (
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
                      </label>
                      <img
                        src={token.logo}
                        alt={token.symbol}
                        className="w-8 h-8 rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <div>
                        <div className="font-bold flex items-center gap-1">
                          {token.symbol}
                        </div>
                        <div className="text-sm text-gray-600">
                          {token.name}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {token.address.slice(0, 8)}...
                          {token.address.slice(-6)}
                        </div>
                      </div>
                    </div>

                    {token.isSelected && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={token.percentage}
                          onChange={(e) =>
                            handlePercentageChange(
                              index,
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-20 border-2 border-ink-950 rounded-lg p-2 text-center"
                        />
                        <span className="font-bold">%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="brut-card bg-lime-100 p-4">
            <div className="flex justify-between items-center">
              <span className="font-bold">Total Percentage:</span>
              <span
                className={`font-bold text-lg ${
                  totalPercentage === 100
                    ? "text-green-600"
                    : totalPercentage > 100
                    ? "text-red-600"
                    : "text-yellow-600"
                }`}
              >
                {totalPercentage}%
              </span>
            </div>
            {totalPercentage !== 100 && hasSelectedTokens && (
              <p className="text-sm text-gray-600 mt-2">
                {totalPercentage < 100
                  ? `Need ${100 - totalPercentage}% more to reach 100%`
                  : `Reduce by ${totalPercentage - 100}% to reach 100%`}
              </p>
            )}
          </div>

          {/* Auto Deposit Configuration */}
          <div className="brut-card bg-gradient-to-r from-lime-100 to-green-100 p-6 border-2 border-lime-400">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                🔄 Auto Deposit (Optional)
              </h3>
              <label className="cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableAutoDepositFeature}
                  onChange={(e) => {
                    setEnableAutoDepositFeature(e.target.checked);
                    if (!e.target.checked) {
                      setAutoDepositAmount("");
                      setAutoDepositNextExecution(null);
                    } else {
                      // Calculate next execution time (1 week from now)
                      const nextExecution =
                        Date.now() + AUTO_DEPOSIT_INTERVAL_SECONDS * 1000;
                      setAutoDepositNextExecution(nextExecution);
                    }
                  }}
                  className="sr-only peer"
                />
                <div
                  className={`w-14 h-8 border-3 border-ink-950 rounded-full transition-all relative ${
                    enableAutoDepositFeature ? "bg-lime-400" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white border-2 border-ink-950 rounded-full transition-transform ${
                      enableAutoDepositFeature ? "translate-x-6" : ""
                    }`}
                  />
                </div>
              </label>
            </div>

            {enableAutoDepositFeature && (
              <div className="space-y-4">
                <div>
                  <label className="block mb-2">
                    <span className="font-bold">Amount per Deposit (USDC)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={autoDepositAmount}
                    onChange={(e) => setAutoDepositAmount(e.target.value)}
                    className="w-full border-3 border-ink-950 rounded-2xl p-3"
                    placeholder="e.g., 100"
                  />
                </div>

                <div className="brut-card bg-white p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">Deposit Frequency:</span>
                    <span className="text-lg font-black text-lime-600">
                      Every 1 Week
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Fixed interval due to Massa blockchain deferred calls
                    limitation
                  </p>
                </div>

                {autoDepositNextExecution &&
                  autoDepositAmount &&
                  parseFloat(autoDepositAmount) > 0 && (
                    <div className="brut-card bg-white p-4">
                      <p className="text-sm font-bold mb-2">
                        ⏰ First Auto Deposit In:
                      </p>
                      <CountdownTimer
                        targetTimestamp={autoDepositNextExecution}
                        className="mt-2"
                      />
                    </div>
                  )}

                <div className="brut-card bg-yellow-50 p-4 border-2 border-yellow-400">
                  <h4 className="font-bold text-sm mb-2">
                    ⚠️ Important Requirements:
                  </h4>
                  <ul className="text-xs space-y-1">
                    <li>
                      • Requires ~20 MAS for deferred calls (one-time cost)
                    </li>
                    <li>
                      • Ensure sufficient USDC balance for recurring deposits
                    </li>
                    <li>
                      • Auto deposit will continue until disabled or
                      insufficient funds
                    </li>
                    <li>
                      • You can disable auto deposit anytime from vault details
                      page
                    </li>
                    <li>
                      • USDC approval will be set for 1000x the deposit amount
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {!enableAutoDepositFeature && (
              <p className="text-sm text-gray-600">
                Enable to automatically deposit USDC to your vault every week.
                You can configure this later from the vault details page.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Review and Deploy */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="font-bold">Review Vault Configuration</p>

          <div className="brut-card bg-gray-50 p-4">
            <div className="mb-3">
              <span className="font-bold">Vault Name:</span> {vaultName}
            </div>

            <div className="mb-3">
              <span className="font-bold">Selected Tokens:</span>
              <div className="mt-2 space-y-2">
                {tokens
                  .filter((token) => token.isSelected)
                  .map((token) => (
                    <div
                      key={token.address}
                      className="flex justify-between items-center"
                    >
                      <span>
                        {token.symbol} ({token.name})
                      </span>
                      <span className="font-bold">{token.percentage}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Auto Deposit Summary */}
          {enableAutoDepositFeature &&
            autoDepositAmount &&
            parseFloat(autoDepositAmount) > 0 && (
              <div className="brut-card bg-gradient-to-r from-lime-100 to-green-100 p-6 border-2 border-lime-400">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  Auto Deposit Configuration
                  <span className="text-xs bg-lime-500 text-white px-2 py-1 rounded-full">
                    ENABLED
                  </span>
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-300">
                    <span className="font-semibold">Deposit Amount:</span>
                    <span className="font-bold text-lg">
                      {autoDepositAmount} USDC
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-gray-300">
                    <span className="font-semibold">Frequency:</span>
                    <span className="font-bold">Every 1 Week</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-gray-300">
                    <span className="font-semibold">MAS Required:</span>
                    <span className="font-bold text-orange-600">~20 MAS</span>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="font-semibold">Status:</span>
                    <span className="font-bold text-lime-600">
                      Will activate after vault creation
                    </span>
                  </div>
                </div>

                {autoDepositNextExecution && (
                  <div className="mt-4 brut-card bg-white p-4">
                    <p className="text-sm font-bold mb-2">
                      ⏰ First Auto Deposit In:
                    </p>
                    <CountdownTimer
                      targetTimestamp={autoDepositNextExecution}
                      className="mt-2"
                    />
                  </div>
                )}
              </div>
            )}

          <div className="brut-card bg-yellow-100 p-4">
            <h3 className="font-bold mb-2">⚠️ Important Information</h3>
            <ul className="text-sm space-y-1">
              <li>• This will create a new vault on the Massa blockchain</li>
              <li>• Initial deployment cost: ~5 MAS for gas</li>
              {enableAutoDepositFeature &&
                autoDepositAmount &&
                parseFloat(autoDepositAmount) > 0 && (
                  <li className="text-orange-600 font-semibold">
                    • Additional ~20 MAS required for auto deposit activation
                  </li>
                )}
              <li>• Deposits must be made in USDC (6 decimals)</li>
              <li>
                • USDC will be swapped to your selected tokens via EagleFi DEX
              </li>
              <li>• You will be the owner of this vault</li>
              {enableAutoDepositFeature &&
                autoDepositAmount &&
                parseFloat(autoDepositAmount) > 0 && (
                  <li className="text-orange-600 font-semibold">
                    • Ensure sufficient USDC balance for recurring auto deposits
                  </li>
                )}
              <li className="text-blue-600 font-semibold">
                💡 Bridge USDC from Ethereum to deposit
              </li>
            </ul>
          </div>

          {!connectedAccount && (
            <div className="brut-card bg-red-100 p-4">
              <p className="text-red-700 font-bold">
                Please connect your wallet to deploy the vault
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
              (step === 1 && (!hasSelectedTokens || !isValidPercentages)) ||
              loading
            }
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleCreateVault}
            className="brut-btn bg-yellow-300"
            disabled={
              !connectedAccount ||
              !hasSelectedTokens ||
              !isValidPercentages ||
              loading
            }
          >
            {loading ? "Creating Vault..." : "Deploy Vault"}
          </button>
        )}
      </div>
    </div>
  );
}
