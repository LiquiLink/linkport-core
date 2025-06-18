# Web3 Multi-Token Wallet

This project implements a multi-token wallet on the Ethereum blockchain using Solidity and Hardhat. The wallet supports multiple cryptocurrencies and provides functionalities for depositing, withdrawing, and transferring tokens between users. Additionally, it includes a mechanism to verify an administrator's signature for transfers.

## Features

- **Multi-Token Support**: Users can deposit and withdraw various ERC20 tokens.
- **Transfer Functionality**: Users can transfer tokens to other users after verifying the administrator's signature.
- **Signature Verification**: Ensures that only authorized transfers are executed.

## Project Structure

```
web3-multitoken-wallet
├── contracts
│   ├── MultiTokenWallet.sol       # Solidity smart contract for the wallet
├── scripts
│   ├── deploy.ts                  # Script to deploy the contract
│   └── interact.ts                # Script to interact with the deployed contract
├── test
│   └── MultiTokenWallet.test.ts   # Test cases for the contract
├── hardhat.config.ts              # Hardhat configuration file
├── package.json                   # npm configuration file
├── tsconfig.json                  # TypeScript configuration file
└── README.md                      # Project documentation
```

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/web3-multitoken-wallet.git
   cd web3-multitoken-wallet
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Compile the contracts:
   ```
   npx hardhat compile
   ```

## Deployment

To deploy the MultiTokenWallet contract to the Ethereum network, run the following command:
```
npx hardhat run scripts/deploy.ts --network <network_name>
```
Replace `<network_name>` with the desired Ethereum network (e.g., rinkeby, mainnet).

## Usage

After deploying the contract, you can interact with it using the `interact.ts` script. This script allows you to:

- Deposit tokens into the wallet.
- Withdraw tokens from the wallet.
- Transfer tokens between users with administrator signature verification.

## Testing

To run the test cases for the MultiTokenWallet contract, use the following command:
```
npx hardhat test
```

## License

This project is licensed under the MIT License. See the LICENSE file for more details.