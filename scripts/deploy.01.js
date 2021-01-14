require('@nomiclabs/hardhat-ethers');

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

const kovan = {
    deri:                   '0xdF6d422D7979F351517C3e8D687EAe6637EA2007',
    usdt:                   '0x6e28e5EC8f97164Da81c4E13F4C79B2B9ac41Ed1',
    dai:                    '0x53dE9B1A7b4c090dA2ca838E03af1C3C03054677',
    cloneFactory:           '0xD92921100f858aE323db8281ED66eC67F0c4cCD0'
};
const ropsten = {
    deri:                   '0xbE26990dFD16F5D47A67Fe494eb9B6631335EEF1',
    usdt:                   '0x8F038C454B6E68B2988706a1a5f78dE2C4634097',
    dai:                    '0x7382B8013bAF81850d5D4d2B109bc184d9D12383',
    cloneFactory:           '0xE76CD84f01082B005C19F8873B0910aF9e859f16'
}


function print_title(title) {
    console.log();
    console.log('='.repeat(80));
    console.log(title);
    console.log('='.repeat(80));
}


async function pre_deploy() {

    print_title(`Pre-Deployments`);

    let network;
    let deployer;
    let deri;
    let usdt;
    let dai;
    let cloneFactory;

    //================================================================================
    // Network and Deployer
    //================================================================================
    network = await ethers.provider.getNetwork();
    [deployer] = await ethers.getSigners();
    console.log('Network:', network.name, network.chainId);
    console.log('Deployer:', deployer.address);
    console.log('Deployer Balance:', ethers.utils.formatEther(await deployer.getBalance()));

    //================================================================================
    // Deploy USDT
    //================================================================================
    usdt = await (await ethers.getContractFactory('TestTetherToken')).deploy('Tether USD', 'USDT');
    console.log('USDT:', usdt.address);

    //================================================================================
    // Deploy DAI
    //================================================================================
    dai = await (await ethers.getContractFactory('Dai')).deploy(network.chainId);
    console.log('DAI:', dai.address);

    //================================================================================
    // Deploy CloneFactory
    //================================================================================
    cloneFactory = await (await ethers.getContractFactory('CloneFactory')).deploy();
    console.log('CloneFactory:', cloneFactory.address);

    //================================================================================
    // Deploy DERI
    //================================================================================
    deri = await (await ethers.getContractFactory('TERC20')).deploy('Deri Protocol Token', 'DERI');
    console.log('DERI:', deri.address);

}


async function deploy_perpetual(base) {

    print_title(`PerpetualPool (${base.toUpperCase()})`);

    let network;
    let deployer;
    let cloneFactory;
    let perpetualPoolTemplate;
    let bToken;
    let pToken;
    let lToken;
    let perpetualPool;
    let deri;
    let liquidatorQualifier;

    console.log('Base:', base);

    //================================================================================
    // Network and Deployer
    //================================================================================
    network = await ethers.provider.getNetwork();
    [deployer] = await ethers.getSigners();
    console.log('Network:', network.name, network.chainId);
    console.log('Deployer:', deployer.address);
    console.log('Deployer Balance:', ethers.utils.formatEther(await deployer.getBalance()));

    //================================================================================
    // Deploy CloneFactory
    //================================================================================
    if (network.name == 'kovan') {
        cloneFactory = await ethers.getContractAt('CloneFactory', kovan.cloneFactory);
    } else if (network.name == 'ropsten') {
        cloneFactory = await ethers.getContractAt('CloneFactory', ropsten.cloneFactory);
    } else {
        cloneFactory = await (await ethers.getContractFactory('CloneFactory')).deploy();
    }
    console.log('cloneFactory:', cloneFactory.address);

    //================================================================================
    // Deploy PerpetualPool Template
    //================================================================================
    perpetualPoolTemplate = await (await ethers.getContractFactory('PerpetualPool')).deploy();
    console.log('perpetualPoolTemplate:', perpetualPoolTemplate.address);

    //================================================================================
    // Deploy BToken
    //================================================================================
    if (network.name == 'kovan') {
        if (base == 'usdt') {
            bToken = await ethers.getContractAt('TestTetherToken', kovan.usdt);
        } else if (base == 'dai') {
            bToken = await ethers.getContractAt('Dai', kovan.dai);
        }
    } else if (network.name == 'ropsten') {
        if (base == 'usdt') {
            bToken = await ethers.getContractAt('TestTetherToken', ropsten.usdt);
        } else if (base == 'dai') {
            bToken = await ethers.getContractAt('Dai', ropsten.dai);
        }
    } else {
        if (base == 'usdt') {
            bToken = await (await ethers.getContractFactory('TestTetherToken')).deploy('Tether USD', 'USDT');
        } else if (base == 'dai') {
            bToken = await (await ethers.getContractFactory('Dai')).deploy(network.chainId);
        }
    }
    console.log('bToken:', bToken.address);

    //================================================================================
    // Deploy PToken
    //================================================================================
    pToken = await (await ethers.getContractFactory('PToken')).deploy('Deri Position Token', 'DPT');
    console.log('pToken:', pToken.address);

    //================================================================================
    // Deploy LToken
    //================================================================================
    lToken = await (await ethers.getContractFactory('LToken')).deploy('Deri Liquidity Token', 'DLT');
    console.log('lToken:', lToken.address);

    //================================================================================
    // Deploy Deri
    //================================================================================
    if (network.name == 'kovan') {
        deri = await ethers.getContractAt('TERC20', kovan.deri);
    } else if (network.name == 'ropsten') {
        deri = await ethers.getContractAt('TERC20', ropsten.deri);
    } else {
        deri = await (await ethers.getContractFactory('TERC20')).deploy('Deri Protocol Token', 'DERI');
    }
    console.log('deri:', deri.address);

    //================================================================================
    // Deploy LiquidatorQualifier
    //================================================================================
    liquidatorQualifier = await (await ethers.getContractFactory('LiquidatorQualifier')).deploy(deri.address);
    console.log('liquidatorQualifier:', liquidatorQualifier.address);

    //================================================================================
    // Clone PerpetualPool
    //================================================================================
    await cloneFactory.clone(perpetualPoolTemplate.address);
    if (network.name != 'unknown') {
        await new Promise(resolve => setTimeout(resolve, 30000));
    }
    perpetualPool = await ethers.getContractAt('PerpetualPool', await cloneFactory.cloned());
    await perpetualPool.initialize(
        symbol,
        [bToken.address, pToken.address, lToken.address, deployer.address, liquidatorQualifier.address],
        [multiplier, feeRatio, minPoolMarginRatio, minInitialMarginRatio, minMaintenanceMarginRatio, minAddLiquidity, redemptionFeeRatio, fundingRateCoefficient, minLiquidationReward, maxLiquidationReward, liquidationCutRatio, priceDelayAllowance]
    );
    console.log('perpetualPool:', perpetualPool.address);

    //================================================================================
    // Link pToken/lToken to PerpetualPool
    //================================================================================
    await pToken.setPool(perpetualPool.address);
    await lToken.setPool(perpetualPool.address);
    console.log('Linked pToken/lToken to perpetualPool');

}


