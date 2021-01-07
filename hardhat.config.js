require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");

const INFURA_PROJECT_ID = "";
const INFURA_PROJECT_SECRET = "";
const PRIVATE_KEY = "";

module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.7.6",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200
                    }
                }
            },
            {
                version: "0.4.17"
            },
            {
                version: "0.5.12"
            }
        ]
    },
    networks: {
        kovan: {
            url: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
            accounts: [`0x${PRIVATE_KEY}`]
        },
        ropsten: {
            url: `https://ropsten.infura.io/v3/${INFURA_PROJECT_ID}`,
            accounts: [`0x${PRIVATE_KEY}`]
        }
    }
};
