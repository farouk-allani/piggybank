import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useAccountStore } from "@massalabs/react-ui-kit";
import { getUserSplitterVaults, getVaultTokenSelections } from "../lib/massa";
import { isMultiSigVault, getVaultName } from "../lib/multiSigVault";
import { AVAILABLE_TOKENS } from "../lib/types";

interface UserVault {
  address: string;
  name: string;
  status: string;
  tokenCount: number;
  balance: string;
  isMultiSig: boolean;
  tokenLogos: string[];
}

export default function Dashboard() {
  const { connectedAccount } = useAccountStore();
  const [vaults, setVaults] = useState<UserVault[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserVaults = async (showToast = false) => {
    if (!connectedAccount) {
      setVaults([]);
      return;
    }

    setLoading(true);
    setError(null);

    let toastId: any = null;
    if (showToast) {
      toastId = toast.loading("Fetching your vaults...");
    }

    try {
      console.log("Fetching vaults...");

      const vaultAddresses = await getUserSplitterVaults(
        connectedAccount,
        connectedAccount.address
      );

      console.log("Vault addresses received:", vaultAddresses);

      // Transform vault addresses into vault objects with real token count
      const userVaults: UserVault[] = [];

      for (let i = 0; i < vaultAddresses.length; i++) {
        const address = vaultAddresses[i];

        try {
          // Check if multi-sig and get vault name
          const isMS = await isMultiSigVault(connectedAccount, address);
          const vaultName = await getVaultName(connectedAccount, address);

          // Get real token count and logos for each vault
          const tokens = await getVaultTokenSelections(
            connectedAccount,
            address
          );
          const tokenCount =
            tokens.length > 0 ? tokens.length : AVAILABLE_TOKENS.length;

          // Get token logos from the actual vault tokens
          const tokenLogos =
            tokens.length > 0
              ? tokens.slice(0, 3).map((t) => t.logo)
              : AVAILABLE_TOKENS.slice(0, 3).map((t) => t.logo);

          userVaults.push({
            address,
            name:
              vaultName ||
              (isMS ? `Multi-Sig Vault #${i + 1}` : `Splitter Vault #${i + 1}`),
            status: "Active",
            tokenCount,
            balance: "0.00",
            isMultiSig: isMS,
            tokenLogos,
          });
        } catch (error) {
          console.error(`Error fetching vault data for ${address}:`, error);
          // Fallback vault data
          userVaults.push({
            address,
            name: `Vault #${i + 1}`,
            status: "Active",
            tokenCount: AVAILABLE_TOKENS.length,
            balance: "0.00",
            isMultiSig: false,
            tokenLogos: AVAILABLE_TOKENS.slice(0, 3).map((t) => t.logo),
          });
        }
      }

      console.log("Setting vaults with real token counts:", userVaults);
      setVaults(userVaults);

      if (toastId) {
        toast.update(toastId, {
          render: `📦 Found ${userVaults.length} vault${
            userVaults.length === 1 ? "" : "s"
          }`,
          type: "success",
          isLoading: false,
          autoClose: 3000,
        });
      }
    } catch (err) {
      console.error("Error fetching user vaults:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch vaults";
      setError(errorMessage);

      if (toastId) {
        toast.update(toastId, {
          render: `Failed to fetch vaults: ${errorMessage}`,
          type: "error",
          isLoading: false,
          autoClose: 5000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserVaults();
  }, [connectedAccount]);

  const handleRefresh = () => {
    fetchUserVaults(true); // Show toast for manual refresh
  };

  if (!connectedAccount) {
    return (
      <div className="space-y-6">
        <div className="brut-card bg-yellow-100 p-6 text-center">
          <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-gray-700">
            Please connect your Massa wallet to view and manage your vaults.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">My Vaults</h1>
          <p className="text-sm text-gray-600 mt-1">
            Connected: {connectedAccount.address.slice(0, 8)}...
            {connectedAccount.address.slice(-6)}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            className="brut-btn bg-blue-200"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <Link to="/vault/create" className="brut-btn bg-lime-300">
            + New Vault
          </Link>
        </div>
      </div>

      {error && (
        <div className="brut-card bg-red-100 border-red-500 p-4">
          <p className="text-red-700 font-bold">Error: {error}</p>
        </div>
      )}

      {loading ? (
        <div className="brut-card bg-white p-8 text-center">
          <p className="text-gray-600">Loading your vaults...</p>
        </div>
      ) : vaults.length === 0 ? (
        <div className="brut-card bg-white p-8 text-center">
          <h2 className="text-xl font-bold mb-4">No Vaults Yet</h2>
          <p className="text-gray-600 mb-4">
            You haven't created any splitter vaults yet. Create your first vault
            to start automatically splitting your deposits across multiple
            tokens!
          </p>
          <Link to="/vault/create" className="brut-btn bg-lime-300">
            Create Your First Vault
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vaults.map((vault) => (
            <Link
              key={vault.address}
              to={`/vault/${vault.address}`}
              className="brut-card p-6 bg-white hover:translate-y-[-2px] transition-transform"
            >
              <div className="mb-3">
                <h3 className="text-lg font-bold">{vault.name}</h3>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center space-x-1">
                  <span className="text-sm font-semibold text-gray-600">
                    Tokens:
                  </span>
                  <div className="flex -space-x-1">
                    {vault.tokenLogos.map((logo, idx) => (
                      <img
                        key={idx}
                        src={logo}
                        alt="Token"
                        className="w-5 h-5 rounded-full border border-white"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">
                    {vault.tokenCount} configured
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Address:</span>{" "}
                  <span className="font-mono">
                    {vault.address.slice(0, 6)}...{vault.address.slice(-4)}
                  </span>
                </p>
              </div>

              {/* <div className="border-t pt-3">
                <p className="text-sm text-gray-500 mb-1">Total Balance</p>
                <p className="text-xl font-black">{vault.balance} MAS</p>
              </div> */}

              <div className="mt-4 flex gap-2 flex-wrap">
                {vault.isMultiSig && (
                  <span className="inline-block bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded font-semibold">
                    Multi-Sig
                  </span>
                )}
                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                  Auto-Split
                </span>
                <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                  EagleFi DEX
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {vaults.length > 0 && (
        <div className="brut-card bg-blue-50 p-4">
          <h3 className="font-bold mb-2">💡 Quick Tips</h3>
          <ul className="text-sm space-y-1">
            <li>• Click on any vault to view details and make deposits</li>
            <li>
              • Deposits are automatically split based on your configured
              percentages
            </li>
            <li>• All swaps happen via EagleFi DEX for the best rates</li>
            <li>• You maintain full ownership of your vaults and funds</li>
          </ul>
        </div>
      )}
    </div>
  );
}