async function deploy_premining(base) {

    print_title(`PreMiningPool (${base.toUpperCase()})`);

    let network;
    let deployer;
    let bToken;
    let lToken;
    let preMiningPool;

    console.log('Base:', base);

    //================================================================================
    // Network and Deployer
    //================================================================================
    network = await ethers.provider.getNetwork();
    [deployer] = await ethers.getSigners();
    console.log('Network:', network.name, network.chainId);
    console.log('Deployer:', deployer.address);
    console.log('Deployer Balance:', ethers.utils.formatEther(await deployer.getBalance()));

    //================================================================================
    // Deploy BToken
    //================================================================================
    if (network.name == 'kovan') {
        if (base == 'usdt') {
            bToken = await ethers.getContractAt('TestTetherToken', kovan.usdt);
        } else if (base == 'dai') {
            bToken = await ethers.getContractAt('Dai', kovan.dai);
        }
    } else if (network.name == 'ropsten') {
        if (base == 'usdt') {
            bToken = await ethers.getContractAt('TestTetherToken', ropsten.usdt);
        } else if (base == 'dai') {
            bToken = await ethers.getContractAt('Dai', ropsten.dai);
        }
    } else {
        if (base == 'usdt') {
            bToken = await (await ethers.getContractFactory('TestTetherToken')).deploy('Tether USD', 'USDT');
        } else if (base == 'dai') {
            bToken = await (await ethers.getContractFactory('Dai')).deploy(network.chainId);
        }
    }
    console.log('bToken:', bToken.address);

    //================================================================================
    // Deploy LToken
    //================================================================================
    lToken = await (await ethers.getContractFactory('LToken')).deploy('Deri Liquidity Token', 'DLT');
    console.log('lToken:', lToken.address);

    //================================================================================
    // Deploy PreMiningPool
    //================================================================================
    preMiningPool = await (await ethers.getContractFactory('PreMiningPool')).deploy();
    await preMiningPool.initialize(
        symbol,
        [bToken.address, lToken.address],
        [minAddLiquidity, redemptionFeeRatio]
    );
    console.log('preMiningPool:', preMiningPool.address);

    //================================================================================
    // Link lToken to PreMiningPool
    //================================================================================
    await lToken.setPool(preMiningPool.address);
    console.log('Lined lToken to preMiningPool');

}


async function main() {
    // await pre_deploy();
    await deploy_perpetual('usdt');
    // await deploy_perpetual('dai');
    // await deploy_premining('usdt');
    // await deploy_premining('dai');
}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
