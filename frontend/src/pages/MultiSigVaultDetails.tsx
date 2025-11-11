import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAccountStore } from "@massalabs/react-ui-kit";
import { toast } from "react-toastify";
import {
  getMultiSigVaultInfo,
  getPendingProposals,
  getProposal,
  depositToMultiSigVault,
  proposeWithdrawal,
  approveProposal,
  MultiSigVaultInfo,
  Proposal,
} from "../lib/multiSigVault";
import { AVAILABLE_TOKENS, USDC_TOKEN_ADDRESS } from "../lib/types";
import { formatUnits } from "@massalabs/massa-web3";

export default function MultiSigVaultDetails() {
  const { id } = useParams<{ id: string }>();
  const { connectedAccount } = useAccountStore();

  const [vaultInfo, setVaultInfo] = useState<MultiSigVaultInfo | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [proposalToken, setProposalToken] = useState(USDC_TOKEN_ADDRESS);
  const [proposalAmount, setProposalAmount] = useState("");
  const [proposalRecipient, setProposalRecipient] = useState("");

  // Load vault data
  useEffect(() => {
    if (connectedAccount && id) {
      loadVaultData();
    }
  }, [connectedAccount, id]);

  const loadVaultData = async () => {
    if (!connectedAccount || !id) return;

    setLoading(true);
    try {
      // Get vault info
      const info = await getMultiSigVaultInfo(connectedAccount, id);
      console.log("Vault info loaded:", info);
      console.log("Total proposal count from vault:", info?.proposalCount);
      setVaultInfo(info);

      // Get pending proposals
      const pendingIds = await getPendingProposals(connectedAccount, id);
      console.log("Pending proposal IDs from contract:", pendingIds);

      if (pendingIds.length === 0) {
        console.log("No pending proposals found");
        setProposals([]);
        return;
      }

      // Try to fetch each proposal with error handling
      const proposalDetails: (Proposal | null)[] = [];
      for (const proposalId of pendingIds) {
        console.log(`\nAttempting to fetch proposal ${proposalId}...`);
        const proposal = await getProposal(connectedAccount, id, proposalId);
        if (proposal) {
          console.log(`✓ Successfully loaded proposal ${proposalId}`);
          proposalDetails.push(proposal);
        } else {
          console.warn(
            `✗ Failed to load proposal ${proposalId} - it may have been executed`
          );
        }
      }

      const validProposals = proposalDetails.filter(
        (p) => p !== null
      ) as Proposal[];
      console.log(
        `\nLoaded ${validProposals.length} valid proposals out of ${pendingIds.length} pending IDs`
      );
      setProposals(validProposals);
    } catch (error) {
      console.error("Error loading vault data:", error);
      toast.error("Failed to load vault data");
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!connectedAccount || !id) return;

    const result = await depositToMultiSigVault(
      connectedAccount,
      id,
      depositAmount
    );

    if (result.success) {
      setShowDepositModal(false);
      setDepositAmount("");
      loadVaultData();
    }
  };

  const handleCreateProposal = async () => {
    if (!connectedAccount || !id) return;

    const result = await proposeWithdrawal(
      connectedAccount,
      id,
      proposalToken,
      proposalAmount,
      proposalRecipient
    );

    if (result.success) {
      setShowProposalModal(false);
      setProposalAmount("");
      setProposalRecipient("");
      loadVaultData();
    }
  };

  const handleApprove = async (proposalId: number) => {
    if (!connectedAccount || !id) return;

    const result = await approveProposal(connectedAccount, id, proposalId);

    if (result.success) {
      loadVaultData();
    }
  };

  const isSigner = (address: string): boolean => {
    if (!vaultInfo) return false;
    return vaultInfo.signers.some(
      (s) => s.toLowerCase() === address.toLowerCase()
    );
  };

  const hasApproved = (proposal: Proposal, address: string): boolean => {
    return proposal.approvals.some(
      (a) => a.toLowerCase() === address.toLowerCase()
    );
  };

  const getTokenSymbol = (address: string): string => {
    const token = AVAILABLE_TOKENS.find(
      (t) => t.address.toLowerCase() === address.toLowerCase()
    );
    return token?.symbol || "Unknown";
  };

  if (loading) {
    return (
      <div className="brut-card bg-white p-8 text-center">
        <p className="text-gray-600">Loading vault details...</p>
      </div>
    );
  }

  if (!vaultInfo) {
    return (
      <div className="brut-card bg-white p-8 text-center">
        <p className="text-gray-600">Vault not found</p>
        <Link to="/dashboard" className="brut-btn bg-blue-300 mt-4">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const userAddress = connectedAccount?.address || "";
  const isUserSigner = isSigner(userAddress);

  console.log("Current user check:", {
    userAddress,
    isUserSigner,
    vaultSigners: vaultInfo?.signers,
  });

  return (
    <div className="space-y-6">
      {/* Vault Header */}
      <div className="brut-card bg-gradient-to-r from-purple-400 to-pink-400 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">
              {vaultInfo.vaultName}
            </h1>
            <p className="text-white/90 mt-1">
              🔐 {vaultInfo.threshold} of {vaultInfo.signers.length} Multi-Sig
              Vault
            </p>
          </div>
          <div className="brut-card bg-white p-4">
            <p className="text-sm font-semibold text-gray-600">Vault Address</p>
            <p className="font-mono text-xs mt-1">
              {id?.slice(0, 10)}...{id?.slice(-8)}
            </p>
          </div>
        </div>
      </div>

      {/* Signers */}
      <div className="brut-card bg-white p-6">
        <h2 className="text-xl font-bold mb-4">
          Signers ({vaultInfo.signers.length})
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {vaultInfo.signers.map((signer, index) => (
            <div
              key={index}
              className={`brut-card p-4 ${
                signer.toLowerCase() === userAddress.toLowerCase()
                  ? "bg-lime-100"
                  : "bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-mono text-xs">
                    {signer.slice(0, 12)}...{signer.slice(-8)}
                  </p>
                  {signer.toLowerCase() === userAddress.toLowerCase() && (
                    <p className="text-xs font-bold text-lime-700">You</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {isUserSigner && (
        <div className="grid md:grid-cols-2 gap-4">
          <button
            onClick={() => setShowDepositModal(true)}
            className="brut-btn bg-lime-300 p-6 text-lg"
          >
            💰 Deposit Funds
          </button>
          <button
            onClick={() => setShowProposalModal(true)}
            className="brut-btn bg-yellow-300 p-6 text-lg"
          >
            📝 Propose Withdrawal
          </button>
        </div>
      )}

      {/* Pending Proposals */}
      <div className="brut-card bg-white p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            Pending Proposals ({proposals.length})
          </h2>
          <button
            onClick={loadVaultData}
            className="brut-btn bg-blue-300 text-sm"
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>

        {proposals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No pending proposals</p>
            {vaultInfo && vaultInfo.proposalCount > 0 && (
              <div className="mt-4 brut-card bg-yellow-50 p-4 max-w-md mx-auto">
                <p className="text-sm text-gray-700">
                  💡 The vault has {vaultInfo.proposalCount} total proposal(s),
                  but none are currently pending.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  They may have been executed or the blockchain state is
                  syncing. Try refreshing in a few seconds.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => {
              const userHasApproved = hasApproved(proposal, userAddress);
              const approvalsNeeded =
                vaultInfo.threshold - proposal.approvals.length;

              console.log(`Proposal ${proposal.id} check:`, {
                userAddress,
                isUserSigner,
                userHasApproved,
                approvals: proposal.approvals,
              });

              return (
                <div key={proposal.id} className="brut-card bg-yellow-50 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold">Proposal #{proposal.id}</h3>
                      <p className="text-sm text-gray-600">
                        Proposed by {proposal.proposer.slice(0, 10)}...
                        {proposal.proposer.slice(-6)}
                      </p>
                    </div>
                    <span className="brut-btn bg-white text-xs py-1 px-3">
                      {proposal.approvals.length}/{vaultInfo.threshold}
                    </span>
                  </div>

                  <div className="brut-card bg-white p-3 mb-3">
                    <p className="text-sm font-semibold">
                      Withdraw{" "}
                      {(() => {
                        const tokenInfo = AVAILABLE_TOKENS.find(
                          (t) =>
                            t.address.toLowerCase() ===
                            proposal.token.toLowerCase()
                        );
                        const decimals = tokenInfo?.decimals || 6;
                        return formatUnits(BigInt(proposal.amount), decimals);
                      })()}{" "}
                      {getTokenSymbol(proposal.token)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      To: {proposal.recipient.slice(0, 12)}...
                      {proposal.recipient.slice(-8)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {proposal.approvals.map((approval, idx) => (
                        <div
                          key={idx}
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-lime-400 border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                          title={approval}
                        >
                          ✓
                        </div>
                      ))}
                    </div>

                    {isUserSigner && !userHasApproved && (
                      <button
                        onClick={() => handleApprove(proposal.id)}
                        className="brut-btn bg-lime-300"
                      >
                        Approve
                      </button>
                    )}

                    {userHasApproved && (
                      <span className="brut-btn bg-green-200 text-xs">
                        ✓ You Approved
                      </span>
                    )}
                  </div>

                  {approvalsNeeded > 0 && (
                    <p className="text-xs text-gray-600 mt-2">
                      {approvalsNeeded} more approval
                      {approvalsNeeded > 1 ? "s" : ""} needed
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="brut-card bg-white p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Deposit Funds</h3>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount (USDC)"
              className="w-full border-3 border-ink-950 rounded-2xl px-4 py-3 font-bold mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDeposit}
                className="brut-btn bg-lime-300 flex-1"
              >
                Deposit
              </button>
              <button
                onClick={() => setShowDepositModal(false)}
                className="brut-btn bg-gray-300 flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Modal */}
      {showProposalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="brut-card bg-white p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">
              Create Withdrawal Proposal
            </h3>
            <div className="space-y-3">
              <select
                value={proposalToken}
                onChange={(e) => setProposalToken(e.target.value)}
                className="w-full border-3 border-ink-950 rounded-2xl px-4 py-3 font-bold"
              >
                {AVAILABLE_TOKENS.map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.symbol}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={proposalAmount}
                onChange={(e) => setProposalAmount(e.target.value)}
                placeholder="Amount"
                className="w-full border-3 border-ink-950 rounded-2xl px-4 py-3 font-bold"
              />
              <input
                type="text"
                value={proposalRecipient}
                onChange={(e) => setProposalRecipient(e.target.value)}
                placeholder="Recipient Address (AS1...)"
                className="w-full border-3 border-ink-950 rounded-2xl px-4 py-3 font-mono text-sm"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCreateProposal}
                className="brut-btn bg-yellow-300 flex-1"
              >
                Create Proposal
              </button>
              <button
                onClick={() => setShowProposalModal(false)}
                className="brut-btn bg-gray-300 flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
