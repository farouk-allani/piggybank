import { useState, useEffect } from "react";
import { useAccountStore } from "@massalabs/react-ui-kit";
import {
  enableAutoDeposit,
  disableAutoDeposit,
  isAutoDepositEnabled,
  getUserUSDCBalance,
} from "../lib/massa";

interface VaultAutoDepositProps {
  vaultAddress: string;
  vaultName: string;
  onSuccess?: () => void;
}

// Fixed time period - ONLY 1 week is supported due to Massa blockchain's deferred calls limitation
// Period value: 37675 Massa periods
// When multiplied by 16 seconds per period: 602,800 seconds (approximately 1 week minus 1 second)
const FIXED_AUTO_DEPOSIT_PERIOD = 37675; // Massa periods
const FIXED_AUTO_DEPOSIT_INTERVAL = 602800; // seconds (37675 * 16)

export default function VaultAutoDeposit({
  vaultAddress,
  vaultName,
  onSuccess,
}: VaultAutoDepositProps) {
  const { connectedAccount } = useAccountStore();
  const [loading, setLoading] = useState(false);
  const [autoDepositActive, setAutoDepositActive] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  // Form state
  const [amountPerDeposit, setAmountPerDeposit] = useState("");
  const [userBalance, setUserBalance] = useState("0");

  // Check auto deposit status on mount
  useEffect(() => {
    const checkStatus = async () => {
      if (!connectedAccount) {
        setCheckingStatus(false);
        return;
      }

      try {
        const isEnabled = await isAutoDepositEnabled(
          connectedAccount,
          vaultAddress
        );
        setAutoDepositActive(isEnabled);
      } catch (error) {
        console.error("Error checking auto deposit status:", error);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkStatus();
  }, [connectedAccount, vaultAddress]);

  // Fetch user USDC balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (connectedAccount) {
        const balance = await getUserUSDCBalance(
          connectedAccount,
          connectedAccount.address
        );
        setUserBalance(balance);
      }
    };
    fetchBalance();
  }, [connectedAccount]);

  const handleEnableAutoDeposit = async () => {
    if (!connectedAccount || !amountPerDeposit) return;

    setLoading(true);

    try {
      // Calculate total amount needed for approval
      // Approve a large amount since auto deposit runs indefinitely
      const totalAmount = (parseFloat(amountPerDeposit) * 1000).toString();

      // First approve USDC spending
      const { approveUSDCSpending } = await import("../lib/massa");
      const approveResult = await approveUSDCSpending(
        connectedAccount,
        vaultAddress,
        totalAmount
      );

      if (!approveResult.success) {
        setLoading(false);
        return;
      }

      // Then enable auto deposit with fixed 1-week interval
      const result = await enableAutoDeposit(
        connectedAccount,
        vaultAddress,
        amountPerDeposit,
        FIXED_AUTO_DEPOSIT_INTERVAL,
        connectedAccount.address
      );

      if (result.success) {
        setAutoDepositActive(true);
        setShowConfig(false);
        setAmountPerDeposit("");
        if (onSuccess) onSuccess();
      }
    } catch (error) {
      console.error("Error enabling auto deposit:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableAutoDeposit = async () => {
    if (!connectedAccount) return;

    setLoading(true);

    try {
      const result = await disableAutoDeposit(connectedAccount, vaultAddress);

      if (result.success) {
        setAutoDepositActive(false);
        if (onSuccess) onSuccess();
      }
    } catch (error) {
      console.error("Error disabling auto deposit:", error);
    } finally {
      setLoading(false);
    }
  };

  const isValidAmount = parseFloat(amountPerDeposit || "0") > 0;
  const hasBalance =
    parseFloat(amountPerDeposit || "0") <= parseFloat(userBalance);

  if (checkingStatus) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600">Checking auto deposit status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Display */}
      {autoDepositActive && (
        <div className="brut-card bg-gradient-to-r from-green-100 to-lime-100 p-4 border-2 border-green-400">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">✅</span>
              <span className="font-bold text-green-900">
                Auto Deposit Active
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-700">
            Your vault is set up for automatic weekly deposits.
          </p>
        </div>
      )}

      {!autoDepositActive && !showConfig && (
        <div className="space-y-3">
          <div className="brut-card bg-blue-50 p-4">
            <p className="text-sm text-gray-700 mb-2">
              💡 <strong>Auto Deposit</strong> automatically deposits USDC to
              your vault every week using Massa's deferred calls.
            </p>
            <p className="text-xs text-gray-600">
              Set it once and let it run autonomously on-chain.
            </p>
          </div>
          <button
            onClick={() => setShowConfig(true)}
            className="w-full brut-btn bg-lime-300 font-bold"
          >
            ⚡ Enable Auto Deposit
          </button>
        </div>
      )}

      {!autoDepositActive && showConfig && (
        <div className="space-y-4">
          <div>
            <label className="block mb-2">
              <span className="font-bold text-sm">
                Amount Per Deposit (USDC)
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amountPerDeposit}
                onChange={(e) => setAmountPerDeposit(e.target.value)}
                className="mt-1 w-full border-3 border-ink-950 rounded-2xl p-3"
                placeholder="Amount in USDC"
              />
            </label>
            <p className="text-xs text-gray-600 mt-1">
              Your balance: {userBalance} USDC
            </p>
            {!hasBalance && parseFloat(amountPerDeposit || "0") > 0 && (
              <p className="text-xs text-red-600 mt-1">
                ⚠️ Insufficient balance
              </p>
            )}
          </div>

          <div className="brut-card bg-gradient-to-r from-lime-100 to-green-100 p-4 border-2 border-lime-400">
            <p className="font-bold text-sm mb-2">📅 Deposit Schedule</p>
            <div className="flex items-center justify-between">
              <span className="text-sm">Frequency:</span>
              <span className="bg-lime-500 text-white px-3 py-1 rounded-lg font-bold text-sm">
                Every 1 Week
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Fixed interval due to Massa blockchain's deferred calls
              limitation. Period value: 37675 (≈ 1 week minus 1 second)
            </p>
          </div>

          <div className="brut-card bg-blue-100 p-3">
            <p className="text-xs font-bold mb-1">Summary</p>
            <p className="text-xs">
              • Deposit {amountPerDeposit || "0"} USDC every week
            </p>
            <p className="text-xs">• Requires ~20 MAS for deferred calls</p>
            <p className="text-xs">• Can be disabled at any time</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowConfig(false)}
              className="flex-1 brut-btn bg-white"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleEnableAutoDeposit}
              className="flex-1 brut-btn bg-lime-300"
              disabled={!isValidAmount || !hasBalance || loading}
            >
              {loading ? "Enabling..." : "Enable"}
            </button>
          </div>
        </div>
      )}

      {autoDepositActive && (
        <div className="space-y-4">
          <div className="brut-card bg-yellow-50 p-4 border-2 border-yellow-400">
            <p className="text-sm font-bold mb-2 text-yellow-900">
              ⚠️ Important Reminders
            </p>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>• Maintain sufficient USDC balance for upcoming deposits</li>
              <li>• Ensure your wallet has ~20 MAS for deferred call fees</li>
              <li>• Deposits execute automatically every week</li>
              <li>• You can disable this feature at any time</li>
            </ul>
          </div>

          <div className="brut-card bg-gradient-to-r from-lime-100 to-green-100 p-4 border-2 border-lime-400">
            <p className="font-bold text-sm mb-2">📅 Current Schedule</p>
            <div className="flex items-center justify-between">
              <span className="text-sm">Frequency:</span>
              <span className="bg-lime-500 text-white px-3 py-1 rounded-lg font-bold text-sm">
                Every 1 Week
              </span>
            </div>
          </div>

          <button
            onClick={handleDisableAutoDeposit}
            className="w-full brut-btn bg-red-300 border-red-500 font-bold"
            disabled={loading}
          >
            {loading ? "Disabling..." : "🛑 Disable Auto Deposit"}
          </button>
        </div>
      )}
    </div>
  );
}
