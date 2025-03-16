# Token Swap Script for PancakeSwap on Binance Smart Chain

This Node.js script leverages the [ethers.js](https://docs.ethers.org/) library to perform token swaps on the Binance Smart Chain (BSC) using the PancakeSwap router. It supports swapping ERC20 tokens by specifying both input and output tokens, and can also handle native swaps to BNB.

---

## Features

- **Token Swapping:** Execute swaps via PancakeSwap router.
- **Flexible Amount Specification:** Specify the swap amount as a percentage (e.g., `100%` of your balance) or as a fixed value.
- **Robust Error Handling:** Uses nested try/catch blocks to throw detailed errors for every critical operation.
- **Allowance Management:** Automatically resets token allowance if needed before approving the swap.
- **Gas Estimation:** Retrieves gas fee data and estimates gas costs for both approval and swap transactions.
- **Transaction Tracking:** Generates a BscScan transaction link upon a successful swap.

---

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/vkidik/bsc-uniswap-swap.git
   ```

2. **Navigate to the Project Directory:**

   ```bash
   cd bsc-uniswap-swap
   ```

3. **Install Dependencies:**

   ```bash
   npm install
   ```

---

## Configuration

Create a `.env` file in the root directory of the project with the following content:

```dotenv
MNEMONIC=your_wallet_mnemonic_here
```

You can adjust other configurations directly in the `CONFIG` object within `index.js`:

- **MNEMONIC:** Your wallet mnemonic (12-24 words) for generating the wallet.
- **AMOUNT:** The token swap amount, either as a percentage (e.g., `100%`) or a fixed number (e.g., `10`).
- **INPUT_MINT:** Contract address of the input token (for example, USDT on BSC).
- **OUTPUT_MINT:** Contract address of the output token. Use `"BNB"` (case insensitive) to swap for native BNB.
- **RPC_URL:** Binance Smart Chain RPC URL (e.g., `https://bsc-dataseed.binance.org/`).
- **PANCAKESWAP_ROUTER_ADDRESS:** PancakeSwap Router contract address.
- **WBNB_ADDRESS:** Wrapped BNB contract address on BSC.

---

## Usage

Run the script using Node.js:

```bash
node index.js
```

### Process Overview

1. **Connection & Wallet Initialization:**  
   Connects to the BSC network via the provided RPC URL and generates a wallet using your mnemonic.

2. **Balance & Token Data Retrieval:**  
   Retrieves your BNB balance (for gas fees) and fetches the ERC20 token balance along with token details (name and decimals).

3. **Swap Amount Calculation:**  
   Determines the swap amount based on the provided percentage or fixed value.

4. **Swap Path Determination:**  
   Constructs the swap path. For a native output (BNB), the path is `[inputToken, WBNB]`; for ERC20 swaps, it’s `[inputToken, WBNB, outputToken]`.

5. **Gas Fee Estimation:**  
   Estimates gas fees for token approval and the swap transaction.

6. **Allowance Reset & Approval:**  
   Resets the token allowance (if non-zero) and approves the PancakeSwap Router to spend the tokens.

7. **Swap Execution:**  
   Executes the swap transaction and awaits confirmation.

8. **Transaction Link Generation:**  
   Outputs a transaction link for BscScan if the swap is successful.

---

## Error Handling

The script uses nested try/catch blocks to throw errors at each critical step. Any encountered error is propagated with a descriptive message, making it easier to diagnose issues such as:

- Connection or wallet creation failures.
- Insufficient BNB balance for gas fees.
- Errors in fetching token details.
- Failures during gas estimation or transaction execution.

