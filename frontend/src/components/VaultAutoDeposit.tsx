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
}

// Time period options
// Issue: Contract searches only ONE slot for available gas (findCheapestSlot with same start/end)
// Far future slots may not have 900M gas available, causing booking to fail
// Shorter intervals are more reliable as near-term slots have predictable gas availability
const TIME_PERIODS = [
  { label: "1 Week", value: 604800 }, // 37800 periods - may fail if slot lacks gas
  { label: "3 Days", value: 259200 }, // 16200 periods
  { label: "1 Day", value: 86400 }, // 5400 periods
  { label: "12 Hours", value: 43200 }, // 2700 periods
  { label: "6 Hours", value: 21600 }, // 1350 periods
  { label: "3 Hours", value: 10800 }, // 675 periods
  { label: "1 Hour", value: 3600 }, // 225 periods
  { label: "30 Minutes", value: 1800 }, // 112 periods
  { label: "15 Minutes", value: 900 }, // 56 periods
  { label: "5 Minutes", value: 300 }, // 18 periods - most reliable
];

export default function VaultAutoDeposit({
  vaultAddress,
}: VaultAutoDepositProps) {
  const { connectedAccount } = useAccountStore();
  const [loading, setLoading] = useState(false);
  const [autoDepositActive, setAutoDepositActive] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  // Form state
  const [amountPerDeposit, setAmountPerDeposit] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState(0); // Index of TIME_PERIODS
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

      // Then enable auto deposit
      const result = await enableAutoDeposit(
        connectedAccount,
        vaultAddress,
        amountPerDeposit,
        TIME_PERIODS[selectedPeriod].value,
        connectedAccount.address
      );

      if (result.success) {
        setAutoDepositActive(true);
        setShowConfig(false);
        setAmountPerDeposit("");
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
      <div className="brut-card bg-white p-6">
        <p className="text-gray-600">Checking auto deposit status...</p>
      </div>
    );
  }

  return (
    <div className="brut-card bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">🔄 Auto Deposit</h3>
        {autoDepositActive && (
          <div className="brut-btn bg-lime-300 text-xs">Active</div>
        )}
      </div>

      {!autoDepositActive && !showConfig && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Set up automatic recurring deposits to your vault. Deposits will be
            executed automatically at your chosen interval.
          </p>
          <button
            onClick={() => setShowConfig(true)}
            className="w-full brut-btn bg-lime-300"
          >
            Enable Auto Deposit
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

          <div>
            <label className="block mb-2">
              <span className="font-bold text-sm">Deposit Frequency</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
                className="mt-1 w-full border-3 border-ink-950 rounded-2xl p-3"
              >
                {TIME_PERIODS.map((period, index) => (
                  <option key={index} value={index}>
                    {period.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ Longer intervals may fail if future slots lack available gas.
              Shorter = more reliable.
            </p>
          </div>

          <div className="brut-card bg-blue-100 p-3">
            <p className="text-xs font-bold mb-1">Summary</p>
            <p className="text-xs">
              • Deposit {amountPerDeposit || "0"} USDC every{" "}
              {TIME_PERIODS[selectedPeriod].label.toLowerCase()}
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
        <div className="space-y-3">
          <div className="brut-card bg-lime-100 p-3">
            <p className="text-sm font-bold mb-1">✅ Auto Deposit Active</p>
            <p className="text-xs text-gray-600">
              Automatic deposits are running for this vault. Deposits will be
              executed at the configured interval.
            </p>
          </div>

          <div className="brut-card bg-yellow-100 p-3">
            <p className="text-xs font-bold mb-1">⚠️ Important</p>
            <p className="text-xs text-gray-600">
              Ensure you maintain sufficient USDC balance for upcoming deposits.
            </p>
          </div>

          <button
            onClick={handleDisableAutoDeposit}
            className="w-full brut-btn bg-red-300 border-red-500"
            disabled={loading}
          >
            {loading ? "Disabling..." : "Disable Auto Deposit"}
          </button>
        </div>
      )}
    </div>
  );
}
