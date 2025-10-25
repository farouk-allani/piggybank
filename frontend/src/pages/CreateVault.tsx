import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccountStore } from "@massalabs/react-ui-kit";
import Stepper from "../components/Stepper.tsx";
import {
  TokenSelection,
  AVAILABLE_TOKENS,
  TokenWithPercentage,
} from "../lib/types";
import { createSplitterVault } from "../lib/massa";

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

  const { connectedAccount } = useAccountStore();
  const navigate = useNavigate();

  // Calculate total percentage
  const totalPercentage = tokens
    .filter((token) => token.isSelected)
    .reduce((sum, token) => sum + token.percentage, 0);

  const isValidPercentages = totalPercentage === 100;
  const hasSelectedTokens = tokens.some((token) => token.isSelected);

  const handleTokenToggle = (index: number) => {
    setTokens((prev) =>
      prev.map((token, i) =>
        i === index
          ? {
              ...token,
              isSelected: !token.isSelected,
              percentage: token.isSelected ? 0 : 25,
            }
          : token
      )
    );
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

      const result = await createSplitterVault(
        connectedAccount,
        tokensWithPercentage
      );

      if (result.success) {
        console.log("Vault created successfully:", result.vaultAddress);

        // Navigate directly to the vault if we have its address
        if (result.vaultAddress) {
          console.log("New vault address:", result.vaultAddress);
          navigate(`/vault/${result.vaultAddress}`);
        } else {
          // Fallback to dashboard
          navigate("/dashboard");
        }
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

          <div className="brut-card bg-blue-50 p-4">
            <h3 className="font-bold mb-2">About Splitter Vaults</h3>
            <p className="text-sm mb-2">
              A splitter vault automatically distributes your USDC deposits
              across multiple tokens based on the percentages you configure.
              Each deposit will be split and swapped into your chosen tokens via
              EagleFi DEX.
            </p>
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

          <div className="space-y-3">
            {tokens.map((token, index) => (
              <div key={token.address} className="brut-card bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <label className="cursor-pointer">
                      <input
                        type="checkbox"
                        checked={token.isSelected}
                        onChange={() => handleTokenToggle(index)}
                        className="sr-only peer"
                      />
                      <div
                        className={`w-6 h-6 border-3 border-ink-950 rounded-lg transition-all ${
                          token.isSelected ? "bg-lime-300" : "bg-white"
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
                      <div className="text-sm text-gray-600">{token.name}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {token.address.slice(0, 8)}...{token.address.slice(-6)}
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
            ))}
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

          <div className="brut-card bg-yellow-100 p-4">
            <h3 className="font-bold mb-2">⚠️ Important Information</h3>
            <ul className="text-sm space-y-1">
              <li>• This will create a new vault on the Massa blockchain</li>
              <li>• Initial deployment cost: ~5 MAS for gas</li>
              <li>• Deposits must be made in USDC (6 decimals)</li>
              <li>
                • USDC will be swapped to your selected tokens via EagleFi DEX
              </li>
              <li>• You will be the owner of this vault</li>
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
