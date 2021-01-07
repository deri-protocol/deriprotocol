const hre = require('hardhat');
const { expect } = require('chai');

describe('Deri Protocol - Test PreMiningPool', function () {

    function rescale(value, fromDecimals, toDecimals) {
        let from = ethers.BigNumber.from('1' + '0'.repeat(fromDecimals));
        let to = ethers.BigNumber.from('1' + '0'.repeat(toDecimals));
        return ethers.BigNumber.from(value).mul(to).div(from);
    }

    const decimals = 18;
    const bdecimals = 6;

    const one = rescale(1, 0, decimals);
    const revenue = rescale(1000000, 0, bdecimals);

    const symbol = 'BTCUSD';
    const minAddLiquidity = one.mul(100);
    const redemptionFeeRatio = one.mul(5).div(1000);

    const methods = {
        addLiquidity: 'addLiquidity(uint256)',
        removeLiquidity: 'removeLiquidity(uint256)',
    }

    let account1;
    let account2;
    let account3;
    let bToken;
    let lToken;
    let pool;

    async function getStates(account) {
        liquidity = await pool.getStateValues();
        poolBBalance = await bToken.balanceOf(pool.address);
        accountBBalance = await bToken.balanceOf(account.address);
        accountLBalance = await lToken.balanceOf(account.address);
        totalLBalance = await lToken.totalSupply();
        return {
            liquidity,
            poolBBalance,
            accountBBalance,
            accountLBalance,
            totalLBalance
        }
    }

    function format(state) {
        return {
            liquidity:          ethers.utils.formatEther(state.liquidity),
            poolBBalance:       ethers.utils.formatUnits(state.poolBBalance, bdecimals),
            accountBBalance:    ethers.utils.formatUnits(state.accountBBalance, bdecimals),
            accountLBalance:    ethers.utils.formatEther(state.accountLBalance),
            totalLBalance:      ethers.utils.formatEther(state.totalLBalance)
        }
    }

    function printDiff(pre, cur) {
        prestr = format(pre);
        curstr = format(cur);
        console.log('----------------------------------------');
        for (const key in prestr) {
            if (prestr[key] != curstr[key])
                console.log(`${key.padEnd(20)}: ${prestr[key]} => ${curstr[key]}`);
            else
                console.log(`${key.padEnd(20)}:`);
        }
        console.log('----------------------------------------');
    }

    beforeEach(async function() {
        [account1, account2, account3] = await ethers.getSigners();

        const TestTetherToken = await ethers.getContractFactory('TestTetherToken');
        bToken = await TestTetherToken.deploy('Tether USD', 'USDT');

        // const DAI = await ethers.getContractFactory('Dai');
        // bToken = await DAI.deploy(42);

        const LToken = await ethers.getContractFactory('LToken');
        lToken = await LToken.deploy('Deri liquidity token', 'DLT');

        const PreMiningPool = await ethers.getContractFactory('PreMiningPool');
        pool = await PreMiningPool.deploy();
        await pool.initialize(
            symbol,
            [bToken.address, lToken.address],
            [minAddLiquidity, redemptionFeeRatio]
        );

        await lToken.setPool(pool.address);

        await bToken.mint(account1.address, revenue);
        await bToken.mint(account2.address, revenue);
        await bToken.mint(account3.address, revenue);

        await bToken.connect(account1).approve(pool.address, one.mul(one));
        await bToken.connect(account2).approve(pool.address, one.mul(one));
        await bToken.connect(account3).approve(pool.address, one.mul(one));
    });

    async function addLiquidity(account, bAmount, diff=false) {
        pre = await getStates(account);
        await pool.connect(account).functions[methods.addLiquidity](bAmount);
        cur = await getStates(account);

        if (diff) printDiff(pre, cur);

        lShares = pre.liquidity.eq(0) ? bAmount : bAmount.mul(pre.totalLBalance).div(pre.liquidity);
        expect(cur.liquidity.sub(pre.liquidity)).to.equal(bAmount);
        expect(cur.poolBBalance.sub(pre.poolBBalance)).to.equal(rescale(bAmount, decimals, bdecimals));
        expect(pre.accountBBalance.sub(cur.accountBBalance)).to.equal(rescale(bAmount, decimals, bdecimals));
        expect(cur.accountLBalance.sub(pre.accountLBalance)).to.equal(lShares);
        expect(cur.totalLBalance.sub(pre.totalLBalance)).to.equal(lShares);
    }

    async function removeLiquidity(account, lShares, diff=false) {
        pre = await getStates(account);
        await pool.connect(account).functions[methods.removeLiquidity](lShares);
        cur = await getStates(account);

        if (diff) printDiff(pre, cur);

        bAmount = lShares.mul(pre.liquidity).div(pre.totalLBalance);
        if (lShares.lt(pre.totalLBalance)) {
            bAmount = bAmount.sub(bAmount.mul(redemptionFeeRatio).div(one));
        }
        bAmount = rescale(rescale(bAmount, decimals, bdecimals), bdecimals, decimals);

        expect(pre.liquidity.sub(cur.liquidity)).to.equal(bAmount);
        expect(pre.poolBBalance.sub(cur.poolBBalance)).to.equal(rescale(bAmount, decimals, bdecimals));
        expect(cur.accountBBalance.sub(pre.accountBBalance)).to.equal(rescale(bAmount, decimals, bdecimals));
        expect(pre.accountLBalance.sub(cur.accountLBalance)).to.equal(lShares);
        expect(pre.totalLBalance.sub(cur.totalLBalance)).to.equal(lShares);
    }

    it('addLiquidity and removeLiquidity should work correctly', async function () {
        await expect(removeLiquidity(account1, rescale(1, 0, decimals))).to.be.reverted;
        await addLiquidity(account2, rescale(10000, 0, decimals), false);
        await addLiquidity(account3, rescale(1000, 0, decimals), false);
        await removeLiquidity(account3, rescale(500, 0, decimals), false);
        await expect(removeLiquidity(account3, rescale(4995, 0, 17))).to.be.reverted;
        await removeLiquidity(account3, rescale(500, 0, decimals), false);
        await removeLiquidity(account2, rescale(7777, 0, decimals), false);
        await lToken.connect(account2).transfer(account1.address, rescale(2000, 0, decimals));
        await removeLiquidity(account2, rescale(223, 0, decimals), false);
        await removeLiquidity(account1, rescale(2000, 0, decimals), false);
    });

});
