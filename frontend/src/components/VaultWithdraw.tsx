import { useState } from "react";
import { useAccountStore } from "@massalabs/react-ui-kit";
import { withdrawFromVault } from "../lib/massa";
import { proposeWithdrawal } from "../lib/multiSigVault";
import { TokenSelection, AVAILABLE_TOKENS } from "../lib/types";

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
  isMultiSig = false
}: VaultWithdrawProps) {
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const { connectedAccount } = useAccountStore();

  // Filter tokens that have balance > 0
  const tokensWithBalance = vaultTokens.filter(token => 
    tokenBalances[token.address] && 
    parseFloat(tokenBalances[token.address]) > 0
  );

  const selectedTokenInfo = vaultTokens.find(token => token.address === selectedToken);
  const maxBalance = selectedToken ? tokenBalances[selectedToken] || "0" : "0";

  const handleMaxClick = () => {
    // Reduce max by a tiny amount to account for decimal precision issues
    const maxValue = parseFloat(maxBalance);
    if (maxValue > 0) {
      // Reduce by 0.1% to avoid rounding issues
      const safeMax = (maxValue * 0.999).toFixed(6).replace(/\.?0+$/, '');
      setAmount(safeMax);
    } else {
      setAmount("0");
    }
  };

  const handleWithdraw = async () => {
    if (!connectedAccount || !selectedToken || !amount || !toAddress) {
      return;
    }

    if (parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(maxBalance)) {
      return;
    }

    setLoading(true);

    try {
      let result;

      if (isMultiSig) {
        // For multi-sig vaults, create a withdrawal proposal
        const tokenInfo = AVAILABLE_TOKENS.find(t => t.address === selectedToken);
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
        // For regular vaults, withdraw directly
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

  const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(maxBalance);
  const isValidAddress = toAddress && toAddress.length > 10; // Basic address validation

  return (
    <div className="brut-card bg-gradient-to-r from-red-50 to-orange-50 border-red-300 p-4">
      <h3 className="font-bold text-lg mb-3 text-red-800">Withdraw Tokens</h3>
      
      {tokensWithBalance.length === 0 && (
        <div className="text-center py-4">
          <p className="text-gray-600 text-sm">No tokens available for withdrawal</p>
          <p className="text-gray-500 text-xs mt-1">Make some deposits first to build up token balances</p>
        </div>
      )}

      {tokensWithBalance.length > 0 && (
        <div className="space-y-3">
          {/* Token Selection */}
          <label className="block">
            <span className="font-bold text-sm">Select Token</span>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="mt-1 w-full border-2 border-red-300 rounded-lg p-2"
            >
              <option value="">Choose a token...</option>
              {tokensWithBalance.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol} - Balance: {tokenBalances[token.address]}
                </option>
              ))}
            </select>
          </label>

          {/* Amount Input */}
          {selectedToken && (
            <label className="block">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm">Amount</span>
                <button
                  onClick={handleMaxClick}
                  className="text-xs bg-red-200 px-2 py-1 rounded border border-red-300"
                >
                  Max: {maxBalance}
                </button>
              </div>
              <div className="mt-1 flex items-center space-x-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="flex-1 border-2 border-red-300 rounded-lg p-2"
                  min="0"
                  max={maxBalance}
                  step="0.000001"
                />
                {selectedTokenInfo && (
                  <div className="flex items-center space-x-1">
                    <img
                      src={selectedTokenInfo.logo}
                      alt={selectedTokenInfo.symbol}
                      className="w-6 h-6 rounded-full"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <span className="text-sm font-bold">{selectedTokenInfo.symbol}</span>
                  </div>
                )}
              </div>
            </label>
          )}

          {/* To Address Input */}
          <label className="block">
            <span className="font-bold text-sm">Withdraw To</span>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="Enter Massa address (AS12...)"
              className="mt-1 w-full border-2 border-red-300 rounded-lg p-2 font-mono text-sm"
            />
          </label>

          {/* Auto-fill connected account */}
          {connectedAccount && (
            <button
              onClick={() => setToAddress(connectedAccount.address)}
              className="text-xs bg-blue-100 px-3 py-1 rounded border border-blue-300"
            >
              Use my address: {connectedAccount.address.slice(0, 8)}...
            </button>
          )}

          {/* Withdraw Button */}
          <button
            onClick={handleWithdraw}
            disabled={!connectedAccount || !selectedToken || !isValidAmount || !isValidAddress || loading}
            className="w-full brut-btn bg-red-300 border-red-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading
              ? (isMultiSig ? "Creating Proposal..." : "Withdrawing...")
              : (isMultiSig ? "Create Withdrawal Proposal" : "Withdraw Tokens")
            }
          </button>

          {/* Warning */}
          <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              {isMultiSig ? (
                <>
                  🔐 <strong>Multi-Sig:</strong> This will create a withdrawal proposal.
                  Other signers must approve before the withdrawal executes.
                </>
              ) : (
                <>
                  ⚠️ <strong>Owner Only:</strong> Only the vault owner can withdraw tokens.
                  Withdrawals will transfer tokens directly to the specified address.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}