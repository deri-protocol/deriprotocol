//================================================================================
// Deploy PreMiningPool with USDT
//================================================================================

require('@nomiclabs/hardhat-ethers');

async function main() {

    const kovan = {
        usdt:                   '0x6e28e5EC8f97164Da81c4E13F4C79B2B9ac41Ed1',
        dai:                    '0x53dE9B1A7b4c090dA2ca838E03af1C3C03054677'
    };
    const ropsten = {
        usdt:                   '0x8F038C454B6E68B2988706a1a5f78dE2C4634097',
        dai:                    '0x7382B8013bAF81850d5D4d2B109bc184d9D12383'
    }

    function rescale(value, fromDecimals, toDecimals) {
        let from = ethers.BigNumber.from('1' + '0'.repeat(fromDecimals));
        let to = ethers.BigNumber.from('1' + '0'.repeat(toDecimals));
        return ethers.BigNumber.from(value).mul(to).div(from);
    }

    const one = rescale(1, 0, 18);

    const symbol = 'BTCUSD';

    const minAddLiquidity = one.mul(100);
    const redemptionFeeRatio = one.mul(5).div(1000);

    const network = await ethers.provider.getNetwork();
    console.log('Network:', network.name, network.chainId);

    const [deployer] = await ethers.getSigners();
    console.log('Deployer:', deployer.address);
    console.log('Deployer Balance:', ethers.utils.formatEther(await deployer.getBalance()));

    let bToken;
    if (network.name == 'kovan') {
        bToken = await ethers.getContractAt('TestTetherToken', kovan.usdt);
    } else if (network.name == 'ropsten') {
        bToken = await ethers.getContractAt('TestTetherToken', ropsten.usdt);
    } else {
        bToken = await (await ethers.getContractFactory('TestTetherToken')).deploy('Tether USD', 'USDT');
    }
    console.log('bToken:', bToken.address);

    // Deploy lToken
    const LToken = await ethers.getContractFactory('LToken');
    const lToken = await LToken.deploy('Deri liquidity token', 'DLT');
    console.log('lToken:', lToken.address);

    // Deploy PreMiningPool
    const PreMiningPool = await ethers.getContractFactory('PreMiningPool');
    const preMiningPool = await PreMiningPool.deploy();
    await preMiningPool.initialize(
        symbol,
        [bToken.address, lToken.address],
        [minAddLiquidity, redemptionFeeRatio]
    );
    console.log('preMiningPool:', preMiningPool.address);

    await lToken.setPool(preMiningPool.address);
    console.log('Linked lToken to preMiningPool');

}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
