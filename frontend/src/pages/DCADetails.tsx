import { useParams, useNavigate } from "react-router-dom";
import { useAccountStore } from "@massalabs/react-ui-kit";
import { useState, useEffect } from "react";
import { getDCA, stopDCA, updateDCA } from "../lib/dca";
import {
  DCADisplay,
  DCAStatus,
  DCA_INTERVALS,
  calculateDCAStatus,
  calculateProgress,
  estimateNextExecution,
  formatInterval,
  getTokenSymbol,
} from "../lib/dca-types";

export default function DCADetails() {
  const { id } = useParams<{ id: string }>();
  const { connectedAccount } = useAccountStore();
  const navigate = useNavigate();

  const [dca, setDca] = useState<DCADisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit form states
  const [editAmount, setEditAmount] = useState("");
  const [editIntervalIndex, setEditIntervalIndex] = useState(0);
  const [editExecutions, setEditExecutions] = useState("");
  const [editSlippage, setEditSlippage] = useState("");
  const [editMoreGas, setEditMoreGas] = useState(false);

  useEffect(() => {
    const fetchDCAData = async () => {
      if (!id || !connectedAccount) {
        setLoading(false);
        return;
      }

      try {
        console.log("Fetching DCA data for ID:", id);

        const dcaData = await getDCA(
          connectedAccount,
          BigInt(id),
          connectedAccount.address
        );

        if (!dcaData) {
          setError("DCA not found");
          setLoading(false);
          return;
        }

        // Convert to DCADisplay
        const status = calculateDCAStatus(dcaData);
        const progress = calculateProgress(dcaData);
        const estimatedNext = estimateNextExecution(dcaData);

        const dcaDisplay: DCADisplay = {
          ...dcaData,
          status,
          fromToken: getTokenSymbol(dcaData.tokenPath[0]),
          toToken: getTokenSymbol(
            dcaData.tokenPath[dcaData.tokenPath.length - 1]
          ),
          amountEachDCAFormatted: (Number(dcaData.amountEachDCA) / 1e6)
            .toFixed(6)
            .replace(/\.?0+$/, ""),
          intervalFormatted: formatInterval(dcaData.interval),
          progress,
          estimatedNextExecution: estimatedNext,
        };

        setDca(dcaDisplay);

        // Initialize edit form with current values
        setEditAmount(dcaDisplay.amountEachDCAFormatted);
        const intervalIndex = DCA_INTERVALS.findIndex(
          (i) => i.value === dcaData.interval
        );
        setEditIntervalIndex(intervalIndex >= 0 ? intervalIndex : 0);
        setEditExecutions(dcaData.nbOfDCA.toString());
        setEditSlippage((dcaData.threshold / 100).toString());
        setEditMoreGas(dcaData.moreGas);
      } catch (error) {
        console.error("Error fetching DCA data:", error);
        setError("Failed to fetch DCA data");
      } finally {
        setLoading(false);
      }
    };

    fetchDCAData();
  }, [id, connectedAccount]);

  const handleStopDCA = async () => {
    if (!connectedAccount || !dca) return;

    setActionLoading(true);

    try {
      const result = await stopDCA(connectedAccount, BigInt(dca.id));

      if (result.success) {
        setShowStopModal(false);
        // Navigate back to dashboard after successful stop
        setTimeout(() => {
          navigate("/dca/dashboard");
        }, 2000);
      }
    } catch (err) {
      console.error("Error stopping DCA:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateDCA = async () => {
    if (!connectedAccount || !dca) return;

    setActionLoading(true);

    try {
      const selectedInterval = DCA_INTERVALS[editIntervalIndex];
      const threshold = BigInt(Math.floor(parseFloat(editSlippage) * 100));

      // DUSA expects interval in milliseconds, not seconds
      const intervalMilliseconds = BigInt(selectedInterval.value * 1000);

      // Calculate MAS needed: ~0.6 MAS per execution + overhead
      // When updating, send MAS for total executions (contract may need it for all)
      const totalExecutions = parseInt(editExecutions);
      const masPerTrade = 0.6;
      const overhead = 0.1; // Add 0.1 MAS overhead for safety
      const totalMasNeeded = (
        masPerTrade * totalExecutions +
        overhead
      ).toString();

      console.log(
        `Sending ${totalMasNeeded} MAS for ${totalExecutions} total executions (${
          totalExecutions - dca.executedCount
        } remaining)`
      );

      const result = await updateDCA(
        connectedAccount,
        BigInt(dca.id),
        editAmount,
        intervalMilliseconds,
        BigInt(editExecutions),
        dca.tokenPath,
        threshold,
        editMoreGas,
        totalMasNeeded
      );

      if (result.success) {
        setShowEditModal(false);
        // Navigate back to dashboard after successful update
        setTimeout(() => {
          navigate("/dca/dashboard");
        }, 2000);
      }
    } catch (err) {
      console.error("Error updating DCA:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  if (loading) {
    return <div className="brut-card bg-white p-6">Loading DCA details...</div>;
  }

  if (error || !dca) {
    return (
      <div className="brut-card bg-white p-6">
        <p className="text-red-600">Error: {error || "DCA not found"}</p>
        <button
          onClick={() => navigate("/dca/dashboard")}
          className="brut-btn bg-blue-200 mt-4"
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const canEdit =
    dca.status === DCAStatus.ACTIVE || dca.status === DCAStatus.PAUSED;
  const canStop =
    dca.status === DCAStatus.ACTIVE || dca.status === DCAStatus.PAUSED;

  return (
    <>
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main DCA Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="brut-card bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <button
                  onClick={() => navigate("/dca/dashboard")}
                  className="text-sm text-gray-600 hover:text-gray-900 mb-2"
                >
                  ← Back to Dashboard
                </button>
                <h1 className="text-3xl font-black">
                  {dca.fromToken} → {dca.toToken}
                </h1>
                <p className="text-sm text-gray-600">DCA Strategy #{dca.id}</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className={`brut-btn ${getStatusColor(dca.status)}`}>
                  {dca.status}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="brut-card bg-lime-200 p-4">
                <p className="text-sm font-bold">Amount per Buy</p>
                <p className="text-xl font-black">
                  {dca.amountEachDCAFormatted} {dca.fromToken}
                </p>
              </div>
              <div className="brut-card bg-yellow-200 p-4">
                <p className="text-sm font-bold">Interval</p>
                <p className="text-xl font-black">{dca.intervalFormatted}</p>
              </div>
              <div className="brut-card bg-blue-200 p-4">
                <p className="text-sm font-bold">Progress</p>
                <p className="text-xl font-black">
                  {dca.executedCount} / {dca.nbOfDCA}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span className="font-bold">Execution Progress</span>
                <span className="font-bold">{dca.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 border-3 border-ink-950">
                <div
                  className="bg-lime-400 h-full rounded-full transition-all flex items-center justify-end pr-2"
                  style={{ width: `${dca.progress}%` }}
                >
                  {dca.progress > 10 && (
                    <span className="text-xs font-bold text-ink-950">
                      {dca.progress}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {connectedAccount && (
              <div className="flex gap-3">
                {canEdit && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="brut-btn bg-blue-300"
                  >
                    Edit Strategy
                  </button>
                )}
                {canStop && (
                  <button
                    onClick={() => setShowStopModal(true)}
                    className="brut-btn bg-red-300 border-red-500"
                  >
                    Stop Strategy
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Strategy Details */}
          <div className="brut-card bg-white p-6">
            <h2 className="text-xl font-black mb-4">Strategy Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Strategy ID:</span>
                <span className="font-bold">#{dca.id}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">From Token:</span>
                <span className="font-bold">{dca.fromToken}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">To Token:</span>
                <span className="font-bold">{dca.toToken}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Amount per Execution:</span>
                <span className="font-bold">
                  {dca.amountEachDCAFormatted} {dca.fromToken}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Total Executions:</span>
                <span className="font-bold">{dca.nbOfDCA}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Completed Executions:</span>
                <span className="font-bold">{dca.executedCount}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Interval:</span>
                <span className="font-bold">{dca.intervalFormatted}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Slippage Tolerance:</span>
                <span className="font-bold">
                  {(dca.threshold / 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">More Gas:</span>
                <span className="font-bold">{dca.moreGas ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Started:</span>
                <span className="font-bold">{formatDate(dca.startTime)}</span>
              </div>
              {dca.status === DCAStatus.COMPLETED && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Completed:</span>
                  <span className="font-bold">{formatDate(dca.endTime)}</span>
                </div>
              )}
              {dca.estimatedNextExecution &&
                dca.status === DCAStatus.ACTIVE && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Next Execution:</span>
                    <span className="font-bold">
                      {formatDate(dca.estimatedNextExecution)}
                    </span>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Total Investment */}
          <div className="brut-card bg-gradient-to-r from-lime-100 to-yellow-100 p-6">
            <h3 className="text-lg font-bold mb-2">Total Investment</h3>
            <p className="text-3xl font-black mb-2">
              {(parseFloat(dca.amountEachDCAFormatted) * dca.nbOfDCA).toFixed(
                6
              )}{" "}
              {dca.fromToken}
            </p>
            <p className="text-sm text-gray-600">
              Across {dca.nbOfDCA} executions
            </p>
          </div>

          {/* Execution Stats */}
          <div className="brut-card bg-white p-6">
            <h3 className="text-lg font-bold mb-3">Execution Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Completed:</span>
                <span className="font-bold">{dca.executedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Remaining:</span>
                <span className="font-bold">
                  {dca.nbOfDCA - dca.executedCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Invested:</span>
                <span className="font-bold">
                  {(
                    parseFloat(dca.amountEachDCAFormatted) * dca.executedCount
                  ).toFixed(6)}{" "}
                  {dca.fromToken}
                </span>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="brut-card bg-blue-50 p-6">
            <h3 className="text-lg font-bold mb-3">How DCA Works</h3>
            <div className="text-sm space-y-2">
              <p>• Automated purchases at regular intervals</p>
              <p>• Reduces impact of price volatility</p>
              <p>• Average out purchase prices over time</p>
              <p>• Set and forget investment strategy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border-3 border-ink-950 shadow-brut max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black">Edit DCA Strategy</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-2xl font-bold hover:bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block mb-2">
                    <span className="font-bold">Amount Per Execution</span>
                    <input
                      type="number"
                      step="0.000001"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="mt-1 w-full border-3 border-ink-950 rounded-2xl p-3"
                    />
                  </label>
                </div>

                <div>
                  <label className="block mb-2">
                    <span className="font-bold">Execution Interval</span>
                    <select
                      value={editIntervalIndex}
                      onChange={(e) =>
                        setEditIntervalIndex(parseInt(e.target.value))
                      }
                      className="mt-1 w-full border-3 border-ink-950 rounded-2xl p-3"
                    >
                      {DCA_INTERVALS.map((interval, index) => (
                        <option key={index} value={index}>
                          {interval.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <label className="block mb-2">
                    <span className="font-bold">Number of Executions</span>
                    <input
                      type="number"
                      min="1"
                      value={editExecutions}
                      onChange={(e) => setEditExecutions(e.target.value)}
                      className="mt-1 w-full border-3 border-ink-950 rounded-2xl p-3"
                    />
                  </label>
                </div>

                <div>
                  <label className="block mb-2">
                    <span className="font-bold">Slippage Tolerance (%)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={editSlippage}
                      onChange={(e) => setEditSlippage(e.target.value)}
                      className="mt-1 w-full border-3 border-ink-950 rounded-2xl p-3"
                    />
                  </label>
                </div>

                <div className="brut-card bg-gray-50 p-4">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={editMoreGas}
                        onChange={(e) => setEditMoreGas(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div
                        className={`w-6 h-6 border-3 border-ink-950 rounded-lg transition-all ${
                          editMoreGas ? "bg-blue-300" : "bg-white"
                        }`}
                      >
                        {editMoreGas && (
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
                    </div>
                  </label>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="brut-btn bg-white flex-1"
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateDCA}
                    className="brut-btn bg-lime-300 flex-1"
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Updating..." : "Update Strategy"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stop Confirmation Modal */}
      {showStopModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border-3 border-ink-950 shadow-brut max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-black mb-4">Stop DCA Strategy?</h2>
              <p className="text-gray-700 mb-6">
                Are you sure you want to stop this DCA strategy? This action
                cannot be undone. You will need to create a new strategy if you
                want to resume DCA.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowStopModal(false)}
                  className="brut-btn bg-white flex-1"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleStopDCA}
                  className="brut-btn bg-red-300 border-red-500 flex-1"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Stopping..." : "Stop Strategy"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
