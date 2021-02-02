const hre = require('hardhat');
const { expect } = require('chai');

describe('Deri Protocol - Test LiquidatorQualifier', function () {

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
        withdrawMargin: 'withdrawMargin(uint256,uint256,uint256,uint8,bytes32,bytes32)',
        liquidate: 'liquidate(address,uint256,uint256,uint8,bytes32,bytes32)'
    }

    let delay = 0;
    let price = rescale(10000, 0, decimals);

    let account1;
    let account2;
    let account3;
    let bToken;
    let pToken;
    let lToken;
    let pool;
    let sToken;
    let liquidatorQualifier;

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
            cumuFundingRate:        ethers.utils.formatEther(state.cumuFundingRate),
            cumuFundingRateBlock:   ethers.utils.formatUnits(state.cumuFundingRateBlock, 0),
            liquidity:              ethers.utils.formatEther(state.liquidity),
            tradersNetVolume:       ethers.utils.formatEther(state.tradersNetVolume),
            tradersNetCost:         ethers.utils.formatEther(state.tradersNetCost),
            poolDynamicEquity:      ethers.utils.formatEther(state.poolDynamicEquity),
            poolBBalance:           ethers.utils.formatUnits(state.poolBBalance, bdecimals),
            accountBBalance:        ethers.utils.formatUnits(state.accountBBalance, bdecimals),
            accountLBalance:        ethers.utils.formatEther(state.accountLBalance),
            totalLBalance:          ethers.utils.formatEther(state.totalLBalance),
            volume:                 ethers.utils.formatEther(state.volume),
            cost:                   ethers.utils.formatEther(state.cost),
            lastCumuFundingRate:    ethers.utils.formatEther(state.lastCumuFundingRate),
            margin:                 ethers.utils.formatEther(state.margin),
            lastUpdateTimestamp:    ethers.utils.formatUnits(state.lastUpdateTimestamp, 0)
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

    beforeEach(async function () {
        [account1, account2, account3] = await ethers.getSigners();

        sToken = await (await ethers.getContractFactory('TestTetherToken')).deploy('LQ Token', 'LQT');
        liquidatorQualifier = await (await ethers.getContractFactory('LiquidatorQualifier')).deploy(sToken.address);

        await sToken.mint(account1.address, 10000);
        await sToken.mint(account2.address, 10000);
        await sToken.mint(account3.address, 10000);

        await sToken.connect(account1).approve(liquidatorQualifier.address, 10000);
        await sToken.connect(account2).approve(liquidatorQualifier.address, 10000);
        await sToken.connect(account3).approve(liquidatorQualifier.address, 10000);

        const TestTetherToken = await ethers.getContractFactory('TestTetherToken');
        bToken = await TestTetherToken.deploy('Tether USD', 'USDT');

        // const DAI = await ethers.getContractFactory('Dai');
        // bToken = await DAI.deploy(42);

        const CloneFactory = await ethers.getContractFactory('CloneFactory');
        const cloneFactory = await CloneFactory.deploy();

        const PerpetualPool = await ethers.getContractFactory('PerpetualPool');
        const perpetualPoolTemplate = await PerpetualPool.deploy();

        await cloneFactory.clone(perpetualPoolTemplate.address);
        pool = await ethers.getContractAt('PerpetualPool', await cloneFactory.cloned());

        const PToken = await ethers.getContractFactory('PToken');
        pToken = await PToken.deploy('Deri position token', 'DPT', pool.address);

        const LToken = await ethers.getContractFactory('LToken');
        lToken = await LToken.deploy('Deri liquidity token', 'DLT', pool.address);

        await pool.initialize(
            symbol,
            [
                bToken.address,
                pToken.address,
                lToken.address,
                account1.address,
                liquidatorQualifier.address
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
        expect(cur.poolBBalance.sub(pre.poolBBalance)).to.equal(rescale(bAmount, decimals, bdecimals));
        expect(pre.accountBBalance.sub(cur.accountBBalance)).to.equal(rescale(bAmount, decimals, bdecimals));
        expect(cur.accountLBalance.sub(pre.accountLBalance)).to.equal(lShares);
        expect(cur.totalLBalance.sub(pre.totalLBalance)).to.equal(lShares);
    }

    async function removeLiquidity(account, lShares, diff=false) {
        pre = await getStates(account);
        [timestamp, price, v, r, s] = await signature(price);
        await pool.connect(account).functions[methods.removeLiquidity](lShares, timestamp, price, v, r, s);
        cur = await getStates(account);

        if (diff) printDiff(pre, cur);

        bAmount = lShares.mul(pre.poolDynamicEquity).div(pre.totalLBalance);
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

    async function depositMargin(account, bAmount, diff=false) {
        pre = await getStates(account);
        [timestamp, price, v, r, s] = await signature(price);
        await pool.connect(account).functions[methods.depositMargin](bAmount, timestamp, price, v, r, s);
        cur = await getStates(account);

        if (diff) printDiff(pre, cur);

        expect(cur.poolBBalance.sub(pre.poolBBalance)).to.equal(rescale(bAmount, decimals, bdecimals));
        expect(pre.accountBBalance.sub(cur.accountBBalance)).to.equal(rescale(bAmount, decimals, bdecimals));
        expect(cur.margin.sub(pre.margin)).to.equal(bAmount);
    }

    async function withdrawMargin(account, bAmount, diff=false) {
        pre = await getStates(account);
        [timestamp, price, v, r, s] = await signature(price);
        await pool.connect(account).functions[methods.withdrawMargin](bAmount, timestamp, price, v, r, s);
        cur = await getStates(account);

        if (diff) printDiff(pre, cur);

        funding = pre.volume.mul(cur.cumuFundingRate.sub(pre.lastCumuFundingRate)).div(one);
        funding = rescale(rescale(funding, decimals, bdecimals), bdecimals, decimals);

        expect(pre.poolBBalance.sub(cur.poolBBalance)).to.equal(rescale(bAmount, decimals, bdecimals));
        expect(cur.accountBBalance.sub(pre.accountBBalance)).to.equal(rescale(bAmount, decimals, bdecimals));
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

        let paid = rescale(rescale(funding.add(fee).add(realizedCost), decimals, bdecimals), bdecimals, decimals);

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

    async function liquidate(acc1, acc2, diff=false) {
        pre1 = await getStates(acc1);
        pre2 = await getStates(acc2);
        [timestamp, price, v, r, s] = await signature(price);
        await pool.connect(acc1).functions[methods.liquidate](acc2.address, timestamp, price, v, r, s);
        cur1 = await getStates(acc1);
        cur2 = await getStates(acc2);

        if (diff) {
            printDiff(pre1, cur1);
            printDiff(pre2, cur2);
        }
    }

    it('liquidatorQualifier contructor worked as expected', async function () {
        expect(await liquidatorQualifier.controller()).to.equal(account1.address);
        expect(await liquidatorQualifier.stakeTokenAddress()).to.equal(sToken.address);
        expect(await liquidatorQualifier.totalStakedTokens()).to.equal(0);
        expect(await liquidatorQualifier.totalStakers()).to.equal(0);
    });

    it('liquidatorQualifier staking is working preperly', async function () {
        await liquidatorQualifier.connect(account2).deposit(1000);
        expect(await liquidatorQualifier.isQualifiedLiquidator(account1.address)).to.be.false;
        expect(await liquidatorQualifier.isQualifiedLiquidator(account2.address)).to.be.true;

        await liquidatorQualifier.connect(account3).deposit(2000);
        expect(await liquidatorQualifier.isQualifiedLiquidator(account2.address)).to.be.false;
        expect(await liquidatorQualifier.isQualifiedLiquidator(account3.address)).to.be.true;

        await liquidatorQualifier.connect(account3).withdraw(1500);
        expect(await liquidatorQualifier.isQualifiedLiquidator(account2.address)).to.be.true;
        expect(await liquidatorQualifier.isQualifiedLiquidator(account3.address)).to.be.false;

        await expect(liquidatorQualifier.connect(account3).withdraw(600)).to.be.reverted;
        await liquidatorQualifier.connect(account3).withdraw(500);
        expect(await liquidatorQualifier.totalStakers()).to.equal(1);
    });

    it('liquidator qualification check is working correctly', async function () {
        await addLiquidity(account2, rescale(10000, 0, decimals), false);
        await depositMargin(account3, rescale(100, 0, decimals), false);
        await trade(account3, rescale(500, 0, decimals), false);

        price = rescale(5000, 0, decimals);
        await expect(liquidate(account1, account3, false)).to.be.revertedWith('PerpetualPool: not quanlified liquidator');

        await liquidatorQualifier.connect(account1).deposit(1000);
        await liquidate(account1, account3, false);
    });

});
