module.exports = {
  solidity: "0.8.20",
  networks: {
    mainnet: {
      url: "https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID",
      accounts: []
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/YOUR_INFURA_PROJECT_ID",
      accounts: []
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: []
    }
  },
  etherscan: {
    apiKey: {
      mainnet: "YOUR_ETHERSCAN_API_KEY",
      bsc: "YOUR_BSCSCAN_API_KEY"
    }
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    gasPrice: 20
  }
};