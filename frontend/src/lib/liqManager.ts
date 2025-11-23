import {
  Args,
  bytesToStr,
  formatUnits,
  MRC20,
  OperationStatus,
  parseMas,
  parseUnits,
  Provider,
  SmartContract,
} from "@massalabs/massa-web3";
import { toast } from "react-toastify";

export async function getLiqManagerContract(
  connectedAccount: Provider
): Promise<SmartContract> {
  const address = import.meta.env.VITE_LIQ_MANAGER_CONTRACT;

  if (!address) {
    throw new Error("Liq Manager contract address is not defined");
  }

  return new SmartContract(connectedAccount, address);
}

export async function deposit(
  connectedAccount: any,
  amountX: string,
  amountY: string,
  xDecimals: number,
  yDecimals: number
): Promise<{ success: boolean; error?: string }> {
  const toastId = toast.loading(
    "Depositing liquidity to the Liq Manager vault..."
  );

  try {
    console.log("💰 Starting deposit:");
    console.log("  - Amount X:", amountX, "decimals:", xDecimals);
    console.log("  - Amount Y:", amountY, "decimals:", yDecimals);

    const contract = await getLiqManagerContract(connectedAccount);
    console.log("  - Contract address:", contract.address);

    const parsedAmountX = parseUnits(amountX, xDecimals);
    const parsedAmountY = parseUnits(amountY, yDecimals);
    console.log("  - Parsed Amount X:", parsedAmountX.toString());
    console.log("  - Parsed Amount Y:", parsedAmountY.toString());

    const args = new Args()
      .addU256(parsedAmountX)
      .addU256(parsedAmountY);

    const operation = await contract.call("deposit", args, {
      coins: parseMas("0.1"),
    });

    console.log("✅ Deposit transaction sent:", operation.id);

    toast.update(toastId, {
      render: "Waiting for transaction confirmation...",
      isLoading: true,
    });

    const status = await operation.waitSpeculativeExecution();
    console.log("📊 Transaction status:", status);

    if (status === OperationStatus.SpeculativeSuccess) {
      const events = await operation.getSpeculativeEvents();
      console.log("✅ Deposit successful! Events:", events);

      toast.update(toastId, {
        render: "Liquidity deposited successfully!",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });

      return { success: true };
    } else {
      const events = await operation.getSpeculativeEvents();
      console.log("❌ Deposit failed, events:", events);

      toast.update(toastId, {
        render: "Liquidity deposit failed.",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });

      return { success: false, error: "Deposit Transaction failed" };
    }
  } catch (error) {
    console.error("❌ Error depositing liquidity:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    toast.update(toastId, {
      render: `Error: ${errorMessage}`,
      type: "error",
      isLoading: false,
      autoClose: 5000,
    });

    return { success: false, error: errorMessage };
  }
}

export async function approveToken(
  connectedAccount: any,
  tokenDetail: TokenDetails,
  amount: string
): Promise<{ success: boolean; error?: string }> {
  const toastId = toast.loading(`Approving ${tokenDetail.symbol} spending...`);

  try {
    const spenderAddress = import.meta.env.VITE_LIQ_MANAGER_CONTRACT;

    if (!spenderAddress) {
      throw new Error("Liq Manager contract address is not defined");
    }

    const tokenContract = new MRC20(connectedAccount, tokenDetail.address);

    const amountParsed = parseUnits(amount, tokenDetail.decimals);

    const operation = await tokenContract.increaseAllowance(
      spenderAddress,
      amountParsed,
      {
        coins: parseMas("0.1"),
      }
    );

    toast.update(toastId, {
      render: "Waiting for approval confirmation...",
      isLoading: true,
    });

    const status = await operation.waitSpeculativeExecution();

    if (status === OperationStatus.SpeculativeSuccess) {
      toast.update(toastId, {
        render: `${tokenDetail.symbol} spending approved successfully!`,
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });

      return { success: true };
    } else {
      const events = await operation.getSpeculativeEvents();
      console.log("Approval failed, events:", events);

      toast.update(toastId, {
        render: "Token approval failed",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });

      return { success: false, error: "Token approval failed" };
    }
  } catch (error) {
    console.error("Error approving token:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    toast.update(toastId, {
      render: `Error: ${errorMessage}`,
      type: "error",
      isLoading: false,
      autoClose: 5000,
    });

    return { success: false, error: errorMessage };
  }
}

export async function fetchSpotPrice(connectedAccount: any): Promise<string> {
  try {
    const contract = await getLiqManagerContract(connectedAccount);

    const result = await contract.read("fetchSpotPrice");
    const spotPriceBytes = result.value;

    if (!spotPriceBytes || spotPriceBytes.length === 0) {
      throw new Error("No spot price data returned from contract");
    }

    // Assuming spot price is returned as u256 in bytes
    const price = new Args(spotPriceBytes).nextU256();

    // Convert to a human-readable string
    return formatUnits(price, 18);
  } catch (error) {
    console.error("Error fetching spot price:", error);
    return "0";
  }
}

