//================================================================================
// Deploy PerpetualPool with USDT
//================================================================================

require('@nomiclabs/hardhat-ethers');

async function main() {

    const kovan = {
        usdt:                   '0x6e28e5EC8f97164Da81c4E13F4C79B2B9ac41Ed1',
        dai:                    '0x53dE9B1A7b4c090dA2ca838E03af1C3C03054677',
        cloneFactory:           '0xD92921100f858aE323db8281ED66eC67F0c4cCD0',
        perpetualPoolTemplate:  '0x5C111D321648Dd8108ccA7c9868bDD4cF365DdFF'
    };
    const ropsten = {
        usdt:                   '0x8F038C454B6E68B2988706a1a5f78dE2C4634097',
        dai:                    '0x7382B8013bAF81850d5D4d2B109bc184d9D12383',
        cloneFactory:           '0xE76CD84f01082B005C19F8873B0910aF9e859f16',
        perpetualPoolTemplate:  '0x12557a47d860fE67dEB5b104CE885A197EC8005F'
    }

    function rescale(value, fromDecimals, toDecimals) {
        let from = ethers.BigNumber.from('1' + '0'.repeat(fromDecimals));
        let to = ethers.BigNumber.from('1' + '0'.repeat(toDecimals));
        return ethers.BigNumber.from(value).mul(to).div(from);
    }

    const one = rescale(1, 0, 18);

    const symbol = 'BTCUSD';
    const multiplier = one.div(10000);
    const feeRatio = one.mul(5).div(20000);
    const minPoolMarginRatio = one;
    const minInitialMarginRatio = one.div(10);
    const minMaintenanceMarginRatio = one.div(20);
    const minAddLiquidity = one.mul(100);
    const redemptionFeeRatio = one.mul(5).div(1000);
    const fundingRateCoefficient = one.div(100000);
    const minLiquidationReward = one.mul(20);
    const maxLiquidationReward = one.mul(200);
    const liquidationCutRatio = one.div(4);
    const priceDelayAllowance = 100;

    const network = await ethers.provider.getNetwork();
    console.log('Network:', network.name, network.chainId);

    const [deployer] = await ethers.getSigners();
    console.log('Deployer:', deployer.address);
    console.log('Deployer Balance:', ethers.utils.formatEther(await deployer.getBalance()));

    let bToken;
    let cloneFactory;
    let perpetualPoolTemplate;
    if (network.name == 'kovan') {
        bToken = await ethers.getContractAt('TestTetherToken', kovan.usdt);
        cloneFactory = await ethers.getContractAt('CloneFactory', kovan.cloneFactory);
        perpetualPoolTemplate = await ethers.getContractAt('PerpetualPool', kovan.perpetualPoolTemplate);
    } else if (network.name == 'ropsten') {
        bToken = await ethers.getContractAt('TestTetherToken', ropsten.usdt);
        cloneFactory = await ethers.getContractAt('CloneFactory', ropsten.cloneFactory);
        perpetualPoolTemplate = await ethers.getContractAt('PerpetualPool', ropsten.perpetualPoolTemplate);
    } else {
        bToken = await (await ethers.getContractFactory('TestTetherToken')).deploy('Tether USD', 'USDT');
        cloneFactory = await (await ethers.getContractFactory('CloneFactory')).deploy();
        perpetualPoolTemplate = await (await ethers.getContractFactory('PerpetualPool')).deploy();
    }
    console.log('bToken:', bToken.address);
    console.log('cloneFactory:', cloneFactory.address);
    console.log('perpetualPoolTemplate:', perpetualPoolTemplate.address);

    // Deploy pToken
    const PToken = await ethers.getContractFactory('PToken');
    const pToken = await PToken.deploy('Deri position token', 'DPT');
    console.log('pToken:', pToken.address);

    // Deploy lToken
    const LToken = await ethers.getContractFactory('LToken');
    const lToken = await LToken.deploy('Deri liquidity token', 'DLT');
    console.log('lToken:', lToken.address);

    // Clone PerpetualPool
    await cloneFactory.clone(perpetualPoolTemplate.address);
    await new Promise(resolve => setTimeout(resolve, 30000));
    const perpetualPool = await ethers.getContractAt('PerpetualPool', await cloneFactory.cloned());
    await perpetualPool.initialize(
        symbol,
        [bToken.address, pToken.address, lToken.address, deployer.address],
        [multiplier, feeRatio, minPoolMarginRatio, minInitialMarginRatio, minMaintenanceMarginRatio, minAddLiquidity, redemptionFeeRatio, fundingRateCoefficient, minLiquidationReward, maxLiquidationReward, liquidationCutRatio, priceDelayAllowance]
    );
    console.log('perpetualPool:', perpetualPool.address);

    await pToken.setPool(perpetualPool.address);
    await lToken.setPool(perpetualPool.address);
    console.log('Linked pToken/lToken to perpetualPool');

}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
