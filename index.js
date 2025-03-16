// index.js
require('dotenv').config();
const { ethers } = require('ethers');

const CONFIG = {
  MNEMONIC: process.env.MNEMONIC || '',
  AMOUNT: '50%', // AMOUNT can be specified as a percentage (e.g., '100%') or as a fixed value (e.g., '10')
  INPUT_MINT: '0xinput_mint_token',
  OUTPUT_MINT: '0xoutput_mint_token',
  RPC_URL: 'https://bsc-dataseed.binance.org/',
  PANCAKESWAP_ROUTER_ADDRESS: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  WBNB_ADDRESS: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"
};

async function swapTokens(mnemonic, amount, inputMint, outputMint) {
  try {
    // Connect to provider and create wallet
    let provider, wallet, address;
    try {
      provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
      wallet = ethers.Wallet.fromMnemonic(mnemonic).connect(provider);
      address = wallet.address;
    } catch (error) {
      throw new Error('Error connecting to provider or creating wallet: ' + error.message);
    }
    
    // Get BNB balance for gas fees
    let bnbBalance;
    try {
      bnbBalance = await provider.getBalance(address);
      console.log(`BNB Balance: ${ethers.utils.formatEther(bnbBalance)} BNB`);
    } catch (error) {
      throw new Error('Error fetching BNB balance: ' + error.message);
    }
    
    // Standard ERC20 ABI
    const erc20Abi = [
      'function balanceOf(address owner) view returns (uint256)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) public returns (bool)',
      'function decimals() view returns (uint8)',
      'function name() view returns (string)'
    ];
    
    // Create contract for input token
    let inputTokenContract, inputTokenName;
    try {
      inputTokenContract = new ethers.Contract(inputMint, erc20Abi, provider);
      inputTokenName = await inputTokenContract.name();
    } catch (error) {
      throw new Error(`Error fetching token name for ${inputMint}: ` + error.message);
    }
    
    // Get token decimals and balance
    let decimals, balance;
    try {
      decimals = await inputTokenContract.decimals();
      balance = await inputTokenContract.balanceOf(address);
      console.log(`Token ${inputTokenName} balance: ${ethers.utils.formatUnits(balance, decimals)}`);
    } catch (error) {
      throw new Error('Error fetching token decimals or balance: ' + error.message);
    }
    
    // Calculate swap amount
    let amountIn;
    try {
      if (typeof amount === 'string' && amount.endsWith('%')) {
        const percent = parseFloat(amount.slice(0, -1));
        amountIn = balance.mul(ethers.BigNumber.from(percent)).div(100);
      } else {
        amountIn = ethers.utils.parseUnits(amount.toString(), decimals);
      }
      console.log(`Swap amount: ${ethers.utils.formatUnits(amountIn, decimals)} ${inputTokenName}`);
      
      if (amountIn.isZero()) {
        throw new Error(`Insufficient balance for token ${inputTokenName}`);
      }
    } catch (error) {
      throw new Error('Error calculating swap amount: ' + error.message);
    }
    
    // Determine output token
    let outputTokenName, isNativeOutput = false, outputTokenContract = null;
    try {
      if (outputMint.toUpperCase() === 'BNB') {
        outputTokenName = 'BNB';
        isNativeOutput = true;
      } else {
        outputTokenContract = new ethers.Contract(outputMint, erc20Abi, provider);
        outputTokenName = await outputTokenContract.name();
      }
    } catch (error) {
      throw new Error(`Error initializing output token ${outputMint}: ` + error.message);
    }
    
    // Set up PancakeSwap Router
    let routerAddress = CONFIG.PANCAKESWAP_ROUTER_ADDRESS;
    let routerAbi;
    if (isNativeOutput) {
      routerAbi = [
        'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
        'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)'
      ];
    } else {
      routerAbi = [
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
        'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)'
      ];
    }
    
    let router = new ethers.Contract(routerAddress, routerAbi, wallet);
    
    // Build swap path
    let path;
    try {
      if (isNativeOutput) {
        path = [inputMint, CONFIG.WBNB_ADDRESS];
      } else {
        path = [inputMint, CONFIG.WBNB_ADDRESS, outputMint];
      }
    } catch (error) {
      throw new Error('Error building swap path: ' + error.message);
    }
    
    // Check for liquidity pools for each pair using PancakeSwap factory
    try {
      const FACTORY_ADDRESS = '0xca143ce32fe78f1f7019d7d551a6402fc5350c73';
      const factoryAbi = ['function getPair(address tokenA, address tokenB) external view returns (address pair)'];
      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, factoryAbi, provider);
      
      for (let i = 0; i < path.length - 1; i++) {
        const pairAddress = await factoryContract.getPair(path[i], path[i+1]);
        if (pairAddress === ethers.constants.AddressZero) {
          throw new Error(`No liquidity pool found for pair: ${path[i]} -> ${path[i+1]}`);
        }
      }
    } catch (error) {
      throw new Error('Liquidity check error: ' + error.message);
    }
    
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
    
    // Get gas fee data
    let feeData, currentGasPrice;
    try {
      feeData = await provider.getFeeData();
      currentGasPrice = feeData.gasPrice;
    } catch (error) {
      throw new Error('Error fetching gas fee data: ' + error.message);
    }
    
    // Estimate gas for approve operation
    const approvalGasLimit = ethers.BigNumber.from("100000");
    const approvalGasCost = approvalGasLimit.mul(currentGasPrice);
    console.log(`Estimated gas for approve: ${ethers.utils.formatEther(approvalGasCost)} BNB`);
    
    // Get expected output token amount using getAmountsOut
    let amountOutMin;
    try {
      const amounts = await router.getAmountsOut(amountIn, path);
      amountOutMin = amounts[amounts.length - 1].mul(95).div(100);
      const outputDecimals = isNativeOutput ? 18 : await outputTokenContract.decimals();
      console.log(`Expected output: ${ethers.utils.formatUnits(amounts[amounts.length - 1], outputDecimals)} ${outputTokenName}`);
      console.log(`Minimum output (95%): ${ethers.utils.formatUnits(amountOutMin, outputDecimals)}`);
    } catch (error) {
      throw new Error('Error fetching getAmountsOut data: ' + error.message);
    }
    
    // Estimate gas for swap
    let estimatedSwapGas;
    try {
      if (isNativeOutput) {
        estimatedSwapGas = await router.estimateGas.swapExactTokensForETH(
          amountIn,
          amountOutMin,
          path,
          address,
          deadline
        );
      } else {
        estimatedSwapGas = await router.estimateGas.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          path,
          address,
          deadline
        );
      }
      console.log(`Estimated gas for swap: ${ethers.utils.formatEther(estimatedSwapGas.mul(currentGasPrice))} BNB`);
    } catch (error) {
      throw new Error('Error estimating gas for swap: ' + error.message);
    }
    
    const swapGasCost = estimatedSwapGas.mul(currentGasPrice);
    const totalEstimatedGasCost = approvalGasCost.add(swapGasCost);
    console.log(`Total estimated gas cost: ${ethers.utils.formatEther(totalEstimatedGasCost)} BNB`);
    
    if (bnbBalance.lt(totalEstimatedGasCost)) {
      const shortage = totalEstimatedGasCost.sub(bnbBalance);
      throw new Error(`Not enough BNB for gas fees. Short by: ${ethers.utils.formatEther(shortage)} BNB`);
    }
    
    // Prepare contract for transactions (approve, swap)
    const inputTokenWithWallet = new ethers.Contract(inputMint, erc20Abi, wallet);
    
    // Reset allowance to 0 if it is not already 0
    try {
      const currentAllowance = await inputTokenWithWallet.allowance(address, routerAddress);
      if (!currentAllowance.isZero()) {
        console.log('Resetting allowance to 0...');
        const resetTx = await inputTokenWithWallet.approve(routerAddress, 0, { gasLimit: approvalGasLimit });
        await resetTx.wait();
        console.log('Allowance reset to 0');
      }
    } catch (error) {
      throw new Error('Error resetting allowance: ' + error.message);
    }
    
    // Approve tokens for PancakeSwap Router
    try {
      console.log('Approving tokens for PancakeSwap Router...');
      const approveTx = await inputTokenWithWallet.approve(routerAddress, amountIn, { gasLimit: approvalGasLimit });
      await approveTx.wait();
      console.log('Tokens approved');
    } catch (error) {
      throw new Error('Error approving tokens: ' + error.message);
    }
    
    // Execute swap
    let swapTx;
    try {
      console.log('Executing swap...');
      if (isNativeOutput) {
        swapTx = await router.swapExactTokensForETH(
          amountIn,
          amountOutMin,
          path,
          address,
          deadline,
          { gasLimit: estimatedSwapGas }
        );
      } else {
        swapTx = await router.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          path,
          address,
          deadline,
          { gasLimit: estimatedSwapGas }
        );
      }
      await swapTx.wait();
      console.log('Swap executed successfully!');
    } catch (error) {
      throw new Error('Error executing swap: ' + error.message);
    }
    
    // Generate transaction link for BscScan
    const txLink = `https://bscscan.com/tx/${swapTx.hash}`;
    return { success: true, txLink };
    
  } catch (error) {
    throw new Error('General error in swapTokens: ' + error.message);
  }
}

// Immediately execute swapTokens
(async () => {
  try {
    const result = await swapTokens(CONFIG.MNEMONIC, CONFIG.AMOUNT, CONFIG.INPUT_MINT, CONFIG.OUTPUT_MINT);
    console.log('Swap result:', result);
  } catch (error) {
    throw error;
  }
})();
