const hre = require('hardhat');
const { expect } = require('chai');

describe('Deri Protocol - Test PerpetualPool', function () {

    function rescale(value, fromDecimals, toDecimals) {
        let from = ethers.BigNumber.from('1' + '0'.repeat(fromDecimals));
        let to = ethers.BigNumber.from('1' + '0'.repeat(toDecimals));
        return ethers.BigNumber.from(value).mul(to).div(from);
    }

    const one = rescale(1, 0, 18);
    const revenue = rescale(1000000, 0, 6);

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
    const maxLiquidationReward = one.mul(100);
    const liquidationCutRatio = one.div(4);
    const priceDelayAllowance = 100;

    const methods = {
        exists: 'exists(address)',
        getPosition: 'getPosition(address)',
        tradeWithMargin: 'tradeWithMargin(int256,uint256,uint256,uint256,uint8,bytes32,bytes32)',
        trade: 'trade(int256,uint256,uint256,uint8,bytes32,bytes32)',
        addLiquidity: 'addLiquidity(uint256,uint256,uint256,uint8,bytes32,bytes32)',
        removeLiquidity: 'removeLiquidity(uint256,uint256,uint256,uint8,bytes32,bytes32)',
        depositMargin: 'depositMargin(uint256,uint256,uint256,uint8,bytes32,bytes32)',
        withdrawMargin: 'withdrawMargin(uint256,uint256,uint256,uint8,bytes32,bytes32)'
    }

    let delay = 0;
    let price = rescale(10000, 0, 18);

    let account1;
    let account2;
    let account3;
    let bToken;
    let pToken;
    let lToken;
    let pool;

    async function signature() {
        const block = await ethers.provider.getBlock('latest');
        const timestamp = block.timestamp + delay;
        const message = ethers.utils.solidityKeccak256(
            ['string', 'uint256', 'uint256'],
            [symbol, timestamp, price]
        );
        const signature = await account1.signMessage(ethers.utils.arrayify(message));
        const signed = ethers.utils.splitSignature(signature);
        return [timestamp, price, signed.v, signed.r, signed.s];
    }

    async function getStates(account) {
        [cumuFundingRate, cumuFundingRateBlock, liquidity, tradersNetVolume, tradersNetCost] = await pool.getStateValues();
        poolDynamicEquity = liquidity.add(tradersNetCost).sub(tradersNetVolume.mul(price).mul(multiplier).div(one).div(one));
        poolBBalance = await bToken.balanceOf(pool.address);
        accountBBalance = await bToken.balanceOf(account.address);
        accountLBalance = await lToken.balanceOf(account.address);
        totalLBalance = await lToken.totalSupply();
        if ((await pToken.functions[methods.exists](account.address))[0]) {
            [volume, cost, lastCumuFundingRate, margin, lastUpdateTimestamp] = await pToken.functions[methods.getPosition](account.address);
        } else {
            [volume, cost, lastCumuFundingRate, margin, lastUpdateTimestamp] = [0, 0, 0, 0, 0];
        }
        return {
            cumuFundingRate,
            cumuFundingRateBlock,
            liquidity,
            tradersNetVolume,
            tradersNetCost,
            poolDynamicEquity,
            poolBBalance,
            accountBBalance,
            accountLBalance,
            totalLBalance,
            volume,
            cost,
            lastCumuFundingRate,
            margin,
            lastUpdateTimestamp
        }
    }

    function format(state) {
        return {
            cumuFundingRate: ethers.utils.formatEther(state.cumuFundingRate),
            cumuFundingRateBlock: ethers.utils.formatUnits(state.cumuFundingRateBlock, 0),
            liquidity: ethers.utils.formatEther(state.liquidity),
            tradersNetVolume: ethers.utils.formatEther(state.tradersNetVolume),
            tradersNetCost: ethers.utils.formatEther(state.tradersNetCost),
            poolDynamicEquity: ethers.utils.formatEther(state.poolDynamicEquity),
            poolBBalance: ethers.utils.formatUnits(state.poolBBalance, 6),
            accountBBalance: ethers.utils.formatUnits(state.accountBBalance, 6),
            accountLBalance: ethers.utils.formatEther(state.accountLBalance),
            totalLBalance: ethers.utils.formatEther(state.totalLBalance),
            volume: ethers.utils.formatEther(state.volume),
            cost: ethers.utils.formatEther(state.cost),
            lastCumuFundingRate: ethers.utils.formatEther(state.lastCumuFundingRate),
            margin: ethers.utils.formatEther(state.margin),
            lastUpdateTimestamp: ethers.utils.formatUnits(state.lastUpdateTimestamp, 0)
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

        const PToken = await ethers.getContractFactory('PToken');
        pToken = await PToken.deploy('Deri position token', 'DPT');

        const LToken = await ethers.getContractFactory('LToken');
        lToken = await LToken.deploy('Deri liquidity token', 'DLT');

        const CloneFactory = await ethers.getContractFactory('CloneFactory');
        const cloneFactory = await CloneFactory.deploy();

        const PerpetualPool = await ethers.getContractFactory('PerpetualPool');
        const perpetualPoolTemplate = await PerpetualPool.deploy();

        await cloneFactory.clone(perpetualPoolTemplate.address);
        pool = await ethers.getContractAt('PerpetualPool', await cloneFactory.cloned());
        await pool.initialize(
            symbol,
            [
                bToken.address,
                pToken.address,
                lToken.address,
                account1.address
            ],
            [
                multiplier,
                feeRatio,
                minPoolMarginRatio,
                minInitialMarginRatio,
                minMaintenanceMarginRatio,
                minAddLiquidity,
                redemptionFeeRatio,
                fundingRateCoefficient,
                minLiquidationReward,
                maxLiquidationReward,
                liquidationCutRatio,
                priceDelayAllowance
            ]
        );

        await pToken.setPool(pool.address);
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
        [timestamp, price, v, r, s] = await signature(price);
        await pool.connect(account).functions[methods.addLiquidity](bAmount, timestamp, price, v, r, s);
        cur = await getStates(account);

        if (diff) printDiff(pre, cur);

        lShares = pre.liquidity.eq(0) ? bAmount : bAmount.mul(pre.totalLBalance).div(pre.liquidity);
        expect(cur.liquidity.sub(pre.liquidity)).to.equal(bAmount);
        expect(cur.poolBBalance.sub(pre.poolBBalance)).to.equal(rescale(bAmount, 18, 6));
        expect(pre.accountBBalance.sub(cur.accountBBalance)).to.equal(rescale(bAmount, 18, 6));
        expect(cur.accountLBalance.sub(pre.accountLBalance)).to.equal(lShares);
        expect(cur.totalLBalance.sub(pre.totalLBalance)).to.equal(lShares);
    }

    async function removeLiquidity(account, lShares, diff=false) {
        pre = await getStates(account);
        [timestamp, price, v, r, s] = await signature(price);
        await pool.connect(account).functions[methods.removeLiquidity](lShares, timestamp, price, v, r, s);
        cur = await getStates(account);

        if (diff) printDiff(pre, cur);

        bAmount = lShares.mul(pre.liquidity).div(pre.totalLBalance);
        if (lShares.lt(pre.totalLBalance)) {
            bAmount = bAmount.sub(bAmount.mul(redemptionFeeRatio).div(one));
        }
        bAmount = rescale(rescale(bAmount, 18, 6), 6, 18);

        expect(pre.liquidity.sub(cur.liquidity)).to.equal(bAmount);
        expect(pre.poolBBalance.sub(cur.poolBBalance)).to.equal(rescale(bAmount, 18, 6));
        expect(cur.accountBBalance.sub(pre.accountBBalance)).to.equal(rescale(bAmount, 18, 6));
        expect(pre.accountLBalance.sub(cur.accountLBalance)).to.equal(lShares);
        expect(pre.totalLBalance.sub(cur.totalLBalance)).to.equal(lShares);
    }

    async function depositMargin(account, bAmount, diff=false) {
        pre = await getStates(account);
        [timestamp, price, v, r, s] = await signature(price);
        await pool.connect(account).functions[methods.depositMargin](bAmount, timestamp, price, v, r, s);
        cur = await getStates(account);

        if (diff) printDiff(pre, cur);

        expect(cur.poolBBalance.sub(pre.poolBBalance)).to.equal(rescale(bAmount, 18, 6));
        expect(pre.accountBBalance.sub(cur.accountBBalance)).to.equal(rescale(bAmount, 18, 6));
        expect(cur.margin.sub(pre.margin)).to.equal(bAmount);
    }

    async function withdrawMargin(account, bAmount, diff=false) {
        pre = await getStates(account);
        [timestamp, price, v, r, s] = await signature(price);
        await pool.connect(account).functions[methods.withdrawMargin](bAmount, timestamp, price, v, r, s);
        cur = await getStates(account);

        if (diff) printDiff(pre, cur);

        funding = pre.volume.mul(cur.cumuFundingRate.sub(pre.lastCumuFundingRate)).div(one);
        funding = rescale(rescale(funding, 18, 6), 6, 18);

        expect(pre.poolBBalance.sub(cur.poolBBalance)).to.equal(rescale(bAmount, 18, 6));
        expect(cur.accountBBalance.sub(pre.accountBBalance)).to.equal(rescale(bAmount, 18, 6));
        expect(pre.margin.sub(cur.margin)).to.equal(bAmount.add(funding));
        expect(cur.liquidity.sub(pre.liquidity)).to.equal(funding);
    }

    async function trade(account, volume, diff=false) {
        pre = await getStates(account);
        [timestamp, price, v, r, s] = await signature(price);
        await pool.connect(account).functions[methods.trade](volume, timestamp, price, v, r, s);
        cur = await getStates(account);

        if (diff) printDiff(pre, cur);

        funding = pre.volume.mul(cur.cumuFundingRate.sub(pre.lastCumuFundingRate)).div(one);
        curCost = volume.mul(price).mul(multiplier).div(one).div(one);
        fee = curCost.abs().mul(feeRatio).div(one);
        let realizedCost = 0;
        if ((pre.volume.gte(0) && volume.gte(0)) || (pre.volume.lte(0) && volume.lte(0))) {

        } else if (pre.volume.abs().lte(volume.abs())) {
            realizedCost = curCost.mul(pre.volume.abs()).div(volume.abs()).add(pre.cost);
        } else {
            realizedCost = pre.cost.mul(volume.abs()).div(pre.volume.abs()).add(curCost);
        }

        let paid = rescale(rescale(funding.add(fee).add(realizedCost), 18, 6), 6, 18);

        _volume = pre.volume.add(volume);
        _cost = pre.cost.add(curCost).sub(realizedCost);
        _margin = pre.margin.sub(paid);
        _tradersNetVolume = pre.tradersNetVolume.add(volume);
        _tradersNetCost = pre.tradersNetCost.add(curCost).sub(realizedCost);
        _liquidity = pre.liquidity.add(paid);

        expect(cur.liquidity).to.equal(_liquidity);
        expect(cur.tradersNetVolume).to.equal(_tradersNetVolume);
        expect(cur.tradersNetCost).to.equal(_tradersNetCost);
        expect(cur.volume).to.equal(_volume);
        expect(cur.cost).to.equal(_cost);
        expect(cur.margin).to.equal(_margin);
    }

    it('addLiquidity and removeLiquidity should work correctly', async function () {
        await expect(removeLiquidity(account1, rescale(1, 0, 18))).to.be.reverted;
        await addLiquidity(account2, rescale(1000, 0, 18), false);
        await removeLiquidity(account2, rescale(33, 0, 18), false);
        await removeLiquidity(account2, rescale(777, 0, 18), false);
        await removeLiquidity(account2, rescale(190, 0, 18), false);
    });

    it('depositMargin and withdrawMargin should work correctly', async function () {
        await depositMargin(account2, rescale(1000, 0, 18), false);
        await withdrawMargin(account2, rescale(333, 0, 18), false);
        await withdrawMargin(account2, rescale(667, 0, 18), false);
    });

    it('trade should work correctly', async function () {
        await addLiquidity(account1, rescale(10000, 0, 18), false);
        await depositMargin(account2, rescale(1000, 0, 18), false);
        await trade(account2, rescale(111, 0, 18), false);
        price = rescale(12000, 0, 18);
        await trade(account2, rescale(-100, 0, 18), false);
        await trade(account2, rescale(-33, 0, 18), false);
        await trade(account2, rescale(22, 0, 18), false);
    });

});
