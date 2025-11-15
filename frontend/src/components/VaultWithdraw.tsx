import { useState, useEffect, useRef } from "react";
import { useAccountStore } from "@massalabs/react-ui-kit";
import { withdrawFromVault } from "../lib/massa";
import { proposeWithdrawal } from "../lib/multiSigVault";
import { TokenSelection, AVAILABLE_TOKENS } from "../lib/types";
import {
  ArrowDownToLine,
  Wallet,
  ChevronDown,
  Check,
  AlertTriangle,
  Shield,
  RefreshCw,
} from "lucide-react";

interface VaultWithdrawProps {
  vaultAddress: string;
  vaultTokens: TokenSelection[];
  tokenBalances: { [tokenAddress: string]: string };
  onSuccess?: () => void;
  isMultiSig?: boolean;
}

export default function VaultWithdraw({
  vaultAddress,
  vaultTokens,
  tokenBalances,
  onSuccess,
  isMultiSig = false,
}: VaultWithdrawProps) {
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);

  const { connectedAccount } = useAccountStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowTokenDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter tokens that have balance > 0
  const tokensWithBalance = vaultTokens.filter(
    (token) =>
      tokenBalances[token.address] &&
      parseFloat(tokenBalances[token.address]) > 0
  );

  const selectedTokenInfo = vaultTokens.find(
    (token) => token.address === selectedToken
  );
  const maxBalance = selectedToken ? tokenBalances[selectedToken] || "0" : "0";

  const handleMaxClick = () => {
    const maxValue = parseFloat(maxBalance);
    if (maxValue > 0) {
      const safeMax = (maxValue * 0.999).toFixed(6).replace(/\.?0+$/, "");
      setAmount(safeMax);
    } else {
      setAmount("0");
    }
  };

  const handleWithdraw = async () => {
    if (!connectedAccount || !selectedToken || !amount || !toAddress) {
      return;
    }

    if (
      parseFloat(amount) <= 0 ||
      parseFloat(amount) > parseFloat(maxBalance)
    ) {
      return;
    }

    setLoading(true);

    try {
      let result;

      if (isMultiSig) {
        const tokenInfo = AVAILABLE_TOKENS.find(
          (t) => t.address === selectedToken
        );
        const decimals = tokenInfo?.decimals || 6;

        result = await proposeWithdrawal(
          connectedAccount,
          vaultAddress,
          selectedToken,
          amount,
          toAddress,
          decimals
        );
      } else {
        result = await withdrawFromVault(
          connectedAccount,
          vaultAddress,
          selectedToken,
          amount,
          toAddress
        );
      }

      if (result.success) {
        setAmount("");
        setToAddress("");
        setSelectedToken("");
        onSuccess?.();
      }
    } catch (err) {
      console.error("Error withdrawing:", err);
    } finally {
      setLoading(false);
    }
  };

  const isValidAmount =
    amount &&
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= parseFloat(maxBalance);
  const isValidAddress = toAddress && toAddress.length > 10;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-xl border-2 border-red-300">
          <ArrowDownToLine className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-2xl font-black">Withdraw Tokens</h3>
      </div>

      {tokensWithBalance.length === 0 && (
        <div className="bg-white border-3 border-ink-950 rounded-xl p-8 text-center">
          <Wallet className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-700 font-bold mb-1">
            No tokens available for withdrawal
          </p>
          <p className="text-gray-500 text-sm">
            Make some deposits first to build up token balances
          </p>
        </div>
      )}

      {tokensWithBalance.length > 0 && (
        <div className="space-y-4">
          {/* Token Selection Dropdown */}
          <div>
            <label className="block mb-2">
              <span className="font-bold">Select Token</span>
            </label>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowTokenDropdown(!showTokenDropdown)}
                className="w-full bg-white border-3 border-ink-950 rounded-xl p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                {selectedToken && selectedTokenInfo ? (
                  <div className="flex items-center space-x-2">
                    <img
                      src={selectedTokenInfo.logo}
                      alt={selectedTokenInfo.symbol}
                      className="w-6 h-6 rounded-full"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                    <div className="text-left">
                      <span className="font-bold">
                        {selectedTokenInfo.symbol}
                      </span>
                      <span className="text-sm text-gray-600 ml-2">
                        Balance: {tokenBalances[selectedToken]}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-500">Choose a token...</span>
                )}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showTokenDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showTokenDropdown && (
                <div className="absolute z-50 w-full mt-2 bg-white border-3 border-ink-950 rounded-xl shadow-brut max-h-48 overflow-y-auto">
                  {tokensWithBalance.map((token) => (
                    <button
                      key={token.address}
                      type="button"
                      onClick={() => {
                        setSelectedToken(token.address);
                        setShowTokenDropdown(false);
                      }}
                      className={`w-full p-3 flex items-center space-x-2 hover:bg-red-100 transition-colors border-b-2 border-gray-200 last:border-b-0 ${
                        selectedToken === token.address ? "bg-red-50" : ""
                      }`}
                    >
                      <img
                        src={token.logo}
                        alt={token.symbol}
                        className="w-6 h-6 rounded-full"
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                      <div className="text-left flex-1">
                        <span className="font-bold">{token.symbol}</span>
                        <span className="text-sm text-gray-600 ml-2">
                          {tokenBalances[token.address]}
                        </span>
                      </div>
                      {selectedToken === token.address && (
                        <Check className="w-4 h-4 text-red-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Amount Input */}
          {selectedToken && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">Amount</span>
                <button
                  onClick={handleMaxClick}
                  className="text-sm text-red-600 font-bold hover:underline"
                >
                  MAX: {maxBalance}
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full border-3 border-ink-950 rounded-xl p-4 text-2xl font-black pr-24"
                  min="0"
                  max={maxBalance}
                  step="0.000001"
                />
                {selectedTokenInfo && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <img
                      src={selectedTokenInfo.logo}
                      alt={selectedTokenInfo.symbol}
                      className="w-7 h-7 rounded-full"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <span className="font-bold text-sm">
                      {selectedTokenInfo.symbol}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* To Address Input */}
          <div>
            <label className="block mb-2">
              <span className="font-bold">Withdraw To</span>
            </label>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="Enter Massa address (AS12...)"
              className="w-full border-3 border-ink-950 rounded-xl p-3 font-mono text-sm"
            />

            {/* Auto-fill connected account */}
            {connectedAccount && (
              <button
                onClick={() => setToAddress(connectedAccount.address)}
                className="mt-2 text-sm text-blue-600 font-bold hover:underline flex items-center gap-1"
              >
                <Wallet className="w-3 h-3" />
                Use my address
              </button>
            )}
          </div>

          {/* Withdraw Button */}
          <button
            onClick={handleWithdraw}
            disabled={
              !connectedAccount ||
              !selectedToken ||
              !isValidAmount ||
              !isValidAddress ||
              loading
            }
            className="w-full brut-btn bg-red-300 disabled:bg-gray-300 disabled:cursor-not-allowed text-lg py-4 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                {isMultiSig ? "Creating Proposal..." : "Withdrawing..."}
              </>
            ) : (
              <>
                <ArrowDownToLine className="w-5 h-5" />
                {isMultiSig ? "Create Withdrawal Proposal" : "Withdraw Tokens"}
              </>
            )}
          </button>

          {/* Warning */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4">
            <div className="flex items-start gap-3">
              {isMultiSig ? (
                <Shield className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm">
                {isMultiSig ? (
                  <>
                    <strong className="text-indigo-800">
                      Multi-Sig Vault:
                    </strong>{" "}
                    <span className="text-gray-700">
                      This will create a withdrawal proposal. Other signers must
                      approve before the withdrawal executes.
                    </span>
                  </>
                ) : (
                  <>
                    <strong className="text-orange-800">Owner Only:</strong>{" "}
                    <span className="text-gray-700">
                      Only the vault owner can withdraw tokens. Withdrawals will
                      transfer tokens directly to the specified address.
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
