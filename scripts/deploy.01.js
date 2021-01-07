//================================================================================
// Pre Deployments
// Only deploy once for each network
//================================================================================

require("@nomiclabs/hardhat-ethers");

async function main() {

    const network = await ethers.provider.getNetwork();
    console.log('Network:', network.name, network.chainId);

    const [deployer] = await ethers.getSigners();
    console.log('Deployer:', deployer.address);
    console.log('Deployer Balance:', ethers.utils.formatEther(await deployer.getBalance()));

    // Deploy bToken USDT
    const USDT = await ethers.getContractFactory('TestTetherToken');
    const usdt = await USDT.deploy('Tether USD', 'USDT');
    console.log('bToken USDT:', usdt.address);

    // Deploy bToken DAI
    const DAI = await ethers.getContractFactory('Dai');
    const dai = await DAI.deploy(network.chainId);
    console.log('bToken DAI:', dai.address);

    // Deploy CloneFactory
    const CloneFactory = await ethers.getContractFactory('CloneFactory');
    const cloneFactory = await CloneFactory.deploy();
    console.log('cloneFactory:', cloneFactory.address);

    // Deploy PerpetualPool Template
    const PerpetualPool = await ethers.getContractFactory('PerpetualPool');
    const perpetualPoolTemplate = await PerpetualPool.deploy();
    console.log('PerpetualPool Template:', perpetualPoolTemplate.address);

}


main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