export async function getTokenXAddress(connectedAccount: any): Promise<string> {
  const contract = await getLiqManagerContract(connectedAccount);
  const result = await contract.read("getTokenXAddress");
  const tokenXAddressBytes = result.value;
  return bytesToStr(tokenXAddressBytes);
}

export async function getTokenYAddress(connectedAccount: any): Promise<string> {
  const contract = await getLiqManagerContract(connectedAccount);
  const result = await contract.read("getTokenYAddress");
  const tokenYAddressBytes = result.value;
  return bytesToStr(tokenYAddressBytes);
}

export async function getVaultTokensDetails(
  connectedAccount: any
): Promise<TokenDetails[]> {
  const tokenXAddress = await getTokenXAddress(connectedAccount);
  const tokenYAddress = await getTokenYAddress(connectedAccount);

  const tokenXContract = new MRC20(connectedAccount, tokenXAddress);
  const tokenYContract = new MRC20(connectedAccount, tokenYAddress);

  const tokenXDecimals = await tokenXContract.decimals();
  const tokenYDecimals = await tokenYContract.decimals();
  const tokenXSymbol = await tokenXContract.symbol();
  const tokenYSymbol = await tokenYContract.symbol();

  return [
    { address: tokenXAddress, decimals: tokenXDecimals, symbol: tokenXSymbol },
    { address: tokenYAddress, decimals: tokenYDecimals, symbol: tokenYSymbol },
  ];
}

export async function getLiqShares(
  connectedAccount: any
): Promise<{ formatted: string; raw: string }> {
  try {
    const contractAddress = import.meta.env.VITE_LIQ_MANAGER_CONTRACT;

    console.log("🔍 getLiqShares - Contract Address:", contractAddress);
    console.log("🔍 getLiqShares - User Address:", connectedAccount.address);

    if (!contractAddress) {
      throw new Error("Liq Manager contract address is not defined");
    }

    const contract = new MRC20(connectedAccount, contractAddress);

    console.log("🔍 getLiqShares - Calling balanceOf...");
    const balance = await contract.balanceOf(connectedAccount.address);

    console.log("🔍 getLiqShares - Raw balance (u256):", balance.toString());

    const formattedBalance = formatUnits(balance, 18);
    console.log("🔍 getLiqShares - Formatted balance:", formattedBalance);

    return { formatted: formattedBalance, raw: balance.toString() };
  } catch (error) {
    console.error("❌ Error fetching liquidity shares:", error);
    return { formatted: "0", raw: "0" };
  }
}

export async function getTotalSupply(connectedAccount: any): Promise<string> {
  try {
    const contractAddress = import.meta.env.VITE_LIQ_MANAGER_CONTRACT;

    if (!contractAddress) {
      throw new Error("Liq Manager contract address is not defined");
    }

    const contract = new MRC20(connectedAccount, contractAddress);
    const totalSupply = await contract.totalSupply();

    console.log("🔍 getTotalSupply - Raw total supply:", totalSupply.toString());

    return totalSupply.toString();
  } catch (error) {
    console.error("❌ Error fetching total supply:", error);
    return "0";
  }
}

export async function withdraw(
  connectedAccount: any,
  shares: number
): Promise<{ success: boolean; error?: string }> {
  const toastId = toast.loading(
    "Withdrawing liquidity from the Liq Manager vault..."
  );

  try {
    const contract = await getLiqManagerContract(connectedAccount);

    const args = new Args()
      .addString(connectedAccount.address)
      .addU256(parseUnits(shares.toFixed(19), 18));

    const operation = await contract.call("withdraw", args, {
      coins: parseMas("0.1"),
    });

    toast.update(toastId, {
      render: "Waiting for transaction confirmation...",
      isLoading: true,
    });

    const status = await operation.waitSpeculativeExecution();

    if (status === OperationStatus.SpeculativeSuccess) {
      toast.update(toastId, {
        render: "Liquidity withdrawn successfully!",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });

      return { success: true };
    } else {
      const events = await operation.getSpeculativeEvents();
      console.log("Withdraw failed, events:", events);

      toast.update(toastId, {
        render: "Liquidity withdrawal failed.",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });

      return { success: false, error: "Withdrawal Transaction failed" };
    }
  } catch (error) {
    console.error("Error withdrawing liquidity:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    toast.update(toastId, {
      render: `Error: ${errorMessage}`,
      type: "error",
      isLoading: false,
      autoClose: 5000,
    });

    return { success: false, error: errorMessage };
  }
}

export interface TokenDetails {
  address: string;
  decimals: number;
  symbol: string;
}
