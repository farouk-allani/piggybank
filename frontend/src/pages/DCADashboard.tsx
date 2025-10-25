import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useAccountStore } from "@massalabs/react-ui-kit";
import { getUserDCAs, stopDCA } from "../lib/dca";
import { DCADisplay, DCAStatus } from "../lib/dca-types";

export default function DCADashboard() {
  const { connectedAccount } = useAccountStore();
  const [dcas, setDcas] = useState<DCADisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<number | null>(null);

  const fetchUserDCAs = async (showToast = false) => {
    if (!connectedAccount) {
      setDcas([]);
      return;
    }

    setLoading(true);
    setError(null);

    let toastId: any = null;
    if (showToast) {
      toastId = toast.loading("Fetching your DCA strategies...");
    }

    try {
      console.log("Fetching DCA strategies...");

      const userDCAs = await getUserDCAs(
        connectedAccount,
        connectedAccount.address
      );

      console.log("DCA strategies received:", userDCAs);
      setDcas(userDCAs);

      if (toastId) {
        toast.update(toastId, {
          render: `📊 Found ${userDCAs.length} DCA strateg${
            userDCAs.length === 1 ? "y" : "ies"
          }`,
          type: "success",
          isLoading: false,
          autoClose: 3000,
        });
      }
    } catch (err) {
      console.error("Error fetching DCA strategies:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch DCAs";
      setError(errorMessage);

      if (toastId) {
        toast.update(toastId, {
          render: `Failed to fetch DCA strategies: ${errorMessage}`,
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
    fetchUserDCAs();
  }, [connectedAccount]);

  const handleRefresh = () => {
    fetchUserDCAs(true);
  };

  const handleStopDCA = async (dcaId: number, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Link navigation
    e.stopPropagation();

    if (!connectedAccount) return;

    const confirmed = window.confirm(
      `Are you sure you want to stop DCA strategy #${dcaId}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setStoppingId(dcaId);

    try {
      const result = await stopDCA(connectedAccount, BigInt(dcaId));

      if (result.success) {
        // Refresh the list after stopping
        await fetchUserDCAs();
      }
    } catch (err) {
      console.error("Error stopping DCA:", err);
    } finally {
      setStoppingId(null);
    }
  };

  const getStatusColor = (status: DCAStatus) => {
    switch (status) {
      case DCAStatus.ACTIVE:
        return "bg-lime-200 border-lime-500 text-lime-900";
      case DCAStatus.PAUSED:
        return "bg-yellow-200 border-yellow-500 text-yellow-900";
      case DCAStatus.COMPLETED:
        return "bg-blue-200 border-blue-500 text-blue-900";
      case DCAStatus.STOPPED:
        return "bg-red-200 border-red-500 text-red-900";
      default:
        return "bg-gray-200 border-gray-500 text-gray-900";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatNextExecution = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    const now = Date.now();
    const diff = timestamp - now;

    if (diff < 0) return "Soon";

    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);

    if (days > 0) return `in ${days}d`;
    if (hours > 0) return `in ${hours}h`;
    return "Soon";
  };

  if (!connectedAccount) {
    return (
      <div className="space-y-6">
        <div className="brut-card bg-yellow-100 p-6 text-center">
          <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-gray-700">
            Please connect your Massa wallet to view and manage your DCA
            strategies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">DCA Strategies</h1>
          <p className="text-sm text-gray-600 mt-1">
            Automate your investments with Dollar Cost Averaging
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
          <Link to="/dca/create" className="brut-btn bg-lime-300">
            + New DCA Strategy
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
          <p className="text-gray-600">Loading your DCA strategies...</p>
        </div>
      ) : dcas.length === 0 ? (
        <div className="brut-card bg-white p-8 text-center">
          <h2 className="text-xl font-bold mb-4">No DCA Strategies Yet</h2>
          <p className="text-gray-600 mb-4">
            You haven't created any DCA strategies yet. Start automating your
            investments by creating your first DCA strategy!
          </p>
          <Link to="/dca/create" className="brut-btn bg-lime-300">
            Create Your First DCA Strategy
          </Link>
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="brut-card bg-lime-100 p-4">
              <p className="text-sm font-bold text-gray-600">
                Total Strategies
              </p>
              <p className="text-3xl font-black">{dcas.length}</p>
            </div>
            <div className="brut-card bg-green-100 p-4">
              <p className="text-sm font-bold text-gray-600">Active</p>
              <p className="text-3xl font-black">
                {dcas.filter((d) => d.status === DCAStatus.ACTIVE).length}
              </p>
            </div>
            <div className="brut-card bg-blue-100 p-4">
              <p className="text-sm font-bold text-gray-600">Completed</p>
              <p className="text-3xl font-black">
                {dcas.filter((d) => d.status === DCAStatus.COMPLETED).length}
              </p>
            </div>
            <div className="brut-card bg-yellow-100 p-4">
              <p className="text-sm font-bold text-gray-600">
                Total Executions
              </p>
              <p className="text-3xl font-black">
                {dcas.reduce((sum, d) => sum + d.executedCount, 0)}
              </p>
            </div>
          </div>

          {/* DCA Strategies List */}
          <div className="grid md:grid-cols-2 gap-6">
            {dcas.map((dca) => (
              <div key={dca.id} className="brut-card p-6 bg-white relative">
                <Link
                  to={`/dca/${dca.id}`}
                  className="block hover:translate-y-[-2px] transition-transform"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-bold">
                        {dca.fromToken} → {dca.toToken}
                      </h3>
                      <span className="text-xs text-gray-500">#{dca.id}</span>
                    </div>
                    <span
                      className={`brut-btn text-xs py-1 px-3 ${getStatusColor(
                        dca.status
                      )}`}
                    >
                      {dca.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Amount per execution:
                      </span>
                      <span className="font-bold">
                        {dca.amountEachDCAFormatted} {dca.fromToken}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Interval:</span>
                      <span className="font-bold">{dca.intervalFormatted}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress:</span>
                      <span className="font-bold">
                        {dca.executedCount} / {dca.nbOfDCA}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{dca.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 border-2 border-ink-950">
                      <div
                        className="bg-lime-400 h-full rounded-full transition-all"
                        style={{ width: `${dca.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="border-t pt-3 mt-3 flex justify-between items-center">
                    <div className="text-xs text-gray-600">
                      <div>Started: {formatDate(dca.startTime)}</div>
                      {dca.status === DCAStatus.ACTIVE &&
                        dca.estimatedNextExecution && (
                          <div>
                            Next:{" "}
                            {formatNextExecution(dca.estimatedNextExecution)}
                          </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        Auto-Execute
                      </span>
                      {dca.moreGas && (
                        <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                          More Gas
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Stop Button - Only show for Active or Paused DCAs */}
                {/* {(dca.status === DCAStatus.ACTIVE || dca.status === DCAStatus.PAUSED) && (
                  <div className="mt-4 pt-3 border-t">
                    <button
                      onClick={(e) => handleStopDCA(dca.id, e)}
                      disabled={stoppingId === dca.id}
                      className="brut-btn bg-red-200 hover:bg-red-300 w-full text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {stoppingId === dca.id ? '⏳ Stopping...' : '🛑 Stop DCA Strategy'}
                    </button>
                  </div>
                )} */}
              </div>
            ))}
          </div>
        </>
      )}

      {dcas.length > 0 && (
        <div className="brut-card bg-blue-50 p-4">
          <h3 className="font-bold mb-2">💡 DCA Tips</h3>
          <ul className="text-sm space-y-1">
            <li>• DCA strategies execute automatically at set intervals</li>
            <li>• You can stop or update any strategy at any time</li>
            <li>
              • Make sure you maintain sufficient token balance for all
              executions
            </li>
            <li>
              • Completed strategies can be viewed for historical reference
            </li>
            <li>• Gas fees are paid automatically from your MAS balance</li>
          </ul>
        </div>
      )}
    </div>
  );
}
