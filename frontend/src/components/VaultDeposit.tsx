import { useState, useEffect } from "react";
import { useAccountStore } from "@massalabs/react-ui-kit";
import {
  depositToVault,
  approveUSDCSpending,
  getUserUSDCBalance,
} from "../lib/massa";

interface VaultDepositProps {
  vaultAddress: string;
  vaultName: string;
  onSuccess?: () => void;
}

export default function VaultDeposit({
  vaultAddress,
  vaultName,
  onSuccess,
}: VaultDepositProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [loadingBalance, setLoadingBalance] = useState(false);

  const { connectedAccount } = useAccountStore();

  // Fetch USDC balance when component mounts or account changes
  useEffect(() => {
    const fetchBalance = async () => {
      if (!connectedAccount) return;

      setLoadingBalance(true);
      try {
        const balance = await getUserUSDCBalance(
          connectedAccount,
          connectedAccount.address
        );
        setUsdcBalance(balance);
      } catch (error) {
        console.error("Error fetching USDC balance:", error);
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [connectedAccount]);

  const handleDeposit = async () => {
    if (!connectedAccount) {
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    setLoading(true);

    try {
      // Approve USDC spending first
      console.log("Approving USDC spending...");
      const approvalResult = await approveUSDCSpending(
        connectedAccount,
        vaultAddress,
        amount
      );

      if (!approvalResult.success) {
        setLoading(false);
        return;
      }

      console.log("USDC spending approved successfully");

      // Now proceed with the deposit
      const result = await depositToVault(
        connectedAccount,
        vaultAddress,
        amount
      );

      if (result.success) {
        setAmount("");
        // Refresh USDC balance
        const newBalance = await getUserUSDCBalance(
          connectedAccount,
          connectedAccount.address
        );
        setUsdcBalance(newBalance);
        onSuccess?.();
      }
    } catch (err) {
      console.error("Error depositing:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="brut-card bg-white p-4">
      <h3 className="font-bold text-lg mb-3">Deposit to {vaultName}</h3>

      <div className="space-y-3">
        {/* USDC Balance Display */}
        <div className=" p-3 pl-0">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold">Your USDC Balance:</span>
            <span className="text-lg font-bold text-blue-600">
              {loadingBalance ? "..." : `${usdcBalance} USDC`}
            </span>
          </div>
          {parseFloat(usdcBalance) === 0 && (
            <p className="text-xs text-orange-600 mt-1">
              ⚠️ You need USDC to deposit. Bridge USDC to Massa network first.
            </p>
          )}
        </div>

        <label className="block">
          <span className="font-bold text-sm">Amount (USDC)</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter USDC amount to deposit"
            className="mt-1 w-full border-2 border-ink-950 rounded-lg p-2"
            min="0"
            step="0.01"
          />
        </label>

        <button
          onClick={handleDeposit}
          disabled={
            !connectedAccount ||
            !amount ||
            parseFloat(amount) <= 0 ||
            loading ||
            parseFloat(usdcBalance) === 0
          }
          className="w-full brut-btn bg-lime-300 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : "Approve & Deposit USDC"}
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-600 space-y-1">
        <p>• Deposits are made in USDC</p>
        <p>
          • Your deposit will be automatically split across configured tokens
        </p>
        <p>• Swapping happens via EagleFi DEX</p>
        <p>• Two transactions required: USDC approval + deposit</p>
        <p className="text-blue-600 font-semibold">
          💡 Don't have USDC? Bridge it from Ethereum on Massa bridge
        </p>
      </div>
    </div>
  );
}
